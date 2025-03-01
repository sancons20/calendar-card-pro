/**
 * Calendar Card Pro for Home Assistant
 *
 * @license MIT
 * @version 0.1.0
 */

// Import all types via namespace for cleaner imports
import * as Types from './config/types';
import * as Config from './config/config';

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
   * Will be moved to translations/languages/*.json
   ******************************************************************************/

  static get TRANSLATIONS(): Readonly<Record<string, Types.Translations>> {
    return {
      en: {
        daysOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        fullDaysOfWeek: [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ],
        months: [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ],
        allDay: 'all-day',
        multiDay: 'until',
        at: 'at',
        noEvents: 'No upcoming events',
        loading: 'Loading calendar events...',
        error: 'Error: Calendar entity not found or improperly configured',
      },
      de: {
        daysOfWeek: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
        fullDaysOfWeek: [
          'Sonntag',
          'Montag',
          'Dienstag',
          'Mittwoch',
          'Donnerstag',
          'Freitag',
          'Samstag',
        ],
        months: [
          'Jan',
          'Feb',
          'Mär',
          'Apr',
          'Mai',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Okt',
          'Nov',
          'Dez',
        ],
        allDay: 'ganztägig',
        multiDay: 'bis',
        at: 'um',
        noEvents: 'Keine anstehenden Termine',
        loading: 'Kalendereinträge werden geladen...',
        error: 'Fehler: Kalender-Entity nicht gefunden oder falsch konfiguriert',
      },
    };
  }

  /******************************************************************************
   * PERFORMANCE CONSTANTS
   * Will be moved to utils/helpers.ts
   ******************************************************************************/

  private static readonly PERFORMANCE_THRESHOLDS = {
    RENDER_TIME: 100,
    CHUNK_SIZE: 10,
    RENDER_DELAY: 50,
  } as const;

  private static readonly CHUNK_SIZE = 10;
  private static readonly RENDER_DELAY = 50;

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
    this.instanceId = Math.random().toString(36).substring(2, 15);
    this.initializeState();

    this.debouncedUpdate = this.debounce(() => this.updateEvents(), 300);
    this.memoizedFormatTime = this.memoize(this.formatTime) as unknown as (
      date: Date,
    ) => string & Types.MemoCache<string>;
    this.memoizedFormatLocation = this.memoize(this.formatLocation) as unknown as (
      location: string,
    ) => string & Types.MemoCache<string>;
    this.cleanupInterval = window.setInterval(() => this.cleanupCache(), 3600000);
  }

  disconnectedCallback() {
    clearInterval(this.cleanupInterval);
    this.cleanup();
  }

  /******************************************************************************
   * BASIC UTILITY METHODS
   * Will be moved to utils/format-utils.ts
   ******************************************************************************/

  formatLocation(location: string): string {
    if (this.config.remove_location_country) {
      return location.replace(/, [^,]+$/, '');
    }
    return location;
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
    const now = Date.now();
    const cachePrefix = `calendar_${this.config.entities.join('_')}`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(cachePrefix)) {
        try {
          const cache = JSON.parse(localStorage.getItem(key)!);
          if (now - cache.timestamp > 86400000) {
            localStorage.removeItem(key);
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    }
  }

  get translations() {
    const lang = this.config.language || 'en';
    return CalendarCardPro.TRANSLATIONS[lang] || CalendarCardPro.TRANSLATIONS.en;
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
    cacheKeys.forEach((key) => localStorage.removeItem(key));
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
    const configHash = this.hashConfig(this.config);
    return `calendar_${this.instanceId}_${entities.join(
      '_',
    )}_${days_to_show}_${show_past_events}_${configHash}`;
  }

  hashConfig(config: Types.Config) {
    // This is actually a general utility function
    // Will be moved to utils/helpers.ts
    return btoa(JSON.stringify(config)).substring(0, 8);
  }

  isValidState() {
    if (!this._hass || !this.config.entities.length) {
      return false;
    }
    return true;
  }

  /******************************************************************************
   * EVENT FETCHING & PROCESSING
   * Will be moved to utils/event-utils.ts
   ******************************************************************************/

  async updateEvents(force = false): Promise<void> {
    if (!this.isValidState()) return;

    const cachedData = !force && this.getCachedEvents();
    if (cachedData) {
      this.events = [...cachedData];
      this.renderCard();
      return;
    }

    this.isLoading = true;
    this.renderCard();

    try {
      const events = await this.fetchEvents();
      this.events = [...events];
      this.cacheEvents(events);
    } catch (error: unknown) {
      if (this.events.length === 0) {
        const partialEvents = await this.fetchTodayEvents();
        this.events = partialEvents ? [...partialEvents] : [];
      }
      this.handleError(error);
    } finally {
      this.isLoading = false;
      this.renderCard();
    }
  }

  async fetchEvents(): Promise<ReadonlyArray<Types.CalendarEventData>> {
    const timeWindow = this.getTimeWindow();
    const allEvents: Types.CalendarEventData[] = [];

    for (const entityConfig of this.config.entities) {
      try {
        const events = await this._hass!.callApi(
          'GET',
          `calendars/${
            typeof entityConfig === 'string' ? entityConfig : entityConfig.entity
          }?start=${timeWindow.start.toISOString()}&end=${timeWindow.end.toISOString()}`,
        );
        const processedEvents = (events as Types.CalendarEventData[]).map(
          (event: Types.CalendarEventData) => ({
            ...event,
            _entityConfig: {
              entity: typeof entityConfig === 'string' ? entityConfig : entityConfig.entity,
              color:
                typeof entityConfig === 'string'
                  ? 'var(--primary-text-color)'
                  : entityConfig.color || 'var(--primary-text-color)',
            },
          }),
        );
        allEvents.push(...processedEvents);
      } catch (error) {
        console.warn(
          `Calendar-Card-Pro: Failed to fetch events for ${typeof entityConfig === 'string' ? entityConfig : entityConfig.entity}`,
          error,
        );
      }
    }

    return allEvents;
  }

  async fetchTodayEvents(): Promise<Types.CalendarEventData[] | null> {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);

      const events = await this._hass!.callApi(
        'GET',
        `calendars/${
          typeof this.config.entities[0] === 'string'
            ? this.config.entities[0]
            : this.config.entities[0].entity
        }?start=${start.toISOString()}&end=${end.toISOString()}`,
      );
      return events as Types.CalendarEventData[];
    } catch {
      return null;
    }
  }

  updateDateObjects() {
    const dates = CalendarCardPro.DATE_OBJECTS;
    dates.now = new Date();
    dates.todayStart.setTime(dates.now.getTime());
    dates.todayStart.setHours(0, 0, 0, 0);
    dates.todayEnd.setTime(dates.todayStart.getTime());
    dates.todayEnd.setHours(23, 59, 59, 999);
  }

  /******************************************************************************
   * EVENT CACHING
   * Will be moved to utils/state-utils.ts
   ******************************************************************************/

  getCachedEvents(): ReadonlyArray<Types.CalendarEventData> | null {
    const cacheKey = this.getCacheKey();
    try {
      const cache = JSON.parse(localStorage.getItem(cacheKey)!) as Types.CacheEntry;
      const cacheDuration = (this.config.update_interval || 300) * 1000;

      if (cache && Date.now() - cache.timestamp < cacheDuration) {
        sessionStorage.setItem(cacheKey, 'used');
        return cache.events;
      }
    } catch (error) {
      console.warn('Calendar-Card-Pro: Failed to retrieve cached events:', error);
    }
    return null;
  }

  cacheEvents(events: ReadonlyArray<Types.CalendarEventData>): boolean {
    const cacheKey = this.getCacheKey();
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          events,
          timestamp: Date.now(),
        }),
      );
      return true;
    } catch (error) {
      console.error('Failed to cache events:', error);
      return false;
    }
  }

  /******************************************************************************
   * ACTION HANDLING
   * Will be moved to utils/actions.ts
   ******************************************************************************/

  handleAction(actionConfig: Types.ActionConfig) {
    if (!this._hass || !actionConfig) return;

    const actions: Record<string, () => void> = {
      'more-info': () => this.fireMoreInfo(),
      navigate: () => this.handleNavigation(actionConfig),
      'call-service': () => this.callService(actionConfig),
      url: () => this.openUrl(actionConfig),
      expand: () => this.toggleExpanded(),
      none: () => {},
    };

    const action = actions[actionConfig.action];
    if (action) action();
  }

  fireMoreInfo() {
    const entityId = Array.isArray(this.config.entities)
      ? typeof this.config.entities[0] === 'string'
        ? this.config.entities[0]
        : this.config.entities[0].entity
      : this.config.entities;

    const event = new CustomEvent<{ entityId: string }>('hass-more-info', {
      bubbles: true,
      composed: true,
      detail: {
        entityId: entityId,
      },
    });
    this.dispatchEvent(event);
  }

  handleNavigation(actionConfig: Types.ActionConfig) {
    if (actionConfig.navigation_path) {
      window.history.pushState(null, '', actionConfig.navigation_path);
      window.dispatchEvent(new Event('location-changed'));
    }
  }

  callService(actionConfig: Types.ActionConfig) {
    if (actionConfig.service) {
      const [domain, service] = actionConfig.service.split('.');
      this._hass!.callService(domain, service, actionConfig.service_data || {});
    }
  }

  openUrl(actionConfig: Types.ActionConfig) {
    if (actionConfig.url_path) {
      window.open(actionConfig.url_path, actionConfig.open_tab || '_blank');
    }
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

  // Update event handlers in setupEventListeners
  setupEventListeners(): void {
    const cardContainer = this.shadowRoot?.querySelector<HTMLDivElement>('.card-container');
    if (!cardContainer) return;

    let holdTimer: number;
    let isHold = false;

    const handlePointerDown = (): void => {
      isHold = false;
      holdTimer = window.setTimeout(() => {
        isHold = true;
        if (this.config.hold_action) {
          this.handleAction(this.config.hold_action);
        }
      }, 500);
    };

    const handlePointerUp = (): void => {
      clearTimeout(holdTimer);
      if (!isHold && this.config.tap_action) {
        this.handleAction(this.config.tap_action);
      }
    };

    const handlePointerCancel = (): void => {
      clearTimeout(holdTimer);
    };

    cardContainer.addEventListener('pointerdown', handlePointerDown);
    cardContainer.addEventListener('pointerup', handlePointerUp);
    cardContainer.addEventListener('pointercancel', handlePointerCancel);
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
    /** @type {Record<string, Types.EventsByDay>} */
    const eventsByDay: Record<string, Types.EventsByDay> = {};
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const upcomingEvents = this.events.filter((event) => {
      if (!event?.start || !event?.end) return false;

      const startDate = event.start.dateTime
        ? new Date(event.start.dateTime)
        : event.start.date
          ? new Date(event.start.date)
          : null;
      const endDate = event.end.dateTime
        ? new Date(event.end.dateTime)
        : event.end.date
          ? new Date(event.end.date)
          : null;
      if (!startDate || !endDate) return false;

      const isAllDayEvent = !event.start.dateTime;
      const isEventToday = startDate >= todayStart && startDate <= todayEnd;
      const isFutureEvent = startDate > todayEnd;

      // Keep only current and future events
      if (!isEventToday && !isFutureEvent) {
        return false;
      }

      // Filter out ended events if not showing past events
      if (!this.config.show_past_events) {
        if (!isAllDayEvent && endDate < now) {
          return false;
        }
      }

      return true;
    });

    // Return early if no upcoming events
    if (upcomingEvents.length === 0) {
      return [];
    }

    // Process events into days
    upcomingEvents.forEach((event) => {
      const startDate = event.start.dateTime
        ? new Date(event.start.dateTime)
        : event.start.date
          ? new Date(event.start.date)
          : null;
      if (!startDate) return;
      const eventDateKey = startDate.toISOString().split('T')[0];

      if (!eventsByDay[eventDateKey]) {
        eventsByDay[eventDateKey] = {
          weekday: this.translations.daysOfWeek[startDate.getDay()],
          day: startDate.getDate(),
          month: this.translations.months[startDate.getMonth()],
          timestamp: startDate.getTime(),
          events: [],
        };
      }

      eventsByDay[eventDateKey].events.push({
        summary: event.summary || '',
        time: this.formatEventTime(event),
        location: this.config.show_location ? this.formatLocation(event.location || '') : '',
        start: event.start,
        end: event.end,
        _entityConfig: event._entityConfig,
      });
    });

    // Sort events within each day
    Object.values(eventsByDay).forEach((day) => {
      day.events.sort((a, b) => {
        const aStart = a.start.dateTime
          ? new Date(a.start.dateTime).getTime()
          : a.start.date
            ? new Date(a.start.date).getTime()
            : 0;
        const bStart = b.start.dateTime
          ? new Date(b.start.dateTime).getTime()
          : b.start.date
            ? new Date(b.start.date).getTime()
            : 0;
        return aStart - bStart;
      });
    });

    // Sort days and limit to configured number of days
    let days = Object.values(eventsByDay)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, this.config.days_to_show || 3);

    // Apply max_events_to_show limit if configured and not expanded
    if (this.config.max_events_to_show && !this.isExpanded) {
      let totalEvents = 0;
      days = days.filter((day) => {
        if (totalEvents >= (this.config.max_events_to_show ?? 0)) {
          return false;
        }
        totalEvents += day.events.length;
        return true;
      });
    }

    return days;
  }

  /**
   * Format event time based on event type and configuration
   * Handles all-day events, multi-day events, and time formats
   * @param {Object} event Calendar event object
   * @returns {string} Formatted time string
   */
  formatEventTime(event: Types.CalendarEventData) {
    const startDate = new Date(event.start.dateTime || event.start.date || '');
    const endDate = new Date(event.end.dateTime || event.end.date || '');
    const isAllDayEvent = !event.start.dateTime;

    if (isAllDayEvent) {
      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setDate(adjustedEndDate.getDate() - 1);

      if (startDate.toDateString() !== adjustedEndDate.toDateString()) {
        return this.formatMultiDayAllDayTime(adjustedEndDate);
      }
      return this.translations.allDay;
    }

    if (startDate.toDateString() !== endDate.toDateString()) {
      return this.formatMultiDayTime(startDate, endDate);
    }

    return this.formatSingleDayTime(startDate, endDate);
  }

  formatMultiDayAllDayTime(endDate: Date) {
    const endDay = endDate.getDate();
    const endMonthName = this.translations.months[endDate.getMonth()];
    const dayFormat = this.config.language === 'de' ? `${endDay}.` : endDay;

    return `${this.translations.allDay}, ${this.translations.multiDay} ${dayFormat} ${endMonthName}`;
  }

  formatMultiDayTime(startDate: Date, endDate: Date) {
    const endDay = endDate.getDate();
    const endMonthName = this.translations.months[endDate.getMonth()];
    const endWeekday = this.translations.fullDaysOfWeek[endDate.getDay()];
    const dayFormat = this.config.language === 'de' ? `${endDay}.` : endDay;

    const startTimeStr = this.formatTime(startDate);
    const endTimeStr = this.formatTime(endDate);

    return [
      startTimeStr,
      this.translations.multiDay,
      endWeekday + ',',
      dayFormat,
      endMonthName,
      this.translations.at,
      endTimeStr,
    ].join(' ');
  }

  formatSingleDayTime(startDate: Date, endDate: Date) {
    return this.config.show_end_time
      ? `${this.formatTime(startDate)} - ${this.formatTime(endDate)}`
      : this.formatTime(startDate);
  }

  /**
   * Calculate time window for event fetching
   * @returns {Object} Object containing start and end dates for the calendar window
   */
  getTimeWindow(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
    const end = new Date(start);
    const daysToShow = parseInt(this.config.days_to_show.toString()) || 3;
    end.setDate(start.getDate() + daysToShow);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  /**
   * Format time according to 12/24 hour setting
   * @param {Date} date Date object to format
   * @returns {string} Formatted time string
   */
  formatTime(date: Date): string {
    let hours = date.getHours();
    let minutes = date.getMinutes();

    if (!this.config.time_24h) {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }

    return `${hours}:${minutes.toString().padStart(2, '0')}`;
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
    if (!days.length) {
      const fragment = document.createDocumentFragment();
      const noEventsDiv = document.createElement('div');
      noEventsDiv.className = 'no-events';
      noEventsDiv.textContent = 'No upcoming events';
      fragment.appendChild(noEventsDiv);
      return fragment;
    }

    const fragment = document.createDocumentFragment();
    const renderChunk = async (startIdx: number): Promise<void> => {
      const chunk = days.slice(startIdx, startIdx + CalendarCardPro.CHUNK_SIZE);
      if (!chunk.length) return;

      chunk.forEach((day: Types.EventsByDay) => {
        if (day.events.length === 0) return;
        const table = document.createElement('table');
        table.innerHTML = this.generateDayContent(day);
        fragment.appendChild(table);
      });

      if (startIdx + CalendarCardPro.CHUNK_SIZE < days.length) {
        await new Promise((resolve) => setTimeout(resolve, CalendarCardPro.RENDER_DELAY));
        await renderChunk(startIdx + CalendarCardPro.CHUNK_SIZE);
      }
    };

    await renderChunk(0);
    return fragment;
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

    const eventsByDay = this.groupEventsByDay();

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
    if (state === 'loading') {
      const container = document.createElement('div');
      container.className = 'card-container';

      const content = document.createElement('div');
      content.className = 'card-content';
      content.innerHTML = `
        <div style="text-align: center; color: var(--primary-text-color);">
          ${this.translations.loading}
        </div>`;

      container.appendChild(content);

      const style = document.createElement('style');
      style.textContent = this.getStyles();

      // Update shadow DOM
      while (this.shadowRoot?.firstChild) {
        this.shadowRoot.removeChild(this.shadowRoot.firstChild);
      }

      this.shadowRoot?.appendChild(style);
      this.shadowRoot?.appendChild(container);
      return;
    }

    if (state === 'empty') {
      // Create a card that looks like a regular calendar entry
      const now = new Date();
      const emptyDay = {
        weekday: this.translations.daysOfWeek[now.getDay()],
        day: now.getDate(),
        month: this.translations.months[now.getMonth()],
        events: [
          {
            summary: this.translations.noEvents,
            time: '', // No time display
            location: '', // No location
            _entityConfig: { color: 'var(--secondary-text-color)' },
          },
        ],
      };

      const container = document.createElement('div');
      container.className = 'card-container';

      const content = document.createElement('div');
      content.className = 'card-content';

      // Modified the empty state to not show time icon
      content.innerHTML = `
        <table>
          <tr>
            <td class="date" rowspan="1">
              <div class="date-content">
                <div class="weekday">${emptyDay.weekday}</div>
                <div class="day">${emptyDay.day}</div>
                ${this.config.show_month ? `<div class="month">${emptyDay.month}</div>` : ''}
              </div>
            </td>
            <td class="event">
              <div class="event-content">
                <div class="event-title" style="color: ${emptyDay.events[0]._entityConfig.color}">
                  ${emptyDay.events[0].summary}
                </div>
              </div>
            </td>
          </tr>
        </table>`;

      container.appendChild(content);

      const style = document.createElement('style');
      style.textContent = this.getStyles();

      // Update shadow DOM
      while (this.shadowRoot?.firstChild) {
        this.shadowRoot.removeChild(this.shadowRoot.firstChild);
      }

      this.shadowRoot?.appendChild(style);
      this.shadowRoot?.appendChild(container);
      return;
    }

    // For other states (error/loading) use simple message display
    const messages = {
      error: `<p style="color: var(--error-color, red);">${this.translations.error}</p>`,
      loading: `<p style="color: var(--secondary-text-color);">${this.translations.loading}</p>`,
    };

    this.shadowRoot!.innerHTML = `
      <div class="card-content">
        ${messages[state]}
      </div>
    `;
  }

  /******************************************************************************
   * HTML GENERATION
   * Will be moved to rendering/render.ts
   ******************************************************************************/

  generateCalendarContent(days: Types.EventsByDay[]): string {
    if (!days.length) {
      return '<div class="no-events">No upcoming events</div>';
    }

    return days
      .map((day) => {
        if (day.events.length === 0) return '';

        const eventRows = day.events
          .map(
            (event: Types.CalendarEventData, index: number) => `
        <tr>
          ${
            index === 0
              ? `
            <td class="date" rowspan="${day.events.length}">
              <div class="date-content">
                <div class="weekday">${day.weekday}</div>
                <div class="day">${day.day}</div>
                ${this.config.show_month ? `<div class="month">${day.month}</div>` : ''}
              </div>
            </td>
          `
              : ''
          }
          <td class="event">
            <div class="event-content">
              <div class="event-title">${event.summary}</div>
              <div class="time-location">
                <div class="time">
                  <ha-icon icon="hass:clock-outline"></ha-icon>
                  <span>${this.formatEventTime(event)}</span>
                </div>
                ${
                  event.location
                    ? `
                  <div class="location">
                    <ha-icon icon="hass:map-marker"></ha-icon>
                    <span>${this.formatLocation(event.location)}</span>
                  </div>
                `
                    : ''
                }
              </div>
            </div>
          </td>
        </tr>
      `,
          )
          .join('');

        return `<table>${eventRows}</table>`;
      })
      .join('');
  }

  generateDayContent(day: Types.EventsByDay): string {
    return day.events
      .map(
        (event: Types.CalendarEventData, index: number) => `
      <tr>
        ${
          index === 0
            ? `
          <td class="date" rowspan="${day.events.length}">
            <div class="date-content">
              <div class="weekday">${day.weekday}</div>
              <div class="day">${day.day}</div>
              ${this.config.show_month ? `<div class="month">${day.month}</div>` : ''}
            </div>
          </td>
        `
            : ''
        }
        <td class="event">
          <div class="event-content">
            <div class="event-title" style="color: ${
              event._entityConfig?.color
            }">${event.summary}</div>
            <div class="time-location">
              <div class="time">
                <ha-icon icon="hass:clock-outline"></ha-icon>
                <span>${this.formatEventTime(event)}</span>
              </div>
              ${
                event.location
                  ? `
                <div class="location">
                  <ha-icon icon="hass:map-marker"></ha-icon>
                  <span>${this.formatLocation(event.location)}</span>
                </div>
              `
                  : ''
              }
            </div>
          </div>
        </td>
      </tr>
    `,
      )
      .join('');
  }

  /******************************************************************************
   * STYLING
   * Will be moved to rendering/styles.ts
   ******************************************************************************/

  getStyles(): string {
    // First define the custom properties
    const customProperties = `
      :host {
        --card-font-size-title: ${this.config.title_font_size};
        --card-font-size-weekday: ${this.config.weekday_font_size};
        --card-font-size-day: ${this.config.day_font_size};
        --card-font-size-month: ${this.config.month_font_size};
        --card-font-size-event: ${this.config.event_font_size};
        --card-font-size-time: ${this.config.time_font_size};
        --card-font-size-location: ${this.config.location_font_size};
        --card-color-title: ${this.config.title_color};
        --card-color-weekday: ${this.config.weekday_color};
        --card-color-day: ${this.config.day_color};
        --card-color-month: ${this.config.month_color};
        --card-color-event: ${this.config.event_color};
        --card-color-time: ${this.config.time_color};
        --card-color-location: ${this.config.location_color};
        --card-line-color-vertical: ${this.config.vertical_line_color};
        --card-line-color-horizontal: ${this.config.horizontal_line_color};
        --card-line-width-vertical: ${this.config.vertical_line_width};
        --card-line-width-horizontal: ${this.config.horizontal_line_width};
        --card-spacing-row: ${this.config.row_spacing};
        --card-spacing-additional: ${this.config.additional_card_spacing};
        --card-icon-size: ${this.config.time_location_icon_size};
        --card-date-column-width: ${parseFloat(this.config.day_font_size) * 1.75}px;
        --card-custom-background: ${this.config.background_color};
      }
    `;

    // Then use them in the actual styles
    return `
      ${customProperties}
      
      :host {
        display: block;
      }
      .card-container {
        cursor: pointer;
        width: 100%;
        height: 100%;
      }
      .card-content {
        background: var(--card-custom-background, var(--card-background-color, #FFF));
        border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color));
        border-radius: var(--ha-card-border-radius, 10px);
        padding: 16px;
        padding-top: calc(16px + var(--card-spacing-additional));
        padding-bottom: calc(16px + var(--card-spacing-additional));
      }
      .title {
        font-size: var(--card-font-size-title);
        line-height: var(--card-font-size-title);
        font-weight: 500;
        color: var(--card-color-title);
        margin-bottom: 16px;
      }
      ha-icon {
        margin-right: 4px;
        --mdc-icon-size: var(--card-icon-size);
        vertical-align: middle;
        position: relative;
      }
      table {
        width: 100%;
        table-layout: fixed;
        border-spacing: 0;
        margin-bottom: var(--card-spacing-row);
        border-bottom: var(--card-line-width-horizontal) solid var(--card-line-color-horizontal);
        padding-bottom: var(--card-spacing-row);
      }
      .date {
        width: var(--card-date-column-width);
        text-align: center;
        padding-right: 12px;
        border-right: var(--card-line-width-vertical) solid var(--card-line-color-vertical);
      }
      .weekday {
        font-size: var(--card-font-size-weekday);
        line-height: var(--card-font-size-weekday);
        color: var(--card-color-weekday);
      }
      .day {
        font-size: var(--card-font-size-day);
        line-height: var(--card-font-size-day);
        font-weight: 500;
        color: var(--card-color-day);
      }
      .month {
        font-size: var(--card-font-size-month);
        line-height: var(--card-font-size-month);
        text-transform: uppercase;
        color:var(--card-color-month);
      }
      .event {
        padding-left: 12px;
      }
      .event-title {
        font-size: var(--card-font-size-event);
        font-weight: 500;
        color: var(--card-color-event);
      }
      .time-location {
        display: flex;
        flex-direction: column;
        margin-top: 0px;
      }
      .time, .location {
        display: flex;
        align-items: center;
        line-height: 1.2;
      }
      .time {
        font-size: var(--card-font-size-time);
        color: var(--card-color-time);
      }
      .location {
        font-size: var(--card-font-size-location);
        color: var(--card-color-location);
        margin-top: 2px;
      }
      table:last-of-type {
        margin-bottom: 0;
        border-bottom: 0;
        padding-bottom: 0;
      }
      .no-events {
        text-align: center;
        color: var(--secondary-text-color);
        font-style: italic;
        padding: 16px;
      }
    `;
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
    let timeout: number;
    return (...args: Parameters<T>): void => {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = window.setTimeout(later, wait);
    };
  }

  /**
   * Memoize helper for caching function results
   * @param {Function} func Function to memoize
   * @returns {Function} Memoized function
   */
  memoize<T extends readonly unknown[], R>(
    func: (...args: T) => R,
  ): ((...args: T) => R) & Types.MemoCache<R> {
    const cache = new Map<string, R>();
    const memoizedFunc = (...args: T): R => {
      const key = JSON.stringify(args);
      if (cache.has(key)) return cache.get(key)!;

      // Use call with spread operator instead of apply with array
      const result = func.call(this, ...args);

      cache.set(key, result);
      return result;
    };
    return Object.assign(memoizedFunc, { cache, clear: () => cache.clear() });
  }

  /******************************************************************************
   * PERFORMANCE MONITORING
   * Will be moved to utils/helpers.ts
   ******************************************************************************/

  /**
   * Performance monitoring utilities
   * @private
   */
  beginPerfMetrics(): Types.PerfMetrics {
    return {
      startTime: performance.now(),
      eventCount: this.events.length,
    };
  }

  /**
   * End performance measurement and process results
   * @param {Object} metrics Metrics object from beginPerfMetrics
   */
  endPerfMetrics(metrics: { startTime: number; eventCount: number }) {
    const duration = performance.now() - metrics.startTime;
    this.performanceMetrics.renderTime.push(duration);
    // this.performanceMetrics.eventCount = metrics.eventCount; // Avoid assigning to read-only property

    // Keep only last 10 measurements
    if (this.performanceMetrics.renderTime.length > 10) {
      this.performanceMetrics.renderTime.shift();
    }

    // Log if performance is poor
    const avgRenderTime = this.getAverageRenderTime();
    if (avgRenderTime > CalendarCardPro.PERFORMANCE_THRESHOLDS.RENDER_TIME) {
      console.warn('Calendar-Card-Pro: Poor rendering performance detected', {
        averageRenderTime: avgRenderTime,
        eventCount: this.performanceMetrics.eventCount,
      });
    }
  }

  getAverageRenderTime() {
    if (!this.performanceMetrics.renderTime.length) return 0;
    const sum = this.performanceMetrics.renderTime.reduce((a, b) => a + b, 0);
    return sum / this.performanceMetrics.renderTime.length;
  }

  private handleError(error: unknown): void {
    console.error('Calendar-Card-Pro:', error instanceof Error ? error.message : String(error));
  }
}

/******************************************************************************
 * EDITOR COMPONENT
 * Will be moved to rendering/editor.ts
 ******************************************************************************/

// This is a placeholder for future UI editor implementation
// Currently not used since we removed getConfigElement
class CalendarCardProEditor extends HTMLElement {
  public setConfig(_config: Readonly<Partial<Types.Config>>): void {
    // Will be implemented later when we build the UI editor
  }
}

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
