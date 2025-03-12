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
 * @author Alex Pfau
 * @license MIT
 * @version 1.0.0
 */

// Import all types via namespace for cleaner imports
import * as Config from './config/config';
import * as Constants from './config/constants';
import * as Types from './config/types';
import * as Localize from './translations/localize';
import * as FormatUtils from './utils/format-utils';
import * as EventUtils from './utils/event-utils';
import * as Interaction from './utils/interaction';
import * as Helpers from './utils/helpers';
import * as StateUtils from './utils/state-utils';
import * as Render from './rendering/render';
import * as DomUtils from './utils/dom-utils';
import * as Logger from './utils/logger-utils';
import * as Editor from './rendering/editor';
import './utils/calendar-ripple';

// Export VERSION from constants for backward compatibility
export const VERSION = Constants.VERSION.CURRENT;

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
  private isLoading = true;
  private isExpanded = false;
  private performanceMetrics: Types.PerformanceData = {
    renderTime: [],
    eventCount: 0,
    lastUpdate: Date.now(),
  };

  // These properties will be initialized in the constructor
  private debouncedUpdate: () => void;
  private memoizedFormatTime: (date: Date) => string & Types.MemoCache<string>;
  private memoizedFormatLocation: (location: string) => string & Types.MemoCache<string>;
  private cleanupInterval: number;
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
  private interactionManager: {
    state: Interaction.InteractionState;
    container: HTMLElement | null;
    cleanup: (() => void) | null;
  };

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
    // Initialize basic component state
    const initialState = StateUtils.initializeState();
    this.config = initialState.config;
    this.events = initialState.events;
    this._hass = initialState.hass;
    this.isLoading = initialState.isLoading;
    this.isExpanded = initialState.isExpanded;

    // Set up lifecycle and controllers
    const lifecycle = StateUtils.setupComponentLifecycle(this);

    // Store lifecycle components
    this.performanceTracker = lifecycle.performanceTracker;
    this.visibilityCleanup = lifecycle.visibilityCleanup;
    this.refreshTimer = lifecycle.refreshTimer;
    this.cleanupInterval = lifecycle.cleanupInterval;
    this.debouncedUpdate = lifecycle.debouncedUpdate;
    this.memoizedFormatTime = lifecycle.memoizedFormatTime;
    this.memoizedFormatLocation = lifecycle.memoizedFormatLocation;
    this.interactionManager = lifecycle.interactionManager;
  }

  /**
   * Enhanced disconnectedCallback to ensure complete cleanup
   * Using the centralized state-utils cleanup function
   */
  disconnectedCallback() {
    StateUtils.cleanupComponent(this);
  }

  /**
   * Add navigation detection to connected callback
   * Enhanced to properly restore state after navigation
   */
  connectedCallback() {
    StateUtils.handleConnectedCallback(this);
  }

  /******************************************************************************
   * STATE MANAGEMENT
   ******************************************************************************/

  initializeState() {
    const initialState = StateUtils.initializeState();
    this.config = initialState.config;
    this.events = initialState.events;
    this._hass = initialState.hass;
    this.isLoading = initialState.isLoading;
    this.isExpanded = initialState.isExpanded;
  }

  /**
   * Improved cleanup method with explicit cache clearing and hold indicator cleanup
   */
  cleanup() {
    // Clear render timeout if any
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
      this.renderTimeout = undefined;
    }

    // Clear memoization caches - fix the TypeScript error by using type assertion
    if (this.memoizedFormatTime && 'cache' in this.memoizedFormatTime) {
      (this.memoizedFormatTime as unknown as { cache: Map<string, any> }).cache?.clear();
    }

    if (this.memoizedFormatLocation && 'cache' in this.memoizedFormatLocation) {
      (this.memoizedFormatLocation as unknown as { cache: Map<string, any> }).cache?.clear();
    }

    // Ensure any hold indicators are cleaned up
    if (this.interactionManager.state.holdIndicator) {
      Logger.debug('Cleaning up hold indicator in cleanup method');
      Interaction.removeHoldIndicator(this.interactionManager.state.holdIndicator);
      this.interactionManager.state.holdIndicator = null;
    }

    // Call StateUtils cleanup as a fallback
    StateUtils.cleanup(
      this.renderTimeout,
      this.memoizedFormatTime as unknown as Types.MemoCache<string>,
      this.memoizedFormatLocation as unknown as Types.MemoCache<string>,
    );
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

    // Check if data-affect configuration has changed
    const configChanged = Config.hasConfigChanged(previousConfig, this.config);

    // Check if only entity colors changed (requires re-render but not data refresh)
    const colorChanged = Config.haveEntityColorsChanged(previousConfig, this.config);

    if (configChanged) {
      Logger.debug('Configuration changed, refreshing data');
      this.updateEvents(true); // Force refresh
    } else if (colorChanged) {
      // If only entity colors changed, just re-render without data refresh
      Logger.debug('Entity colors changed, re-rendering without data refresh');
      this.renderCard();
    } else {
      // Re-render with new styling for other changes
      this.renderCard();
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
    );
    EventUtils.invalidateCache([baseKey]);
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

      // Add delay to allow ripple animation to complete before re-rendering
      setTimeout(() => this.renderCard(), Constants.TIMING.RIPPLE_ANIMATION);
    }
  }

  /******************************************************************************
   * RENDERING & DISPLAY
   ******************************************************************************/

  /**
   * Main rendering method that orchestrates the display of the calendar card
   */
  async renderCard() {
    // Use the performance tracker
    const metrics = this.performanceTracker.beginMeasurement(this.events.length);

    if (!EventUtils.isValidState(this._hass, this.config.entities)) {
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
      Logger.debug('Creating card structure');

      // Get the calendar content using the render module
      const { container: contentContainer, style } = await Render.renderCalendarCard(
        this.config,
        eventsByDay,
        (event) => FormatUtils.formatEventTime(event, this.config, this.config.language),
        (location) => FormatUtils.formatLocation(location, this.config.remove_location_country),
        Constants.PERFORMANCE.CHUNK_SIZE,
        Constants.PERFORMANCE.RENDER_DELAY,
      );

      // Clean up any previous interaction handlers
      if (this.interactionManager.cleanup) {
        this.interactionManager.cleanup();
        this.interactionManager.cleanup = null;
      }

      // Use DOM utilities to create card structure
      const { container, ripple } = DomUtils.createCardStructure(contentContainer);

      // Update shadow DOM with the new structure
      DomUtils.updateCardInShadowDOM(this.shadowRoot!, container, style);

      // Store container reference for later
      this.interactionManager.container = container;

      // Get primary entity ID for interactions
      const entityId = Interaction.getPrimaryEntityId(this.config.entities);

      // Set up interactions using our new module
      this.interactionManager.cleanup = Interaction.setupInteractions(
        this.config,
        container,
        this._hass,
        entityId,
        () => this.toggleExpanded(),
        ripple,
      );
    } catch (error) {
      Logger.error('Render error:', error);
      Render.renderErrorToDOM(this.shadowRoot!, 'error', this.config);
    }

    this.performanceTracker.endMeasurement(metrics, this.performanceMetrics);
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
