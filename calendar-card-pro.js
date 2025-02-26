/**
 * Calendar Card Pro for Home Assistant
 *
 * @license MIT
 * @copyright Copyright (c) 2025 Alex Pfau
 * @version 1.2.0
 *
 * This project uses LitElement and related libraries which are released under the BSD-3-Clause license.
 * Copyright 2019 Google LLC
 */
class CalendarCardPro extends HTMLElement {
  //=============================================================================
  // Static Configuration & Properties
  //=============================================================================

  /**
   * Default configuration options for the calendar card.
   * These values can be overridden by user configuration.
   *
   * @static
   * @returns {Object} Default configuration object
   */
  static get DEFAULT_CONFIG() {
    return {
      // Core Settings
      // Essential configuration that defines what data to display
      entities: [], // Calendar entities to display
      days_to_show: 3, // Number of days to show
      max_events_to_show: undefined, // Optional limit for compact mode
      show_past_events: false, // Show events that have ended
      update_interval: 43200, // Cache duration in seconds

      // Display Mode & Localization
      // How content is formatted and displayed
      language: undefined, // Using system language by default
      time_24h: true, // Time format
      show_end_time: true, // Show event end times
      show_month: true, // Show month names
      show_location: true, // Show event locations
      remove_location_country: true, // Remove country from location

      // Card Layout
      // Overall card structure and spacing
      title: '', // Card title
      background_color: 'var(--ha-card-background)', // Card background color
      row_spacing: '5px', // Space between day rows
      additional_card_spacing: '0px', // Extra top/bottom padding for card

      // Visual Separators
      // Lines and borders that divide content
      vertical_line_width: '2px',
      vertical_line_color: '#03a9f4',
      horizontal_line_width: '0px',
      horizontal_line_color: 'var(--secondary-text-color)',

      // Typography: Sizes
      // Font size configuration for different elements
      title_font_size: '20px',
      weekday_font_size: '14px',
      day_font_size: '26px',
      month_font_size: '12px',
      event_font_size: '14px',
      time_font_size: '12px',
      location_font_size: '12px',
      time_location_icon_size: '16px',

      // Typography: Colors
      // Color configuration for different elements
      title_color: 'var(--primary-text-color)',
      weekday_color: 'var(--primary-text-color)',
      day_color: 'var(--primary-text-color)',
      month_color: 'var(--primary-text-color)',
      event_color: 'var(--primary-text-color)',
      time_color: 'var(--secondary-text-color)',
      location_color: 'var(--secondary-text-color)',

      // Actions
      // User interaction configuration
      tap_action: { action: 'expand' },
      hold_action: { action: 'none' },
    };
  }

  /**
   * Language translations for the calendar interface.
   * Currently supports English (en) and German (de).
   *
   * @static
   * @returns {Object} Translation strings by language code
   */
  static get TRANSLATIONS() {
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
        error:
          'Fehler: Kalender-Entity nicht gefunden oder falsch konfiguriert',
      },
    };
  }

  /**
   * Performance monitoring thresholds and settings.
   * Used to optimize rendering and provide performance warnings.
   *
   * @static
   * @returns {Object} Performance configuration
   * @property {number} RENDER_TIME - Maximum acceptable render time in ms
   * @property {number} CHUNK_SIZE - Number of events to render in each chunk
   * @property {number} RENDER_DELAY - Delay between chunks in ms
   */
  static get PERFORMANCE_THRESHOLDS() {
    return {
      RENDER_TIME: 100, // ms
      CHUNK_SIZE: 10,
      RENDER_DELAY: 50,
    };
  }

  static get CHUNK_SIZE() {
    return 10;
  }
  static get RENDER_DELAY() {
    return 50;
  }
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

  /**
   * Find the first available calendar entity in Home Assistant
   * Used for preview and stub configuration
   * @static
   * @param {Object} hass Home Assistant instance
   * @returns {string|null} First found calendar entity ID or null
   */
  static findCalendarEntity(hass) {
    return Object.keys(hass.states).find((entityId) =>
      entityId.startsWith('calendar.')
    );
  }

  /**
   * Get stub configuration for card initialization
   * Provides default values and attempts to find a calendar entity
   * @static
   * @param {Object} hass Home Assistant instance
   * @returns {Object} Initial configuration object
   */
  static getStubConfig(hass) {
    const calendarEntity = this.findCalendarEntity(hass);
    return {
      type: 'custom:calendar-card-pro',
      entities: calendarEntity ? [calendarEntity] : [],
      days_to_show: 3,
      show_location: true,
      _description: !calendarEntity
        ? 'A calendar card that displays events from multiple calendars with individual styling. Add a calendar integration to Home Assistant to use this card.'
        : undefined,
    };
  }

  /**
   * Get card name for the UI
   * @static
   * @returns {string} Card display name
   */
  static get name() {
    return 'Calendar Card Pro';
  }

  //=============================================================================
  // Lifecycle Methods
  //=============================================================================

  /**
   * Initialize calendar component and set up state management
   * Sets up shadow DOM, performance monitoring, and event handlers
   */
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    // Add unique instance ID for cache isolation
    this.instanceId = Math.random().toString(36).substring(2, 15);
    this.initializeState();

    // Add performance monitoring
    this.performanceMetrics = {
      renderTime: [],
      eventCount: 0,
      lastUpdate: Date.now(),
    };

    this.debouncedUpdate = this.debounce(() => this.updateEvents(), 300);
    this.memoizedFormatTime = this.memoize(this.formatTime);
    this.memoizedFormatLocation = this.memoize(this.formatLocation);
    this.cleanupInterval = setInterval(() => this.cleanupCache(), 3600000); // Every hour
  }

  /**
   * Clean up resources when component is removed from DOM
   */
  disconnectedCallback() {
    clearInterval(this.cleanupInterval);
    this.cleanup();
  }

  //=============================================================================
  // State Management
  //=============================================================================

  /**
   * Initialize component state with default values
   * Sets up initial configuration, events array, touch state,
   * loading state, and expansion state
   * @private
   */
  initializeState() {
    this.config = {};
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
    this.isExpanded = false; // Track expanded state
  }

  cleanup() {
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }
    // Clear memoization caches
    this.memoizedFormatTime.cache?.clear();
    this.memoizedFormatLocation.cache?.clear();
  }

  cleanupCache() {
    const now = Date.now();
    const cachePrefix = `calendar_${this.config.entity}`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(cachePrefix)) {
        try {
          const cache = JSON.parse(localStorage.getItem(key));
          if (now - cache.timestamp > 86400000) {
            // 24 hours
            localStorage.removeItem(key);
          }
        } catch (e) {
          localStorage.removeItem(key);
        }
      }
    }
  }

  get translations() {
    // First try user config, then HA system language, fallback to English
    const lang =
      this.config.language ||
      (this._hass?.language || 'en').split('-')[0].toLowerCase();
    return (
      CalendarCardPro.TRANSLATIONS[lang] || CalendarCardPro.TRANSLATIONS.en
    );
  }

  /**
   * Home Assistant calls this setter whenever there's a state update
   * This is our primary update mechanism
   */
  set hass(hass) {
    const previousHass = this._hass;
    this._hass = hass;

    // Only update if any calendar entity state has actually changed
    const entitiesChanged = this.config.entities.some(
      (entity) =>
        !previousHass ||
        previousHass.states[entity]?.state !== hass.states[entity]?.state
    );

    if (entitiesChanged) {
      this.updateEvents();
    }
  }

  /**
   * Update component configuration and render
   * Handles configuration changes and cache invalidation
   */
  setConfig(config) {
    const previousConfig = this.config;
    this.config = { ...CalendarCardPro.DEFAULT_CONFIG, ...config };
    this.config.entities = this.normalizeEntities(this.config.entities);

    // Force update if configuration changed meaningfully
    if (this.hasConfigChanged(previousConfig, this.config)) {
      this.invalidateCache();
      this.updateEvents(true); // Force refresh
    } else {
      this.renderCard();
    }
  }

  /**
   * Validates and normalizes the entities configuration array.
   * Converts string entries to full entity objects and ensures
   * all entity objects have required properties.
   *
   * @private
   * @param {Array} entities Raw entities configuration from user
   * @returns {Array} Array of normalized entity objects with color information
   */
  normalizeEntities(entities) {
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
      .filter(Boolean);
  }

  /**
   * Check if entities configuration has changed
   * @private
   * @param {Array} previous Previous entities array
   * @param {Array} current Current entities array
   * @returns {boolean} True if entities changed
   */
  hasEntitiesChanged(previous, current) {
    if (previous.length !== current.length) return true;
    return previous.some((entity, index) => entity !== current[index]);
  }

  /**
   * Check if configuration has changed in a way that requires cache invalidation
   * @private
   * @param {Object} previous Previous configuration
   * @param {Object} current Current configuration
   * @returns {boolean} True if configuration changed meaningfully
   */
  hasConfigChanged(previous, current) {
    if (!previous) return true;

    const relevantKeys = [
      'entities',
      'days_to_show',
      'show_past_events',
      'update_interval',
    ];

    return relevantKeys.some(
      (key) => JSON.stringify(previous[key]) !== JSON.stringify(current[key])
    );
  }

  /**
   * Invalidate cached data when configuration changes
   * @private
   */
  invalidateCache() {
    const cacheKeys = this.getAllCacheKeys();
    cacheKeys.forEach((key) => localStorage.removeItem(key));
  }

  /**
   * Get all cache keys for current configuration
   * @private
   * @returns {Array<string>} Array of cache keys
   */
  getAllCacheKeys() {
    const keys = [];
    const baseKey = this.getBaseCacheKey();

    // Get all potential date variations for today and yesterday
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    [now, yesterday].forEach((date) => {
      keys.push(`${baseKey}_${date.toDateString()}`);
    });

    return keys;
  }

  /**
   * Generate cache key for current state
   * @private
   * @returns {string} Cache key
   */
  getCacheKey() {
    return `${this.getBaseCacheKey()}_${new Date().toDateString()}`;
  }

  /**
   * Generate base cache key incorporating all configuration parameters
   * @private
   * @returns {string} Base cache key
   */
  getBaseCacheKey() {
    const { entities, days_to_show, show_past_events } = this.config;
    const configHash = this.hashConfig(this.config);
    return `calendar_${this.instanceId}_${entities.join(
      '_'
    )}_${days_to_show}_${show_past_events}_${configHash}`;
  }

  /**
   * Create a hash of the configuration to ensure unique cache per config
   * @private
   * @param {Object} config Configuration object
   * @returns {string} Configuration hash
   */
  hashConfig(config) {
    return btoa(JSON.stringify(config)).substring(0, 8);
  }

  /**
   * Validate required properties and configuration
   * @private
   * @returns {boolean} True if component is in valid state
   */
  isValidState() {
    if (!this._hass || !this.config.entities.length) {
      return false;
    }
    return true;
  }

  /**
   * Update events with cache-first strategy
   * @param {boolean} force Force update ignoring cache
   * @returns {Promise<void>}
   */
  async updateEvents(force = false) {
    if (!this.isValidState()) return;

    // Try cache first - skip API call if cache is valid
    const cachedData = !force && this.getCachedEvents();
    if (cachedData) {
      this.events = cachedData;
      this.renderCard();
      return;
    }

    // Only call API if needed
    this.isLoading = true;
    this.renderCard(); // Show loading state immediately

    try {
      const events = await this.fetchEvents();
      this.events = events;
      this.cacheEvents(events);
    } catch (error) {
      // Try to recover from API errors
      if (this.events.length === 0) {
        // If we have no events, try to get at least today's events
        const partialEvents = await this.fetchTodayEvents();
        this.events = partialEvents || [];
      }
      // Otherwise keep existing events
    } finally {
      this.isLoading = false;
      this.renderCard();
    }
  }

  /**
   * Fetches and processes calendar events from all configured entities.
   * Adds entity-specific configuration to each event for proper rendering.
   *
   * @private
   * @returns {Promise<Array>} Combined and processed events from all calendars
   */
  async fetchEvents() {
    const timeWindow = this.getTimeWindow();
    const allEvents = [];

    for (const entityConfig of this.config.entities) {
      try {
        const events = await this._hass.callApi(
          'GET',
          `calendars/${
            entityConfig.entity
          }?start=${timeWindow.start.toISOString()}&end=${timeWindow.end.toISOString()}`
        );
        const processedEvents = events.map((event) => ({
          ...event,
          _entityConfig: entityConfig,
        }));
        allEvents.push(...processedEvents);
      } catch (error) {
        console.warn(
          `Calendar-Card-Pro: Failed to fetch events for ${entityConfig.entity}`,
          error
        );
      }
    }

    return allEvents;
  }

  async fetchTodayEvents() {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);

      const events = await this._hass.callApi(
        'GET',
        `calendars/${
          this.config.entity
        }?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      return events;
    } catch {
      return null;
    }
  }

  updateDateObjects() {
    const dates = CalendarCardPro.DATE_OBJECTS;
    dates.now = new Date();
    dates.todayStart.setTime(dates.now);
    dates.todayStart.setHours(0, 0, 0, 0);
    dates.todayEnd.setTime(dates.todayStart.getTime());
    dates.todayEnd.setHours(23, 59, 59, 999);
  }

  /**
   * Get cached events with error handling
   * @returns {Array|null} Cached events or null if no valid cache exists
   */
  getCachedEvents() {
    const cacheKey = this.getCacheKey();
    try {
      const cache = JSON.parse(localStorage.getItem(cacheKey));
      const cacheDuration = (this.config.update_interval || 300) * 1000;

      if (cache && Date.now() - cache.timestamp < cacheDuration) {
        sessionStorage.setItem(cacheKey, 'used');
        return cache.events;
      }
    } catch (error) {
      console.warn(
        'Calendar-Card-Pro: Failed to retrieve cached events:',
        error
      );
    }
    return null;
  }

  /**
   * Cache events in localStorage with error handling
   * @param {Array} events Array of calendar events to cache
   * @returns {boolean} Success status of caching operation
   */
  cacheEvents(events) {
    const cacheKey = this.getCacheKey();
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          events,
          timestamp: Date.now(),
        })
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  //=============================================================================
  // Event Management
  //=============================================================================

  /**
   * Handle user interactions (tap/click/hold) with the card
   * @private
   * @param {Event} event - The triggering DOM event
   * @param {Object} actionConfig - Action configuration from card config
   */
  _handleAction(event, actionConfig) {
    if (!this._hass || !actionConfig) return;

    const actions = {
      'more-info': () => this.fireMoreInfo(),
      navigate: () => this.handleNavigation(actionConfig),
      'call-service': () => this.callService(actionConfig),
      url: () => this.openUrl(actionConfig),
      expand: () => this.toggleExpanded(), // Ensure this is in actions
      none: () => {},
    };

    const action = actions[actionConfig.action];
    if (action) action();
  }

  fireMoreInfo() {
    // Use first entity from entities array
    const entityId = Array.isArray(this.config.entities)
      ? typeof this.config.entities[0] === 'string'
        ? this.config.entities[0]
        : this.config.entities[0].entity
      : this.config.entities;

    const event = new Event('hass-more-info', {
      bubbles: true,
      composed: true,
    });
    event.detail = { entityId };
    this.dispatchEvent(event);
  }

  handleNavigation(actionConfig) {
    if (actionConfig.navigation_path) {
      window.history.pushState(null, '', actionConfig.navigation_path);
      window.dispatchEvent(new Event('location-changed'));
    }
  }

  callService(actionConfig) {
    if (actionConfig.service) {
      const [domain, service] = actionConfig.service.split('.');
      this._hass.callService(domain, service, actionConfig.service_data || {});
    }
  }

  openUrl(actionConfig) {
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
  setupEventListeners() {
    const cardContainer = this.shadowRoot.querySelector('.card-container');
    if (!cardContainer) return;

    let holdTimer;
    let isHold = false;

    cardContainer.addEventListener('pointerdown', (e) => {
      isHold = false;
      holdTimer = window.setTimeout(() => {
        isHold = true;
        if (this.config.hold_action) {
          this._handleAction(e, this.config.hold_action);
        }
      }, 500);
    });

    cardContainer.addEventListener('pointerup', (e) => {
      clearTimeout(holdTimer);
      if (!isHold && this.config.tap_action) {
        this._handleAction(e, this.config.tap_action);
      }
    });

    cardContainer.addEventListener('pointercancel', () => {
      clearTimeout(holdTimer);
    });
  }

  //=============================================================================
  // Calendar Event Processing
  //=============================================================================

  /**
   * Process calendar events and group them by day
   * When max_events_to_show is set and card is not expanded,
   * limits the total number of events shown across all days
   * @typedef {Object} EventsByDay
   * @property {string} weekday - Translated weekday name
   * @property {number} day - Day of month
   * @property {string} month - Translated month name
   * @property {number} timestamp - Unix timestamp
   * @property {Array} events - Array of processed events
   *
   * @returns {Array<EventsByDay>} Array of day objects containing grouped events
   */
  groupEventsByDay() {
    /** @type {Record<string, EventsByDay>} */
    const eventsByDay = {};
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const upcomingEvents = this.events.filter((event) => {
      if (!event?.start || !event?.end) return false;

      const startDate = new Date(event.start.dateTime || event.start.date);
      const endDate = new Date(event.end.dateTime || event.end.date);
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
      const startDate = new Date(event.start.dateTime || event.start.date);
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
        location: this.config.show_location
          ? this.formatLocation(event.location)
          : '',
        start: event.start,
        end: event.end,
        _entityConfig: event._entityConfig,
      });
    });

    // Sort events within each day
    Object.values(eventsByDay).forEach((day) => {
      day.events.sort((a, b) => {
        const aStart = new Date(a.start.dateTime || a.start.date);
        const bStart = new Date(b.start.dateTime || b.start.date);
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
        if (totalEvents >= this.config.max_events_to_show) {
          return false;
        }
        totalEvents += day.events.length;
        return true;
      });
    }

    return days;
  }

  /**
   * Calculate time window for event fetching
   * @returns {Object} Object containing start and end dates for the calendar window
   */
  getTimeWindow() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
    const end = new Date(start);
    const daysToShow = parseInt(this.config.days_to_show) || 3;
    end.setDate(start.getDate() + daysToShow);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  /**
   * Format event time based on event type and configuration
   * Handles all-day events, multi-day events, and time formats
   * @param {Object} event Calendar event object
   * @returns {string} Formatted time string
   */
  formatEventTime(event) {
    const startDate = new Date(event.start.dateTime || event.start.date);
    const endDate = new Date(event.end.dateTime || event.end.date);
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

  formatMultiDayAllDayTime(endDate) {
    const endDay = endDate.getDate();
    const endMonthName = this.translations.months[endDate.getMonth()];
    const dayFormat = this.config.language === 'de' ? `${endDay}.` : endDay;

    return `${this.translations.allDay}, ${this.translations.multiDay} ${dayFormat} ${endMonthName}`;
  }

  formatMultiDayTime(startDate, endDate) {
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

  formatSingleDayTime(startDate, endDate) {
    return this.config.show_end_time
      ? `${this.formatTime(startDate)} - ${this.formatTime(endDate)}`
      : this.formatTime(startDate);
  }

  /**
   * Format time according to 12/24 hour setting
   * @param {Date} date Date object to format
   * @returns {string} Formatted time string
   */
  formatTime(date) {
    let hours = date.getHours();
    let minutes = date.getMinutes();

    if (!this.config.time_24h) {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }

    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Get list of country names for location formatting
   * Uses a two-tier approach:
   * 1. Fast access to common countries in English and their local names
   * 2. Additional coverage via Intl.DisplayNames API
   *
   * The first tier contains the most common countries with both their
   * English names and local language names for accurate matching.
   * The second tier adds support for more countries but only in English.
   *
   * @static
   * @returns {Set<string>} Set of country names in English and local languages
   */
  static get COUNTRY_NAMES() {
    if (!this._countryNames) {
      // First tier: Initialize with most common countries in English and their local names
      // These are the countries most likely to appear in calendar locations
      this._countryNames = new Set([
        // Germany (English + German)
        'Germany',
        'Deutschland',
        // Austria (English + German)
        'Austria',
        'Österreich',
        // Switzerland (English + German)
        'Switzerland',
        'Schweiz',
        // United States (variations)
        'United States',
        'United States of America',
        'USA',
        // United Kingdom (variations)
        'United Kingdom',
        'Great Britain',
        // France (same in English and French)
        'France',
        // Italy (English + Italian)
        'Italy',
        'Italia',
        // Spain (English + Spanish)
        'Spain',
        'España',
        // Netherlands (English + Dutch)
        'Netherlands',
        'Nederland',
      ]);

      try {
        // Second tier: Add additional countries from Intl API
        // Use English only to keep the Set size manageable
        const displayNames = new Intl.DisplayNames(['en'], {
          type: 'region',
          fallback: 'none',
        });

        // Add support for additional common regions
        // These are added in English only as they're less common
        const commonRegions = [
          // Primary regions (matching the first tier)
          'DE',
          'AT',
          'CH',
          'US',
          'GB',
          'FR',
          'IT',
          'ES',
          'NL',
          // Additional European countries
          'BE',
          'DK',
          'SE',
          'NO',
          'FI',
          'PT',
          'IE',
          'LU',
          'PL',
          // Major non-European countries
          'CA',
          'JP',
          'AU',
          'NZ',
          'BR',
          'RU',
          'CN',
          'IN',
        ];

        // Add each region's English name to the Set
        commonRegions.forEach((code) => {
          try {
            const name = displayNames.of(code);
            if (name) this._countryNames.add(name);
          } catch {} // Ignore invalid country codes
        });
      } catch {} // Graceful fallback to first tier if Intl API is unavailable
    }
    return this._countryNames;
  }

  /**
   * Format location string by removing country names if configured
   * Supports both comma-separated and space-separated formats
   * Examples:
   * - "Berlin, Deutschland" -> "Berlin"
   * - "Berlin Deutschland" -> "Berlin"
   * - "New York, USA" -> "New York"
   *
   * @param {string} location Raw location string from calendar event
   * @returns {string} Formatted location string with country removed (if configured)
   */
  formatLocation(location) {
    if (!location || !this.config.remove_location_country) return location;

    const locationText = location.trim();
    const countryNames = CalendarCardPro.COUNTRY_NAMES;

    // Handle comma-separated format (e.g., "City, Country")
    const parts = locationText.split(',').map((part) => part.trim());
    if (parts.length > 0 && countryNames.has(parts[parts.length - 1])) {
      parts.pop();
      return parts.join(', ');
    }

    // Handle space-separated format (e.g., "City Country")
    const words = locationText.split(/\s+/);
    if (words.length > 0 && countryNames.has(words[words.length - 1])) {
      words.pop();
      return words.join(' ');
    }

    return locationText;
  }

  //=============================================================================
  // Rendering & Display
  //=============================================================================

  /**
   * Render calendar card content progressively to optimize performance
   * Uses chunking to avoid blocking the main thread
   * @param {Array} days Array of day objects to render
   * @returns {DocumentFragment} Fragment containing rendered content
   */
  async renderProgressively(days) {
    if (!days.length) {
      return '<div class="no-events">No upcoming events</div>';
    }

    const fragment = document.createDocumentFragment();
    const renderChunk = async (startIdx) => {
      const chunk = days.slice(startIdx, startIdx + CalendarCardPro.CHUNK_SIZE);
      if (!chunk.length) return;

      chunk.forEach((day) => {
        if (day.events.length === 0) return;
        const table = document.createElement('table');
        table.innerHTML = this.generateDayContent(day);
        fragment.appendChild(table);
      });

      if (startIdx + CalendarCardPro.CHUNK_SIZE < days.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, CalendarCardPro.RENDER_DELAY)
        );
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
    while (this.shadowRoot.firstChild) {
      this.shadowRoot.removeChild(this.shadowRoot.firstChild);
    }

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(container);

    this.setupEventListeners();
    this.endPerfMetrics(metrics);
  }

  /**
   * Handle and display different card states
   * @param {'loading' | 'empty' | 'error'} state - Current card state
   * @private
   */
  renderError(state) {
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
      while (this.shadowRoot.firstChild) {
        this.shadowRoot.removeChild(this.shadowRoot.firstChild);
      }

      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(container);
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
                ${
                  this.config.show_month
                    ? `<div class="month">${emptyDay.month}</div>`
                    : ''
                }
              </div>
            </td>
            <td class="event">
              <div class="event-content">
                <div class="event-title" style="color: ${
                  emptyDay.events[0]._entityConfig.color
                }">
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
      while (this.shadowRoot.firstChild) {
        this.shadowRoot.removeChild(this.shadowRoot.firstChild);
      }

      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(container);
      return;
    }

    // For other states (error/loading) use simple message display
    const messages = {
      error: `<p style="color: var(--error-color, red);">${this.translations.error}</p>`,
      loading: `<p style="color: var(--secondary-text-color);">${this.translations.loading}</p>`,
    };

    this.shadowRoot.innerHTML = `
      <div class="card-content">
        ${messages[state]}
      </div>
    `;
  }

  generateCalendarContent(days) {
    if (!days.length) {
      return '<div class="no-events">No upcoming events</div>';
    }

    const dateColumnWidth = `${parseFloat(this.config.day_font_size) * 1.75}px`;
    const rowSpacingHalf = `${parseFloat(this.config.row_spacing) / 2}px`;

    return days
      .map((day) => {
        if (day.events.length === 0) return '';

        const eventRows = day.events
          .map(
            (event, index) => `
        <tr>
          ${
            index === 0
              ? `
            <td class="date" rowspan="${day.events.length}">
              <div class="date-content">
                <div class="weekday">${day.weekday}</div>
                <div class="day">${day.day}</div>
                ${
                  this.config.show_month
                    ? `<div class="month">${day.month}</div>`
                    : ''
                }
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
                  <span>${event.time}</span>
                </div>
                ${
                  event.location
                    ? `
                  <div class="location">
                    <ha-icon icon="hass:map-marker"></ha-icon>
                    <span>${event.location}</span>
                  </div>
                `
                    : ''
                }
              </div>
            </div>
          </td>
        </tr>
      `
          )
          .join('');

        return `<table>${eventRows}</table>`;
      })
      .join('');
  }

  generateDayContent(day) {
    return day.events
      .map(
        (event, index) => `
      <tr>
        ${
          index === 0
            ? `
          <td class="date" rowspan="${day.events.length}">
            <div class="date-content">
              <div class="weekday">${day.weekday}</div>
              <div class="day">${day.day}</div>
              ${
                this.config.show_month
                  ? `<div class="month">${day.month}</div>`
                  : ''
              }
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
                <span>${event.time}</span>
              </div>
              ${
                event.location
                  ? `
                <div class="location">
                  <ha-icon icon="hass:map-marker"></ha-icon>
                  <span>${event.location}</span>
                </div>
              `
                  : ''
              }
            </div>
          </div>
        </td>
      </tr>
    `
      )
      .join('');
  }

  getStyles() {
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
        --card-date-column-width: ${
          parseFloat(this.config.day_font_size) * 1.75
        }px;
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
        color: var(--card-color-month);
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

  /**
   * Handle user interactions (tap/click/hold) with the card.
   * Supports navigation, more-info, service calls, and URL actions.
   *
   * @private
   * @param {Event} event - The triggering DOM event
   * @param {Object} actionConfig - Action configuration from card config
   * @returns {void}
   */
  handleAction(event, actionConfig) {
    if (!this._hass || !actionConfig) return;

    const actions = {
      'more-info': () => this.fireMoreInfo(),
      navigate: () => this.handleNavigation(actionConfig),
      'call-service': () => this.callService(actionConfig),
      url: () => this.openUrl(actionConfig),
    };

    const action = actions[actionConfig.action];
    if (action) action();
  }

  fireMoreInfo() {
    const event = new Event('hass-more-info', {
      bubbles: true,
      composed: true,
    });
    // Use first entity from entities array instead of non-existent config.entity
    event.detail = {
      entityId: this.config.entities[0].entity || this.config.entities[0],
    };
    this.dispatchEvent(event);
  }

  handleNavigation(actionConfig) {
    if (actionConfig.navigation_path) {
      window.history.pushState(null, '', actionConfig.navigation_path);
      window.dispatchEvent(new Event('location-changed'));
    }
  }

  callService(actionConfig) {
    if (actionConfig.service) {
      const [domain, service] = actionConfig.service.split('.');
      this._hass.callService(domain, service, actionConfig.service_data || {});
    }
  }

  openUrl(actionConfig) {
    if (actionConfig.url_path) {
      window.open(actionConfig.url_path, actionConfig.open_tab || '_blank');
    }
  }

  /**
   * Debounce helper to limit function call frequency
   * @param {Function} func Function to debounce
   * @param {number} wait Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Memoize helper for caching function results
   * @param {Function} func Function to memoize
   * @returns {Function} Memoized function
   */
  memoize(func) {
    const cache = new Map();
    return (...args) => {
      const key = JSON.stringify(args);
      if (cache.has(key)) return cache.get(key);
      const result = func.apply(this, args);
      cache.set(key, result);
      return result;
    };
  }

  //=============================================================================
  // Utility Methods
  //=============================================================================

  /**
   * Performance monitoring utilities
   * @private
   */
  beginPerfMetrics() {
    return {
      startTime: performance.now(),
      eventCount: this.events.length,
    };
  }

  /**
   * End performance measurement and process results
   * @param {Object} metrics Metrics object from beginPerfMetrics
   */
  endPerfMetrics(metrics) {
    const duration = performance.now() - metrics.startTime;
    this.performanceMetrics.renderTime.push(duration);
    this.performanceMetrics.eventCount = metrics.eventCount;

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
}

// This is a placeholder for future UI editor implementation
// Currently not used since we removed getConfigElement
class CalendarCardProEditor extends HTMLElement {
  setConfig(config) {
    // Will be implemented later when we build the UI editor
  }
}

// Register the custom element
customElements.define('calendar-card-pro', CalendarCardPro);

// Card registration for HACS and Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'calendar-card-pro',
  name: 'Calendar Card Pro',
  preview: true,
  description:
    'A calendar card that supports multiple calendars with individual styling.',
  documentationURL: 'https://github.com/alexpfau/calendar-card-pro',
});
