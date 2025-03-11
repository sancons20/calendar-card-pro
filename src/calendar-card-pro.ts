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
import * as Constants from './config/constants';
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
  private interactionManager: {
    state: Interaction.InteractionState;
    container: HTMLElement | null;
    cleanup: (() => void) | null;
  } = {
    state: {
      holdTimer: null,
      holdTriggered: false,
      holdIndicator: null,
      activePointerId: null,
      pendingHoldAction: false,
      lastActionTime: 0,
      lastPointerEvent: null,
    },
    container: null,
    cleanup: null,
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

  /**
   * Enhanced disconnectedCallback to ensure complete cleanup
   * Prevents memory leaks and visual artifacts when navigating between views
   */
  disconnectedCallback() {
    // Clean up visibility handler
    if (this.visibilityCleanup) {
      this.visibilityCleanup();
      this.visibilityCleanup = undefined;
    }

    // Use the timer controller to stop the refresh timer
    if (this.refreshTimer) {
      this.refreshTimer.stop();
      this.refreshTimer = undefined;
    }

    clearInterval(this.cleanupInterval);
    this.cleanup();

    // Clean up interaction manager
    if (this.interactionManager.cleanup) {
      this.interactionManager.cleanup();
      this.interactionManager.cleanup = null;
    }

    // Reset sensitive state but maintain reference
    if (this.interactionManager.state.holdTimer) {
      clearTimeout(this.interactionManager.state.holdTimer);
      this.interactionManager.state.holdTimer = null;
    }

    // Make sure any remaining hold indicator is removed
    if (this.interactionManager.state.holdIndicator) {
      Logger.debug('Cleaning up orphaned hold indicator in disconnectedCallback');
      Interaction.removeHoldIndicator(this.interactionManager.state.holdIndicator);
      this.interactionManager.state.holdIndicator = null;
    }

    this.interactionManager.state.holdTriggered = false;
    this.interactionManager.state.pendingHoldAction = false;
    this.interactionManager.state.activePointerId = null;

    // Ensure all global hold indicators are cleaned up
    // This is a safety mechanism for any indicators that might have been orphaned
    Interaction.cleanupAllHoldIndicators();

    // Clear the shadow DOM completely to prevent memory leaks
    if (this.shadowRoot) {
      DomUtils.clearShadowRoot(this.shadowRoot);
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

  /**
   * Cleanup cache method - directly calls EventUtils
   */
  cleanupCache() {
    EventUtils.cleanupCache(Constants.CACHE.KEY_PREFIX, this.config);
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

  getAllCacheKeys() {
    const baseKey = this.getBaseCacheKey();
    return [baseKey];
  }

  getCacheKey(): string {
    return this.getBaseCacheKey();
  }

  getBaseCacheKey() {
    const { entities, days_to_show, show_past_events } = this.config;
    return EventUtils.getBaseCacheKey(this.instanceId, entities, days_to_show, show_past_events);
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

      // Add delay to allow ripple animation to complete before re-rendering
      setTimeout(() => this.renderCard(), Constants.TIMING.RIPPLE_ANIMATION); // Match ripple animation duration
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

  /******************************************************************************
   * RENDERING & DISPLAY
   ******************************************************************************/

  /**
   * Main rendering method that orchestrates the display of the calendar card
   */
  async renderCard() {
    // Use the performance tracker
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
      Logger.debug('Creating card structure');

      // Get the calendar content using the render module
      const { container: contentContainer, style } = await Render.renderCalendarCard(
        this.config,
        eventsByDay,
        (event) => this.formatEventTime(event),
        (location) => this.formatLocation(location),
        Constants.PERFORMANCE.CHUNK_SIZE,
        Constants.PERFORMANCE.RENDER_DELAY,
      );

      // Clean up any previous interaction handlers
      if (this.interactionManager.cleanup) {
        this.interactionManager.cleanup();
        this.interactionManager.cleanup = null;
      }

      // Clear the shadow DOM before adding new content
      DomUtils.clearShadowRoot(this.shadowRoot!);

      // Get primary entity ID for interactions
      const entityId = Interaction.getPrimaryEntityId(this.config.entities);

      // Create container with proper structure
      const container = document.createElement('div');
      container.className = 'card-container';
      container.setAttribute('role', 'button');
      container.setAttribute('tabindex', '0');

      // Create our ripple element
      const ripple = document.createElement('calendar-ripple');

      // Create content container
      const content = document.createElement('div');
      content.className = 'card-content';

      // Move content from the render container to our content element
      if (contentContainer instanceof HTMLElement) {
        while (contentContainer.firstChild) {
          content.appendChild(contentContainer.firstChild);
        }
      }

      // Add the ripple first, then content to create proper layering
      container.appendChild(ripple);
      container.appendChild(content);

      // Add styles and container to shadow DOM
      this.shadowRoot?.appendChild(style);
      this.shadowRoot?.appendChild(container);

      // Store container reference for later
      this.interactionManager.container = container;

      // Set up action handler for ripple events and hold detection
      const setupActions = () => {
        // Event handler for mdw:action events (clicks from ripple)
        const handleAction = (_ev: CustomEvent) => {
          if (!this._hass) return;

          // Only handle click events if hold wasn't triggered
          if (!this.interactionManager.state.holdTriggered && this.config.tap_action) {
            Logger.debug('Executing tap action from mdw:action event');
            Interaction.handleAction(this.config.tap_action, this._hass, container, entityId, () =>
              this.toggleExpanded(),
            );
          }

          // Reset hold state after any action
          this.interactionManager.state.holdTriggered = false;
        };

        // Add event listener for mdw:action events from ripple
        container.addEventListener('mdw:action', handleAction as EventListener);

        // Attach ripple to container
        if (ripple instanceof HTMLElement && 'attach' in ripple) {
          (ripple as any).attach(container);
        }

        // Set up hold detection using pointer events
        let holdTimer: number | null = null;
        let activePointerId: number | null = null;

        // Handle pointer down - start hold timer
        const handlePointerDown = (ev: PointerEvent) => {
          // Track this pointer
          activePointerId = ev.pointerId;
          this.interactionManager.state.holdTriggered = false;

          // Only set up hold timer if hold action is configured
          if (this.config.hold_action?.action !== 'none') {
            // Clear any existing timer
            if (holdTimer) {
              clearTimeout(holdTimer);
            }

            // Start hold timer
            holdTimer = window.setTimeout(() => {
              if (activePointerId === ev.pointerId) {
                Logger.debug('Hold threshold reached');
                this.interactionManager.state.holdTriggered = true;

                // Create hold indicator
                this.interactionManager.state.holdIndicator = Interaction.createHoldIndicator(ev);
              }
            }, Constants.TIMING.HOLD_THRESHOLD);
          }
        };

        // Handle pointer up - check if hold was triggered
        const handlePointerUp = (ev: PointerEvent) => {
          // Only process if this is the tracked pointer
          if (activePointerId !== ev.pointerId) return;

          // Clear hold timer
          if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }

          // Reset pointer tracking
          activePointerId = null;

          // If hold was triggered, handle hold action
          if (this.interactionManager.state.holdTriggered && this.config.hold_action) {
            Logger.debug('Executing hold action on pointer up');
            Interaction.handleAction(
              this.config.hold_action,
              this._hass!,
              container,
              entityId,
              () => this.toggleExpanded(),
            );
          }

          // Remove hold indicator if it exists
          if (this.interactionManager.state.holdIndicator) {
            Interaction.removeHoldIndicator(this.interactionManager.state.holdIndicator);
            this.interactionManager.state.holdIndicator = null;
          }
        };

        // Handle pointer cancel
        const handlePointerCancel = () => {
          // Clear hold timer
          if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }

          // Reset tracking state
          activePointerId = null;
          this.interactionManager.state.holdTriggered = false;

          // Remove hold indicator if it exists
          if (this.interactionManager.state.holdIndicator) {
            Interaction.removeHoldIndicator(this.interactionManager.state.holdIndicator);
            this.interactionManager.state.holdIndicator = null;
          }
        };

        // Handle pointer leave - clean up hold state when pointer leaves the card
        const handlePointerLeave = () => {
          // Clear hold timer
          if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }

          // Reset tracking state
          activePointerId = null;
          this.interactionManager.state.holdTriggered = false;

          // Remove hold indicator if it exists
          if (this.interactionManager.state.holdIndicator) {
            Logger.debug('Removing hold indicator on pointer leave');
            Interaction.removeHoldIndicator(this.interactionManager.state.holdIndicator);
            this.interactionManager.state.holdIndicator = null;
          }
        };

        // Add pointer event listeners
        container.addEventListener('pointerdown', handlePointerDown);
        container.addEventListener('pointerup', handlePointerUp);
        container.addEventListener('pointercancel', handlePointerCancel);
        container.addEventListener('pointerleave', handlePointerLeave);

        // Add support for keyboard interactions (accessibility)
        const handleKeyDown = (ev: KeyboardEvent) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            // Use the tap action for keyboard events
            if (this.config.tap_action) {
              Interaction.handleAction(
                this.config.tap_action,
                this._hass!,
                container,
                entityId,
                () => this.toggleExpanded(),
              );
            }
          }
        };
        container.addEventListener('keydown', handleKeyDown);

        // Return cleanup function
        return () => {
          container.removeEventListener('mdw:action', handleAction as EventListener);
          container.removeEventListener('keydown', handleKeyDown);
          container.removeEventListener('pointerdown', handlePointerDown);
          container.removeEventListener('pointerup', handlePointerUp);
          container.removeEventListener('pointercancel', handlePointerCancel);
          container.removeEventListener('pointerleave', handlePointerLeave);

          // Clear any active timers
          if (holdTimer) {
            clearTimeout(holdTimer);
          }

          // Clean up hold indicator if it exists
          if (this.interactionManager.state.holdIndicator) {
            Interaction.removeHoldIndicator(this.interactionManager.state.holdIndicator);
            this.interactionManager.state.holdIndicator = null;
          }

          if (ripple instanceof HTMLElement && 'detach' in ripple) {
            (ripple as any).detach();
          }
        };
      };

      // Setup and store the cleanup function
      this.interactionManager.cleanup = setupActions();
    } catch (error) {
      Logger.error('Render error:', error);
      Render.renderErrorToDOM(this.shadowRoot!, 'error', this.config);
    }

    this.performanceTracker.endMeasurement(metrics, this.performanceMetrics);
  }

  /**
   * Add navigation detection to connected callback
   * Enhanced to properly restore state after navigation
   */
  connectedCallback() {
    Logger.debug('Connected callback called - checking if rendering needed');

    // Check if we have content in the shadow DOM
    const hasContent = this.shadowRoot?.childElementCount && this.shadowRoot.childElementCount > 0;

    if (!hasContent && this._hass) {
      // No content, but we have hass - likely returning from navigation
      Logger.debug('No content found after navigation - triggering render');
      this.renderCard();
      return;
    }

    // The rest of the original connectedCallback logic for interaction restoration
    if (this.interactionManager.container && !this.interactionManager.cleanup) {
      // Find our ripple element
      const ripple = this.interactionManager.container.querySelector('calendar-ripple');
      const entityId = Interaction.getPrimaryEntityId(this.config.entities);
      const container = this.interactionManager.container;

      if (ripple) {
        // Set up hold detection using pointer events
        let holdTimer: number | null = null;
        let activePointerId: number | null = null;

        // Handle pointer down - start hold timer
        const handlePointerDown = (ev: PointerEvent) => {
          // Track this pointer
          activePointerId = ev.pointerId;
          this.interactionManager.state.holdTriggered = false;

          // Only set up hold timer if hold action is configured
          if (this.config.hold_action?.action !== 'none') {
            // Clear any existing timer
            if (holdTimer) {
              clearTimeout(holdTimer);
            }

            // Start hold timer
            holdTimer = window.setTimeout(() => {
              if (activePointerId === ev.pointerId) {
                Logger.debug('Hold threshold reached in connectedCallback');
                this.interactionManager.state.holdTriggered = true;

                // Create hold indicator
                this.interactionManager.state.holdIndicator = Interaction.createHoldIndicator(ev);
              }
            }, Constants.TIMING.HOLD_THRESHOLD);
          }
        };

        // Handle pointer up - check if hold was triggered
        const handlePointerUp = (ev: PointerEvent) => {
          // Only process if this is the tracked pointer
          if (activePointerId !== ev.pointerId) return;

          // Clear hold timer
          if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }

          // Reset pointer tracking
          activePointerId = null;

          // If hold was triggered, handle hold action
          if (this.interactionManager.state.holdTriggered && this.config.hold_action) {
            Logger.debug('Executing hold action from connectedCallback');
            Interaction.handleAction(
              this.config.hold_action,
              this._hass!,
              container,
              entityId,
              () => this.toggleExpanded(),
            );
          }

          // Remove hold indicator if it exists
          if (this.interactionManager.state.holdIndicator) {
            Interaction.removeHoldIndicator(this.interactionManager.state.holdIndicator);
            this.interactionManager.state.holdIndicator = null;
          }
        };

        // Handle pointer cancel
        const handlePointerCancel = () => {
          // Clear hold timer
          if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }

          // Reset tracking state
          activePointerId = null;
          this.interactionManager.state.holdTriggered = false;

          // Remove hold indicator if it exists
          if (this.interactionManager.state.holdIndicator) {
            Interaction.removeHoldIndicator(this.interactionManager.state.holdIndicator);
            this.interactionManager.state.holdIndicator = null;
          }
        };

        // Handle pointer leave - clean up hold state when pointer leaves the card
        const handlePointerLeave = () => {
          // Clear hold timer
          if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }

          // Reset tracking state
          activePointerId = null;
          this.interactionManager.state.holdTriggered = false;

          // Remove hold indicator if it exists
          if (this.interactionManager.state.holdIndicator) {
            Logger.debug('Removing hold indicator on pointer leave');
            Interaction.removeHoldIndicator(this.interactionManager.state.holdIndicator);
            this.interactionManager.state.holdIndicator = null;
          }
        };

        // Set up action handler for mdw:action events (clicks)
        const handleAction = (_ev: CustomEvent) => {
          if (!this._hass) return;

          // Only handle click events if hold wasn't triggered
          if (!this.interactionManager.state.holdTriggered && this.config.tap_action) {
            Interaction.handleAction(this.config.tap_action, this._hass, container, entityId, () =>
              this.toggleExpanded(),
            );
          }

          // Reset hold state after any action
          this.interactionManager.state.holdTriggered = false;
        };

        // Add event listeners
        container.addEventListener('mdw:action', handleAction as EventListener);
        container.addEventListener('pointerdown', handlePointerDown);
        container.addEventListener('pointerup', handlePointerUp);
        container.addEventListener('pointercancel', handlePointerCancel);
        container.addEventListener('pointerleave', handlePointerLeave);

        // Re-attach ripple
        if ('attach' in ripple) {
          (ripple as any).attach(container);
        }

        // Store cleanup function
        this.interactionManager.cleanup = () => {
          container.removeEventListener('mdw:action', handleAction as EventListener);
          container.removeEventListener('pointerdown', handlePointerDown);
          container.removeEventListener('pointerup', handlePointerUp);
          container.removeEventListener('pointercancel', handlePointerCancel);
          container.removeEventListener('pointerleave', handlePointerLeave);

          // Clear any active timers
          if (holdTimer) {
            clearTimeout(holdTimer);
          }

          // Clean up hold indicator if it exists
          if (this.interactionManager.state.holdIndicator) {
            Interaction.removeHoldIndicator(this.interactionManager.state.holdIndicator);
            this.interactionManager.state.holdIndicator = null;
          }

          if ('detach' in ripple) {
            (ripple as any).detach();
          }
        };

        Logger.debug('Restored interaction handlers with hold support in connectedCallback');
      }
    }
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
