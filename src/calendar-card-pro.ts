/* eslint-disable import/order */
/**
 * Calendar Card Pro for Home Assistant
 *
 * This is the main entry point for the Calendar Card Pro custom card.
 * It orchestrates the different modules and handles the core web component lifecycle.
 *
 * Design inspired by Home Assistant community member @GHA_Steph's button-card calendar design
 * https://community.home-assistant.io/t/calendar-add-on-some-calendar-designs/385790
 *
 * Interaction patterns inspired by Home Assistant's Tile Card
 * and Material Design, both licensed under the Apache License 2.0.
 * https://github.com/home-assistant/frontend/blob/dev/LICENSE.md
 *
 * @license MIT
 * @version 0.1.0
 */

export const VERSION = '0.1.0';

// Import all types via namespace for cleaner imports
import * as Config from './config/config';
import * as Types from './config/types';
import * as Localize from './translations/localize';
import * as FormatUtils from './utils/format-utils';
import * as EventUtils from './utils/event-utils';
import * as Interaction from './utils/interaction';
import * as Helpers from './utils/helpers';
import * as StateUtils from './utils/state-utils';
import * as Styles from './rendering/styles';
import * as Render from './rendering/render';
import * as DomUtils from './utils/dom-utils';
import * as Logger from './utils/logger-utils';
import * as Editor from './rendering/editor';

// Ensure this file is treated as a module
export {};

// Add window interface extension for customCards
declare global {
  interface Window {
    customCards: Array<Types.CustomCard>;
  }

  // Add custom element interface
  interface HTMLElementTagNameMap {
    'calendar-card-pro-dev': CalendarCardPro;
    'calendar-card-pro-dev-editor': Editor.CalendarCardProEditor;
  }

  // Add improved DOM interfaces
  interface HTMLElementEventMap {
    'hass-more-info': Types.HassMoreInfoEvent;
    'location-changed': Event;
  }

  // Add custom property for ripple handler
  interface HTMLElement {
    _rippleHandler?: (ev: PointerEvent) => void;
  }
}

/******************************************************************************
 * MAIN CARD CLASS
 ******************************************************************************/

/**
 * The main Calendar Card Pro component that extends HTMLElement
 * This class orchestrates the different modules to create a complete
 * calendar card for Home Assistant
 */
class CalendarCardPro extends HTMLElement {
  private instanceId: string;
  private config!: Types.Config;
  private events: Types.CalendarEventData[] = [];
  private _hass: Types.Hass | null = null;
  private touchState: {
    touchStartY: number;
    touchStartX: number;
    holdTimer: number | null;
    holdTriggered: boolean;
  } = {
    touchStartY: 0,
    touchStartX: 0,
    holdTimer: null,
    holdTriggered: false,
  };
  private isLoading = true;
  private isExpanded = false;
  private performanceMetrics: Types.PerformanceData = {
    renderTime: [],
    eventCount: 0,
    lastUpdate: Date.now(),
  };
  private readonly debouncedUpdate: () => void;
  private readonly memoizedFormatTime: (date: Date) => string & Types.MemoCache<string>;
  private readonly memoizedFormatLocation: (location: string) => string & Types.MemoCache<string>;
  private readonly cleanupInterval: number;
  private renderTimeout?: number;
  private performanceTracker: {
    beginMeasurement: (eventCount: number) => Types.PerfMetrics;
    endMeasurement: (metrics: Types.PerfMetrics, performanceData: Types.PerformanceData) => number;
    getAverageRenderTime: (performanceData: Types.PerformanceData) => number;
  };
  private visibilityCleanup?: () => void;
  private refreshTimer?: {
    start: () => void;
    stop: () => void;
  };
  private eventListenerCleanup: (() => void) | null = null;

  /******************************************************************************
   * STATIC CONFIGURATION
   ******************************************************************************/

  static get DEFAULT_CONFIG(): Types.Config {
    return Config.DEFAULT_CONFIG;
  }

  /******************************************************************************
   * TRANSLATIONS
   ******************************************************************************/

  static get TRANSLATIONS(): Readonly<Record<string, Types.Translations>> {
    return Localize.TRANSLATIONS;
  }

  /******************************************************************************
   * CALENDAR ENTITY UTILITIES
   ******************************************************************************/

  static findCalendarEntity(hass: Types.Hass): string | null {
    return Config.findCalendarEntity(hass.states);
  }

  /******************************************************************************
   * CONFIG UTILITIES
   ******************************************************************************/

  static getStubConfig(hass: Types.Hass) {
    return Config.getStubConfig(hass.states);
  }

  static get displayName() {
    return 'Calendar Card Pro';
  }

  /******************************************************************************
   * LIFECYCLE METHODS
   ******************************************************************************/

  // In constructor, use a temporary ID that will be replaced in setConfig
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    // Generate a temporary instance ID - this will be replaced with a deterministic one in setConfig
    this.instanceId = Helpers.generateInstanceId();
    this.initializeState();

    // Use VERSION constant instead of hardcoded string
    Logger.initializeLogger(VERSION);

    // Initialize the performance tracker
    this.performanceTracker = Helpers.createPerformanceTracker();

    // Use the new visibility handling function
    this.visibilityCleanup = StateUtils.setupVisibilityHandling(
      () => this.updateEvents(),
      () => this.performanceMetrics.lastUpdate,
    );

    // Create refresh timer controller
    this.refreshTimer = StateUtils.setupRefreshTimer(
      (force = false) => this.updateEvents(force),
      () => this.config?.refresh_interval || 30,
    );

    // Use the helper functions
    this.debouncedUpdate = Helpers.debounce(() => this.updateEvents(), 300);

    this.memoizedFormatTime = Helpers.memoize(
      (date: Date) => FormatUtils.formatTime(date, this.config.time_24h),
      this,
    ) as unknown as (date: Date) => string & Types.MemoCache<string>;

    this.memoizedFormatLocation = Helpers.memoize(
      (location: string) =>
        FormatUtils.formatLocation(location, this.config.remove_location_country),
      this,
    ) as unknown as (location: string) => string & Types.MemoCache<string>;

    this.cleanupInterval = window.setInterval(() => this.cleanupCache(), 3600000);

    // Start refresh timer
    this.refreshTimer.start();
  }

  disconnectedCallback() {
    // Clean up visibility handler
    if (this.visibilityCleanup) {
      this.visibilityCleanup();
    }

    // Use the timer controller to stop the refresh timer
    if (this.refreshTimer) {
      this.refreshTimer.stop();
    }

    clearInterval(this.cleanupInterval);
    this.cleanup();

    // Add cleanup for event listeners
    if (this.eventListenerCleanup) {
      this.eventListenerCleanup();
      this.eventListenerCleanup = null;
    }
  }

  /******************************************************************************
   * BASIC UTILITY METHODS
   ******************************************************************************/

  formatLocation(location: string): string {
    return FormatUtils.formatLocation(location, this.config.remove_location_country);
  }

  /******************************************************************************
   * STATE MANAGEMENT
   ******************************************************************************/

  initializeState() {
    const initialState = StateUtils.initializeState();
    this.config = initialState.config;
    this.events = initialState.events;
    this._hass = initialState.hass;
    this.touchState = initialState.touchState;
    this.isLoading = initialState.isLoading;
    this.isExpanded = initialState.isExpanded;
  }

  cleanup() {
    StateUtils.cleanup(
      this.renderTimeout,
      this.memoizedFormatTime as unknown as Types.MemoCache<string>,
      this.memoizedFormatLocation as unknown as Types.MemoCache<string>,
    );
  }

  cleanupCache() {
    StateUtils.cleanupCache(this.config.entities);
  }

  get translations() {
    const lang = this.config.language || 'en';
    return Localize.getTranslations(lang);
  }

  /******************************************************************************
   * HOME ASSISTANT INTEGRATION
   ******************************************************************************/

  set hass(hass: Types.Hass) {
    const previousHass = this._hass;
    this._hass = hass;

    const entitiesChanged = this.config.entities.some(
      (entity) =>
        !previousHass ||
        previousHass.states[typeof entity === 'string' ? entity : entity.entity]?.state !==
          hass.states[typeof entity === 'string' ? entity : entity.entity]?.state,
    );

    if (entitiesChanged) {
      this.updateEvents();
    }
  }

  /******************************************************************************
   * CONFIGURATION
   ******************************************************************************/

  /**
   * Update component configuration and render
   * Handles configuration changes and cache invalidation
   */
  setConfig(config: Partial<Types.Config>) {
    const previousConfig = this.config;
    this.config = { ...CalendarCardPro.DEFAULT_CONFIG, ...config };
    this.config.entities = Config.normalizeEntities(this.config.entities);

    // Generate deterministic instance ID based on data-affecting config
    this.instanceId = Helpers.generateDeterministicId(
      this.config.entities,
      this.config.days_to_show,
      this.config.show_past_events,
    );

    // Check if data-affecting configuration has changed
    const configChanged = Config.hasConfigChanged(previousConfig, this.config);

    if (configChanged) {
      Logger.info('Configuration changed, refreshing data');
      this.updateEvents(true); // Force refresh
    } else {
      this.renderCard(); // Just re-render with new styling
    }

    // Restart the refresh timer with the new configuration
    if (this.refreshTimer) {
      this.refreshTimer.start();
    }
  }

  /******************************************************************************
   * CACHE MANAGEMENT
   ******************************************************************************/

  invalidateCache() {
    const baseKey = EventUtils.getBaseCacheKey(
      this.instanceId,
      this.config.entities,
      this.config.days_to_show,
      this.config.show_past_events,
      this.config,
    );
    const keys = EventUtils.getAllCacheKeys(baseKey);
    EventUtils.invalidateCache(keys);
  }

  getAllCacheKeys() {
    const baseKey = this.getBaseCacheKey();
    return EventUtils.getAllCacheKeys(baseKey);
  }

  getCacheKey(): string {
    const baseKey = this.getBaseCacheKey();
    return EventUtils.getCacheKey(baseKey);
  }

  getBaseCacheKey() {
    const { entities, days_to_show, show_past_events } = this.config;
    return EventUtils.getBaseCacheKey(
      this.instanceId,
      entities,
      days_to_show,
      show_past_events,
      this.config,
    );
  }

  isValidState() {
    return EventUtils.isValidState(this._hass, this.config.entities);
  }

  /******************************************************************************
   * EVENT FETCHING & PROCESSING
   ******************************************************************************/

  /**
   * Fetches and updates calendar events from Home Assistant or cache
   *
   * @param force - Force refresh ignoring cache
   */
  async updateEvents(force = false): Promise<void> {
    // Use the new orchestration function
    await EventUtils.orchestrateEventUpdate({
      hass: this._hass,
      config: this.config,
      instanceId: this.instanceId,
      force,
      currentEvents: this.events,
      callbacks: {
        setLoading: (loading) => {
          this.isLoading = loading;
        },
        setEvents: (events) => {
          this.events = events;
        },
        updateLastUpdate: () => {
          this.performanceMetrics.lastUpdate = Date.now();
        },
        renderCallback: () => {
          this.renderCard();
        },
      },
    });
  }

  /******************************************************************************
   * ACTION HANDLING
   ******************************************************************************/

  /**
   * Handle user action (tap or hold) by delegating to the interaction module
   * @param actionConfig - Configuration for the action
   */
  handleAction(actionConfig: Types.ActionConfig) {
    // Get the primary entity ID
    const entityId = Interaction.getPrimaryEntityId(this.config.entities);

    // Call the action handler from the interaction module
    Interaction.handleAction(
      actionConfig,
      this._hass,
      this,
      entityId,
      // Pass a callback to handle expand action
      () => this.toggleExpanded(),
    );
  }

  /**
   * Toggles between compact and expanded view states
   * Only active when max_events_to_show is configured
   * @private
   */
  toggleExpanded() {
    if (this.config.max_events_to_show) {
      this.isExpanded = !this.isExpanded;
      this.renderCard();
    }
  }

  /******************************************************************************
   * EVENT PROCESSING
   ******************************************************************************/

  /**
   * Format event time based on event type and configuration
   * @param {Object} event Calendar event object
   * @returns {string} Formatted time string
   */
  formatEventTime(event: Types.CalendarEventData): string {
    return FormatUtils.formatEventTime(event, this.config, this.config.language);
  }

  /**
   * Calculate time window for event fetching
   * @returns {Object} Object containing start and end dates for the calendar window
   */
  getTimeWindow(): { start: Date; end: Date } {
    return EventUtils.getTimeWindow(this.config.days_to_show);
  }

  /******************************************************************************
   * RENDERING & DISPLAY
   ******************************************************************************/

  /**
   * Main rendering method that orchestrates the display of the calendar card
   */
  async renderCard() {
    // Use the performance tracker instead of direct function calls
    const metrics = this.performanceTracker.beginMeasurement(this.events.length);

    if (!this.isValidState()) {
      Render.renderErrorToDOM(this.shadowRoot!, 'error', this.config);
      this.performanceTracker.endMeasurement(metrics, this.performanceMetrics);
      return;
    }

    if (this.isLoading) {
      Render.renderErrorToDOM(this.shadowRoot!, 'loading', this.config);
      this.performanceTracker.endMeasurement(metrics, this.performanceMetrics);
      return;
    }

    const eventsByDay = EventUtils.groupEventsByDay(
      this.events,
      this.config,
      this.isExpanded,
      this.config.language,
    );

    if (eventsByDay.length === 0) {
      Render.renderErrorToDOM(this.shadowRoot!, 'empty', this.config);
      this.performanceTracker.endMeasurement(metrics, this.performanceMetrics);
      return;
    }

    try {
      // Get the calendar content using the render module
      const { container, style } = await Render.renderCalendarCard(
        this.config,
        eventsByDay,
        (event) => this.formatEventTime(event),
        (location) => this.formatLocation(location),
        Helpers.PERFORMANCE_CONSTANTS.CHUNK_SIZE,
        Helpers.PERFORMANCE_CONSTANTS.RENDER_DELAY,
      );

      // Clear the shadow DOM before adding new content
      DomUtils.clearShadowRoot(this.shadowRoot!);

      // Use our interaction module for styles and DOM structure
      const interactionStyles = Interaction.createInteractionStyles();

      // Create the layered DOM structure
      const {
        container: layeredContainer,
        bgLayer,
        rippleContainer,
        contentLayer,
      } = Interaction.createInteractionDom();

      // Move content from the original container to our content layer
      if (container instanceof HTMLElement) {
        Interaction.moveContentToLayer(container, contentLayer);
      }

      // Add layers to shadow DOM
      this.shadowRoot?.appendChild(interactionStyles);
      this.shadowRoot?.appendChild(style); // Original styles
      this.shadowRoot?.appendChild(layeredContainer);

      // Clean up previous listeners
      if (this.eventListenerCleanup) {
        this.eventListenerCleanup();
        this.eventListenerCleanup = null;
      }

      // Get primary entity ID for interactions
      const entityId = Interaction.getPrimaryEntityId(this.config.entities);

      // UPDATED: Use the complete interaction system
      this.eventListenerCleanup = Interaction.setupInteractions(
        layeredContainer,
        this.config,
        this._hass,
        entityId,
        () => this.toggleExpanded(),
      );
    } catch (error) {
      Logger.error('Render error:', error);
      Render.renderErrorToDOM(this.shadowRoot!, 'error', this.config);
    }

    this.performanceTracker.endMeasurement(metrics, this.performanceMetrics);
  }

  /**
   * Set up interaction handlers for the card using CSS custom properties
   * @param container - The container element to attach interactions to
   */
  private _setupCardInteractions(container: HTMLElement) {
    // Create direct interaction handler using CSS custom properties approach
    this._handlePointerDown = (ev: PointerEvent) => {
      // Create ripple effect using CSS custom properties
      this._createRippleEffectWithCustomProps(ev, container);

      // Set up timer for hold action if configured
      if (this.config.hold_action && this.config.hold_action.action !== 'none') {
        if (this.touchState.holdTimer !== null) {
          clearTimeout(this.touchState.holdTimer);
        }

        this.touchState.holdTriggered = false;
        this.touchState.holdTimer = window.setTimeout(() => {
          this.touchState.holdTriggered = true;
          this.handleAction(this.config.hold_action);
        }, 500);
      }

      // Set up pointer up and cancel handlers
      const handlePointerUp = (_upEv: PointerEvent) => {
        // Clear hold timer
        if (this.touchState.holdTimer !== null) {
          clearTimeout(this.touchState.holdTimer);
          this.touchState.holdTimer = null;
        }

        // Only trigger tap action if hold wasn't triggered
        if (!this.touchState.holdTriggered && this.config.tap_action) {
          this.handleAction(this.config.tap_action);
        }

        // Reset state
        this.touchState.holdTriggered = false;

        // Reset ripple effect after a short delay
        setTimeout(() => {
          this._resetRippleEffect(container);
        }, 300);

        // Remove temporary listeners
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerCancel);
      };

      const handlePointerCancel = () => {
        // Clear hold timer
        if (this.touchState.holdTimer !== null) {
          clearTimeout(this.touchState.holdTimer);
          this.touchState.holdTimer = null;
        }

        // Reset state
        this.touchState.holdTriggered = false;

        // Reset ripple immediately
        this._resetRippleEffect(container);

        // Remove temporary listeners
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerCancel);
      };

      // Add temporary global listeners to catch events outside element
      window.addEventListener('pointerup', handlePointerUp, { once: true });
      window.addEventListener('pointercancel', handlePointerCancel, { once: true });
    };

    // Attach the pointer down handler
    container.addEventListener('pointerdown', this._handlePointerDown);

    // Initialize ripple-related custom properties
    this._resetRippleEffect(container);
  }

  /**
   * Handle pointer down events and create ripple effect
   */
  private _handlePointerDown: (ev: PointerEvent) => void = () => {};

  /**
   * Create ripple effect using CSS custom properties with higher contrast
   */
  private _createRippleEffectWithCustomProps(ev: PointerEvent, container: HTMLElement) {
    Logger.info('Creating ripple effect with CSS vars', {
      x: ev.clientX,
      y: ev.clientY,
      element: container.tagName,
    });

    // Get element dimensions
    const rect = container.getBoundingClientRect();

    // Calculate position relative to container
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    // Calculate ripple size to cover container
    const size = Math.max(rect.width, rect.height) * 2.5;

    // Use darker ripple color for visibility against both light and dark backgrounds
    container.style.setProperty('--ripple-color', 'var(--primary-text-color, rgba(0,0,0,0.87))');

    // Set the CSS custom properties directly on the container
    container.style.setProperty('--ripple-x', `${x}px`);
    container.style.setProperty('--ripple-y', `${y}px`);
    container.style.setProperty('--ripple-size', `${size}px`);

    // Force reflow to ensure animation works
    container.offsetWidth;

    // Start animation with higher opacity for better visibility
    requestAnimationFrame(() => {
      // Higher opacity (0.35 instead of 0.2) for better visibility on solid backgrounds
      container.style.setProperty('--ripple-opacity', '0.35');
      container.style.setProperty('--ripple-scale', '1');
      Logger.info('Ripple animation properties set with enhanced visibility');
    });
  }

  /**
   * Reset ripple effect by zeroing out the CSS custom properties
   */
  private _resetRippleEffect(container: HTMLElement) {
    container.style.setProperty('--ripple-opacity', '0');
    container.style.setProperty('--ripple-scale', '0');
  }

  /**
   * Add navigation detection to connected callback
   */
  connectedCallback() {
    // ...existing code...

    // If we have saved interaction state, restore it
    if (this.shadowRoot) {
      const container = this.shadowRoot.querySelector('.card-container');
      if (container instanceof HTMLElement) {
        this._setupCardInteractions(container);
      }
    }

    // ...existing code...
  }

  /**
   * Handle and display different card states
   * @param {'loading' | 'empty' | 'error'} state - Current card state
   * @private
   */
  renderError(state: 'loading' | 'empty' | 'error') {
    Render.renderErrorToDOM(this.shadowRoot!, state, this.config);
  }

  /******************************************************************************
   * HTML GENERATION
   ******************************************************************************/

  generateCalendarContent(days: Types.EventsByDay[]): string {
    return Render.generateCalendarContent(
      days,
      this.config,
      (event) => this.formatEventTime(event),
      (location) => this.formatLocation(location),
    );
  }

  generateDayContent(day: Types.EventsByDay): string {
    return Render.generateDayContent(
      day,
      this.config,
      (event) => this.formatEventTime(event),
      (location) => this.formatLocation(location),
    );
  }

  /******************************************************************************
   * STYLING
   ******************************************************************************/

  getStyles(): string {
    return Styles.getStyles(this.config);
  }

  /******************************************************************************
   * UTILITY FUNCTIONS
   ******************************************************************************/

  /**
   * Debounce helper to limit function call frequency
   * @param {Function} func Function to debounce
   * @param {number} wait Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  debounce<T extends (...args: unknown[]) => void>(
    func: T,
    wait: number,
  ): (...args: Parameters<T>) => void {
    return Helpers.debounce(func, wait);
  }

  /**
   * Memoize helper for caching function results
   * @param {Function} func Function to memoize
   * @returns {Function} Memoized function
   */
  memoize<T extends readonly unknown[], R>(
    func: (...args: T) => R,
  ): ((...args: T) => R) & Types.MemoCache<R> {
    return Helpers.memoize(func, this);
  }

  /******************************************************************************
   * PERFORMANCE MONITORING
   ******************************************************************************/

  getAverageRenderTime() {
    return this.performanceTracker.getAverageRenderTime(this.performanceMetrics);
  }

  private handleError(error: unknown): void {
    Logger.logError(error);
  }

  /**
   * Set up ripple effects using our interaction module
   */
  private setupRippleEffects(container?: HTMLElement, rippleContainer?: HTMLElement) {
    // Find elements if not provided
    if (!container || !rippleContainer) {
      container = this.shadowRoot?.querySelector('.card-container') as HTMLElement;
      rippleContainer = this.shadowRoot?.querySelector('.card-ripple-container') as HTMLElement;
      if (!container || !rippleContainer) return;
    }

    // Use the new interaction module to set up ripple effects
    const cleanup = Interaction.setupRippleEffects(container, rippleContainer);

    // Keep track of the cleanup function
    if (this.eventListenerCleanup) {
      this.eventListenerCleanup();
    }

    // Create new handler for tap/hold actions
    const actionHandler = (ev: PointerEvent) => {
      // Set up timer for hold action if configured
      if (this.config.hold_action && this.config.hold_action.action !== 'none') {
        if (this.touchState.holdTimer !== null) {
          clearTimeout(this.touchState.holdTimer);
        }

        this.touchState.holdTriggered = false;
        this.touchState.holdTimer = window.setTimeout(() => {
          this.touchState.holdTriggered = true;

          // Create hold indicator using interaction module
          const holdIndicator = Interaction.createHoldIndicator(ev);

          // Execute hold action using interaction module
          this.handleAction(this.config.hold_action);

          // Remove hold indicator after animation
          setTimeout(() => {
            Interaction.removeHoldIndicator(holdIndicator);
          }, 300);
        }, 500);
      }

      // Set up pointer up handler
      const handlePointerUp = (_upEv: PointerEvent) => {
        // Clear hold timer
        if (this.touchState.holdTimer !== null) {
          clearTimeout(this.touchState.holdTimer);
          this.touchState.holdTimer = null;
        }

        // Only trigger tap action if hold wasn't triggered
        if (!this.touchState.holdTriggered && this.config.tap_action) {
          this.handleAction(this.config.tap_action);
        }

        // Reset state
        this.touchState.holdTriggered = false;

        // Remove temporary listeners
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerCancel);
      };

      const handlePointerCancel = () => {
        // Clear hold timer
        if (this.touchState.holdTimer !== null) {
          clearTimeout(this.touchState.holdTimer);
          this.touchState.holdTimer = null;
        }

        // Reset state
        this.touchState.holdTriggered = false;

        // Remove temporary listeners
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerCancel);
      };

      // Add temporary global listeners to catch events outside element
      window.addEventListener('pointerup', handlePointerUp, { once: true });
      window.addEventListener('pointercancel', handlePointerCancel, { once: true });
    };

    // Add event listener for action handling
    container.addEventListener('pointerdown', actionHandler);

    // Return cleanup function that combines all cleanup tasks
    this.eventListenerCleanup = () => {
      cleanup(); // Clean up ripple effects
      container?.removeEventListener('pointerdown', actionHandler);
      window.removeEventListener('location-changed', navigationListener);
    };

    // Add handler for navigation changes
    const navigationListener = () => {
      Logger.info('Location changed, restoring interactions');
      setTimeout(() => this.setupRippleEffects(), 100);
    };
    window.addEventListener('location-changed', navigationListener);
  }
}

/******************************************************************************
 * ELEMENT REGISTRATION
 ******************************************************************************/

// Register the custom element
customElements.define('calendar-card-pro-dev', CalendarCardPro);
customElements.define('calendar-card-pro-dev-editor', Editor.CalendarCardProEditor);

// Card registration for HACS and Home Assistant
(window as unknown as { customCards: Array<Types.CustomCard> }).customCards =
  (window as unknown as { customCards: Array<Types.CustomCard> }).customCards || [];

(window as unknown as { customCards: Array<Types.CustomCard> }).customCards.push({
  type: 'calendar-card-pro-dev',
  name: 'Calendar Card Pro',
  preview: true,
  description: 'A calendar card that supports multiple calendars with individual styling.',
  documentationURL: 'https://github.com/alexpfau/calendar-card-pro',
});
