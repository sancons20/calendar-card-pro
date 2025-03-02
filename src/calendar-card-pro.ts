/* eslint-disable import/order */
/**
 * Calendar Card Pro for Home Assistant
 *
 * This is the main entry point for the Calendar Card Pro custom card.
 * It orchestrates the different modules and handles the core web component lifecycle.
 *
 * @license MIT
 * @version 0.1.0
 */

// Import all types via namespace for cleaner imports
import * as Config from './config/config';
import * as Types from './config/types';
import * as Localize from './translations/localize';
import * as FormatUtils from './utils/format-utils';
import * as EventUtils from './utils/event-utils';
import * as ActionUtils from './utils/actions';
import * as Helpers from './utils/helpers';
import * as StateUtils from './utils/state-utils';
import * as Styles from './rendering/styles';
import * as Render from './rendering/render';
import * as DomUtils from './utils/dom-utils';
import * as ErrorUtils from './utils/error-utils';
import { CalendarCardProEditor } from './rendering/editor';

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
    'calendar-card-pro-dev-editor': CalendarCardProEditor;
  }

  // Add improved DOM interfaces
  interface HTMLElementEventMap {
    'hass-more-info': Types.HassMoreInfoEvent;
    'location-changed': Event;
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
  // Add explicit types for static properties
  private static _dateObjects: {
    now: Date;
    todayStart: Date;
    todayEnd: Date;
  };
  private static _countryNames: Set<string>;
  private readonly instanceId: string;
  private config!: Types.Config;
  private events: Types.CalendarEventData[] = [];
  private _hass: Types.Hass | null = null;
  private rendered = false;
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
  private readonly performanceMetrics: Readonly<Types.PerformanceData> = {
    renderTime: [],
    eventCount: 0,
    lastUpdate: Date.now(),
  };
  private readonly debouncedUpdate: () => void;
  private readonly memoizedFormatTime: (date: Date) => string & Types.MemoCache<string>;
  private readonly memoizedFormatLocation: (location: string) => string & Types.MemoCache<string>;
  private readonly cleanupInterval: number;
  private renderTimeout?: number;

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
   * PERFORMANCE CONSTANTS
   ******************************************************************************/

  private static readonly PERFORMANCE_THRESHOLDS = Helpers.PERFORMANCE_CONSTANTS;
  private static readonly CHUNK_SIZE = Helpers.PERFORMANCE_CONSTANTS.CHUNK_SIZE;
  private static readonly RENDER_DELAY = Helpers.PERFORMANCE_CONSTANTS.RENDER_DELAY;

  /******************************************************************************
   * STATIC HELPER METHODS
   ******************************************************************************/

  static get DATE_OBJECTS() {
    if (!this._dateObjects) {
      this._dateObjects = {
        now: new Date(),
        todayStart: new Date(),
        todayEnd: new Date(),
      };
    }
    return this._dateObjects;
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

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.instanceId = Helpers.generateInstanceId();
    this.initializeState();

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
  }

  disconnectedCallback() {
    clearInterval(this.cleanupInterval);
    this.cleanup();
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
    this.rendered = initialState.rendered;
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

  setConfig(config: Partial<Types.Config>) {
    const previousConfig = this.config;
    this.config = { ...CalendarCardPro.DEFAULT_CONFIG, ...config };
    this.config.entities = Config.normalizeEntities(this.config.entities);

    if (Config.hasConfigChanged(previousConfig, this.config)) {
      this.invalidateCache();
      this.updateEvents(true);
    } else {
      this.renderCard();
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
    // Set loading state if we don't already have events
    const wasEmpty = this.events.length === 0;
    if (wasEmpty) {
      this.isLoading = true;
      this.renderCard();
    }

    try {
      // Use the extracted update function
      const result = await EventUtils.updateCalendarEvents(
        this._hass,
        this.config,
        this.instanceId,
        force,
        this.events,
      );

      // Update component state with the result
      if (result.events) {
        this.events = result.events;
      }

      // Handle any errors that occurred
      if (result.error) {
        ErrorUtils.logError(result.error, 'Event update');
      }
    } finally {
      // Always update loading state and render
      this.isLoading = false;
      this.renderCard();
    }
  }

  /******************************************************************************
   * ACTION HANDLING
   ******************************************************************************/

  handleAction(actionConfig: Types.ActionConfig) {
    // Get the primary entity ID
    const entityId = ActionUtils.getPrimaryEntityId(this.config.entities);

    // Call the extracted action handler
    ActionUtils.handleAction(
      actionConfig,
      this._hass,
      this,
      entityId,
      // Pass a callback to handle expand action
      () => this.toggleExpanded(),
    );
  }

  fireMoreInfo() {
    const entityId = ActionUtils.getPrimaryEntityId(this.config.entities);
    ActionUtils.fireMoreInfo(this, entityId);
  }

  handleNavigation(actionConfig: Types.ActionConfig) {
    ActionUtils.handleNavigation(actionConfig);
  }

  callService(actionConfig: Types.ActionConfig) {
    if (this._hass) {
      ActionUtils.callService(this._hass, actionConfig);
    }
  }

  openUrl(actionConfig: Types.ActionConfig) {
    ActionUtils.openUrl(actionConfig);
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

  setupEventListeners(): void {
    const cardContainer = this.shadowRoot?.querySelector<HTMLDivElement>('.card-container');
    if (!cardContainer) return;

    // Get primary entity ID
    const entityId = ActionUtils.getPrimaryEntityId(this.config.entities);

    // Use the extracted setupEventListeners function
    ActionUtils.setupEventListeners(
      cardContainer,
      this.config.tap_action,
      this.config.hold_action,
      this._hass,
      this,
      entityId,
      () => this.toggleExpanded(),
    );
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
    const metrics = this.beginPerfMetrics();

    if (!this.isValidState()) {
      Render.renderErrorToDOM(this.shadowRoot!, 'error', this.config);
      this.endPerfMetrics(metrics);
      return;
    }

    if (this.isLoading) {
      Render.renderErrorToDOM(this.shadowRoot!, 'loading', this.config);
      this.endPerfMetrics(metrics);
      return;
    }

    // Get events grouped by day
    const eventsByDay = EventUtils.groupEventsByDay(
      this.events,
      this.config,
      this.isExpanded,
      this.config.language,
    );

    // Show empty state if we have no upcoming events
    if (eventsByDay.length === 0) {
      Render.renderErrorToDOM(this.shadowRoot!, 'empty', this.config);
      this.endPerfMetrics(metrics);
      return;
    }

    // Render the calendar card using the render module
    const { container, style } = await Render.renderCalendarCard(
      this.config,
      eventsByDay,
      (event) => this.formatEventTime(event),
      (location) => this.formatLocation(location),
      CalendarCardPro.CHUNK_SIZE,
      CalendarCardPro.RENDER_DELAY,
    );

    // Update shadow DOM
    DomUtils.clearShadowRoot(this.shadowRoot!);
    this.shadowRoot?.appendChild(style);
    this.shadowRoot?.appendChild(container);

    this.setupEventListeners();
    this.endPerfMetrics(metrics);
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

  /**
   * Performance monitoring utilities
   * @private
   */
  beginPerfMetrics(): Types.PerfMetrics {
    return Helpers.beginPerfMetrics(this.events.length);
  }

  /**
   * End performance measurement and process results
   * @param {Object} metrics Metrics object from beginPerfMetrics
   */
  endPerfMetrics(metrics: { startTime: number; eventCount: number }) {
    Helpers.endPerfMetrics(
      metrics,
      this.performanceMetrics,
      Helpers.PERFORMANCE_CONSTANTS.RENDER_TIME_THRESHOLD,
    );
  }

  getAverageRenderTime() {
    return Helpers.getAverageRenderTime(this.performanceMetrics);
  }

  private handleError(error: unknown): void {
    ErrorUtils.logError(error);
  }
}

/******************************************************************************
 * ELEMENT REGISTRATION
 ******************************************************************************/

// Register the custom element
customElements.define('calendar-card-pro-dev', CalendarCardPro);
customElements.define('calendar-card-pro-dev-editor', CalendarCardProEditor);

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
