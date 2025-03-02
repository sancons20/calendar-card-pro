/* eslint-disable import/order */
/**
 * Calendar Card Pro for Home Assistant
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
import * as Styles from './rendering/styles';
import * as Render from './rendering/render';
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

// Make class properties more strictly typed
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
   * Imported from config/config.ts
   ******************************************************************************/

  static get DEFAULT_CONFIG(): Types.Config {
    return Config.DEFAULT_CONFIG;
  }

  /******************************************************************************
   * TRANSLATIONS
   * Imported from translations/localize.ts
   ******************************************************************************/

  static get TRANSLATIONS(): Readonly<Record<string, Types.Translations>> {
    return Localize.TRANSLATIONS;
  }

  /******************************************************************************
   * PERFORMANCE CONSTANTS
   * Moved to utils/helpers.ts
   ******************************************************************************/

  private static readonly PERFORMANCE_THRESHOLDS = Helpers.PERFORMANCE_CONSTANTS;
  private static readonly CHUNK_SIZE = Helpers.PERFORMANCE_CONSTANTS.CHUNK_SIZE;
  private static readonly RENDER_DELAY = Helpers.PERFORMANCE_CONSTANTS.RENDER_DELAY;

  /******************************************************************************
   * STATIC HELPER METHODS
   * Will be moved to utils/helpers.ts
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
   * Will be moved to utils/event-utils.ts
   ******************************************************************************/

  static findCalendarEntity(hass: Types.Hass): string | null {
    return Config.findCalendarEntity(hass.states);
  }

  /******************************************************************************
   * CONFIG UTILITIES
   * Imported from config/config.ts
   ******************************************************************************/

  static getStubConfig(hass: Types.Hass) {
    return Config.getStubConfig(hass.states);
  }

  static get displayName() {
    return 'Calendar Card Pro';
  }

  /******************************************************************************
   * LIFECYCLE METHODS
   * Will be moved to calendar-card-pro.ts (kept in main file)
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
   * Moved to utils/format-utils.ts
   ******************************************************************************/

  formatLocation(location: string): string {
    return FormatUtils.formatLocation(location, this.config.remove_location_country);
  }

  /******************************************************************************
   * STATE MANAGEMENT
   * Will be moved to utils/state-utils.ts
   ******************************************************************************/

  initializeState() {
    this.config = {} as Types.Config;
    this.events = [];
    this._hass = null;
    this.rendered = false;
    this.touchState = {
      touchStartY: 0,
      touchStartX: 0,
      holdTimer: null,
      holdTriggered: false,
    };
    this.isLoading = true;
    this.isExpanded = false;
  }

  cleanup() {
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }
    (this.memoizedFormatTime as unknown as Types.MemoCache<string>).cache.clear();
    (this.memoizedFormatLocation as unknown as Types.MemoCache<string>).cache.clear();
  }

  cleanupCache() {
    const cachePrefix = `calendar_${this.config.entities.join('_')}`;
    EventUtils.cleanupCache(cachePrefix);
  }

  get translations() {
    const lang = this.config.language || 'en';
    return Localize.getTranslations(lang);
  }

  /******************************************************************************
   * HOME ASSISTANT INTEGRATION
   * Will be moved to utils/event-utils.ts
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
   * Using functions from config/config.ts
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

  normalizeEntities(entities: Array<string | { entity: string; color?: string }>) {
    if (!Array.isArray(entities)) {
      return [];
    }

    return entities
      .map((item) => {
        if (typeof item === 'string') {
          return {
            entity: item,
            color: 'var(--primary-text-color)',
          };
        }
        if (typeof item === 'object' && item.entity) {
          return {
            entity: item.entity,
            color: item.color || 'var(--primary-text-color)',
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{ entity: string; color: string }>;
  }

  hasEntitiesChanged(
    previous: Array<string | { entity: string; color?: string }>,
    current: Array<string | { entity: string; color?: string }>,
  ) {
    if (previous.length !== current.length) return true;
    return previous.some((entity, index) => entity !== current[index]);
  }

  hasConfigChanged(previous: Types.Config, current: Types.Config) {
    if (!previous) return true;

    const relevantKeys = ['entities', 'days_to_show', 'show_past_events', 'update_interval'];

    return relevantKeys.some(
      (key) => JSON.stringify(previous[key]) !== JSON.stringify(current[key]),
    );
  }

  /******************************************************************************
   * CACHE MANAGEMENT
   * Will be moved to utils/state-utils.ts
   ******************************************************************************/

  invalidateCache() {
    const cacheKeys = this.getAllCacheKeys();
    EventUtils.invalidateCache(cacheKeys);
  }

  getAllCacheKeys() {
    const keys: string[] = [];
    const baseKey = this.getBaseCacheKey();

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    [now, yesterday].forEach((date) => {
      keys.push(`${baseKey}_${date.toDateString()}`);
    });

    return keys;
  }

  getCacheKey(): string {
    return `${this.getBaseCacheKey()}_${new Date().toDateString()}`;
  }

  getBaseCacheKey() {
    const { entities, days_to_show, show_past_events } = this.config;
    const configHash = Helpers.hashConfig(this.config);
    return `calendar_${this.instanceId}_${entities.join(
      '_',
    )}_${days_to_show}_${show_past_events}_${configHash}`;
  }

  isValidState() {
    return EventUtils.isValidState(this._hass, this.config.entities);
  }

  /******************************************************************************
   * EVENT FETCHING & PROCESSING
   * Moved to utils/event-utils.ts
   ******************************************************************************/

  async updateEvents(force = false): Promise<void> {
    if (!this.isValidState()) return;

    const cacheKey = this.getCacheKey();
    const cacheDuration = (this.config.update_interval || 300) * 1000;

    const cachedData = !force && EventUtils.getCachedEvents(cacheKey, cacheDuration);
    if (cachedData) {
      this.events = [...cachedData];
      this.renderCard();
      return;
    }

    this.isLoading = true;
    this.renderCard();

    try {
      // Convert string entities to EntityConfig objects for EventUtils
      const entities = this.config.entities.map((entity) => {
        return typeof entity === 'string' ? { entity, color: 'var(--primary-text-color)' } : entity;
      });

      const timeWindow = EventUtils.getTimeWindow(this.config.days_to_show);
      const events = await EventUtils.fetchEvents(this._hass!, entities, timeWindow);
      this.events = [...events];
      EventUtils.cacheEvents(cacheKey, events);
    } catch (error: unknown) {
      if (this.events.length === 0) {
        // Try to fetch at least today's events as fallback
        const firstEntity =
          typeof this.config.entities[0] === 'string'
            ? this.config.entities[0]
            : this.config.entities[0].entity;

        const partialEvents = await EventUtils.fetchTodayEvents(this._hass!, firstEntity);
        this.events = partialEvents ? [...partialEvents] : [];
      }
      this.handleError(error);
    } finally {
      this.isLoading = false;
      this.renderCard();
    }
  }

  /******************************************************************************
   * ACTION HANDLING
   * Moved to utils/actions.ts
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
   * Will be moved to utils/event-utils.ts
   ******************************************************************************/

  /**
   * Process calendar events and group them by day
   * When max_events_to_show is set and card is not expanded,
   * limits the total number of events shown across all days
   * @returns {Array<Types.EventsByDay>} Array of day objects containing grouped events
   */
  groupEventsByDay() {
    return EventUtils.groupEventsByDay(
      this.events,
      this.config,
      this.isExpanded,
      this.config.language,
    );
  }

  /**
   * Format event time based on event type and configuration
   * Handles all-day events, multi-day events, and time formats
   * @param {Object} event Calendar event object
   * @returns {string} Formatted time string
   */
  formatEventTime(event: Types.CalendarEventData) {
    return FormatUtils.formatEventTime(event, this.config, this.config.language);
  }

  formatMultiDayAllDayTime(endDate: Date) {
    return FormatUtils.formatMultiDayAllDayTime(endDate, this.config.language);
  }

  formatMultiDayTime(startDate: Date, endDate: Date) {
    return FormatUtils.formatMultiDayTime(startDate, endDate, this.config, this.config.language);
  }

  formatSingleDayTime(startDate: Date, endDate: Date) {
    return FormatUtils.formatSingleDayTime(startDate, endDate, this.config);
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
   * Render calendar card content progressively to optimize performance
   * Uses chunking to avoid blocking the main thread
   * @param {Array} days Array of day objects to render
   * @returns {DocumentFragment} Fragment containing rendered content
   */
  async renderProgressively(days: Types.EventsByDay[]): Promise<DocumentFragment> {
    return Render.renderProgressively(
      days,
      this.config,
      (event) => this.formatEventTime(event),
      (location) => this.formatLocation(location),
      CalendarCardPro.CHUNK_SIZE,
      CalendarCardPro.RENDER_DELAY,
    );
  }

  async renderCard() {
    const metrics = this.beginPerfMetrics();
    if (!this.isValidState()) {
      this.renderError('error');
      this.endPerfMetrics(metrics);
      return;
    }

    // Changed condition to check isLoading
    if (this.isLoading) {
      this.renderError('loading');
      this.endPerfMetrics(metrics);
      return;
    }

    // Call the extracted utility function
    const eventsByDay = EventUtils.groupEventsByDay(
      this.events,
      this.config,
      this.isExpanded,
      this.config.language,
    );

    // Show empty state if we have no upcoming events
    if (eventsByDay.length === 0) {
      this.renderError('empty');
      this.endPerfMetrics(metrics);
      return;
    }

    const container = document.createElement('div');
    container.className = 'card-container';

    const content = document.createElement('div');
    content.className = 'card-content';

    if (this.config.title) {
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = this.config.title;
      content.appendChild(title);
    }

    const calendarContent = await this.renderProgressively(eventsByDay);
    content.appendChild(calendarContent);

    container.appendChild(content);

    const style = document.createElement('style');
    style.textContent = this.getStyles();

    // Update shadow DOM
    while (this.shadowRoot?.firstChild) {
      this.shadowRoot.removeChild(this.shadowRoot.firstChild);
    }

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
    const result = Render.renderErrorState(state, this.config);

    // Clear shadow DOM
    while (this.shadowRoot?.firstChild) {
      this.shadowRoot.removeChild(this.shadowRoot.firstChild);
    }

    // Check which type of result we got back
    if ('container' in result && 'style' in result) {
      // Handle DOM element result
      this.shadowRoot?.appendChild(result.style);
      this.shadowRoot?.appendChild(result.container);
    } else {
      // Handle HTML string result
      this.shadowRoot!.innerHTML = `
        <style>${result.styleText}</style>
        ${result.html}
      `;
    }
  }

  /******************************************************************************
   * HTML GENERATION
   * Moved to rendering/render.ts
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
   * Moved to rendering/styles.ts
   ******************************************************************************/

  getStyles(): string {
    return Styles.getStyles(this.config);
  }

  /******************************************************************************
   * UTILITY FUNCTIONS
   * Will be moved to utils/helpers.ts
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
   * Moved to utils/helpers.ts
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
    Helpers.handleError(error);
  }
}

/******************************************************************************
 * EDITOR COMPONENT
 * Moved to rendering/editor.ts
 ******************************************************************************/

// Editor class has been moved to rendering/editor.ts and is now imported

/******************************************************************************
 * ELEMENT REGISTRATION
 * Will be kept in calendar-card-pro.ts (main entry point)
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
