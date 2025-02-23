/**
 * CalendarCardPro - An enhanced calendar card component for Home Assistant
 * 
 * Features:
 * - Configurable display of calendar events
 * - Event caching support
 * - Multi-language support (en/de)
 * - Customizable styling
 * - Touch and mouse interaction handling
 * - Responsive design
 */
class CalendarCardPro extends HTMLElement {
  // Static configuration
  static get DEFAULT_CONFIG() {
    return {
      title: '',
      title_font_size: '20px',
      title_color: 'var(--primary-text-color)',
      language: 'en',
      days_to_show: 3,
      cache_duration: 300,
      show_past_events: false,
      vertical_line_width: '2px',
      vertical_line_color: '#03a9f4',
      horizontal_line_width: '0px',
      horizontal_line_color: 'var(--secondary-text-color)',
      additional_card_spacing: '0px',
      row_spacing: '5px',
      weekday_font_size: '14px',
      weekday_color: 'var(--primary-text-color)',
      day_font_size: '26px',
      day_color: 'var(--primary-text-color)',
      show_month: true,
      month_font_size: '12px',
      month_color: 'var(--primary-text-color)',
      event_font_size: '14px',
      event_color: 'var(--primary-text-color)',
      show_end_time: true,
      time_24h: true,
      time_font_size: '12px',
      time_color: 'var(--secondary-text-color)',
      show_location: true,
      location_remove_country: true,
      location_font_size: '12px',
      location_color: 'var(--secondary-text-color)',
      icon_size: '16px',
    };
  }

  static get TRANSLATIONS() {
    return {
      en: {
        daysOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        allDay: 'all-day',
        multiDay: 'multi-day until'
      },
      de: {
        daysOfWeek: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
        months: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
        allDay: 'ganztägig',
        multiDay: 'mehrtägig bis'
      }
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.initializeState();
  }

  /**
   * Initialize component state with default values
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
      holdTriggered: false
    };
    this.isLoading = true;  // Add loading state
  }

  /**
   * Getter for translations based on configured language
   */
  get translations() {
    const lang = this.config.language || 'en';
    return CalendarCardPro.TRANSLATIONS[lang] || CalendarCardPro.TRANSLATIONS.en;
  }

  /**
   * Update Home Assistant connection and refresh events
   */
  set hass(hass) {
    this._hass = hass;
    this.updateEvents();
  }

  /**
   * Update component configuration and render
   */
  setConfig(config) {
    this.config = { ...CalendarCardPro.DEFAULT_CONFIG, ...config };
    this.renderCard();
  }

  /**
   * Fetch and cache calendar events
   */
  async updateEvents() {
    if (!this.isValidState()) return;
    
    const cachedData = this.getCachedEvents();
    if (cachedData) {
        this.events = cachedData;
        this.renderCard(); // Render with cached events
    }
    
    this.isLoading = true;
    const { events, error } = await this.fetchEvents();
    this.isLoading = false;
    
    if (error) {
        console.error('Failed to fetch calendar events:', error);
        this.events = cachedData || []; // Use cached events if available
    } else {
        this.events = events;
        this.cacheEvents(events);
    }
    this.renderCard(); // Render with new events
}

  /**
   * Check if component state is valid for updates
   */
  isValidState() {
    if (!this._hass || !this.config.entity) {
      return false;
    }
    return true;
  }

  /**
   * Fetch events from API or cache
   */
  async fetchEvents() {
    const timeWindow = this.getTimeWindow();
    const cachedData = this.getCachedEvents();

    if (cachedData) return { events: cachedData };

    try {
      const events = await this._hass.callApi(
        'GET',
        `calendars/${this.config.entity}?start=${timeWindow.start.toISOString()}&end=${timeWindow.end.toISOString()}`
      );
      this.cacheEvents(events);
      return { events };
    } catch (error) {
      return { error };
    }
  }

  /**
   * Calculate time window for event fetching
   * @returns {Object} - Object containing start and end dates
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
   * Get cached events with error handling
   * @returns {Array|null} - Cached events or null if no valid cache exists
   */
  getCachedEvents() {
    const cacheKey = `calendar_${this.config.entity}`;
    try {
      const cache = JSON.parse(localStorage.getItem(cacheKey));
      const cacheDuration = (this.config.cache_duration || 300) * 1000;
      
      if (cache && (Date.now() - cache.timestamp < cacheDuration)) {
        sessionStorage.setItem(cacheKey, "used");
        return cache.events;
      }
    } catch (error) {
      console.warn('Calendar-Card-Pro: Failed to retrieve cached events:', error);
    }
    return null;
  }

  /**
   * Cache events in localStorage with error handling
   * @param {Array} events - Array of calendar events to cache
   * @returns {boolean} - Success status of caching operation
   */
  cacheEvents(events) {
    const cacheKey = `calendar_${this.config.entity}`;
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        events,
        timestamp: Date.now()
      }));
      return true;
    } catch (error) {
      console.warn('Calendar-Card-Pro: Failed to cache events:', error);
      return false;
    }
  }

  /**
   * Format event time based on configuration
   */
  formatEventTime(event) {
    const startDate = new Date(event.start.dateTime || event.start.date);
    const endDate = new Date(event.end.dateTime || event.end.date);

    if (!event.start.dateTime) {
      return this.translations.allDay;
    }

    if (startDate.toDateString() !== endDate.toDateString()) {
      return this.formatMultiDayTime(startDate, endDate);
    }

    return this.formatSingleDayTime(startDate, endDate);
  }

  /**
   * Format time for multi-day events
   */
  formatMultiDayTime(startDate, endDate) {
    const endDay = endDate.getDate();
    const endMonthName = this.translations.months[endDate.getMonth()];
    const endWeekday = this.translations.daysOfWeek[endDate.getDay()];
    
    return `${this.formatTime(startDate)}, ${this.translations.multiDay} ${endWeekday}, ${endMonthName} ${endDay}`;
  }

  /**
   * Format time for single-day events
   */
  formatSingleDayTime(startDate, endDate) {
    return this.config.show_end_time
      ? `${this.formatTime(startDate)} - ${this.formatTime(endDate)}`
      : this.formatTime(startDate);
  }

  /**
   * Format time according to 12/24 hour setting
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
   * Handle user interactions (tap, double tap, hold)
   */
  handleAction(event, actionConfig) {
    if (!this._hass || !actionConfig) return;

    const actions = {
      'more-info': () => this.fireMoreInfo(),
      'navigate': () => this.handleNavigation(actionConfig),
      'call-service': () => this.callService(actionConfig),
      'url': () => this.openUrl(actionConfig)
    };

    const action = actions[actionConfig.action];
    if (action) action();
  }

  /**
   * Fire more-info event
   */
  fireMoreInfo() {
    const event = new Event("hass-more-info", { bubbles: true, composed: true });
    event.detail = { entityId: this.config.entity };
    this.dispatchEvent(event);
  }

  /**
   * Handle navigation action
   */
  handleNavigation(actionConfig) {
    if (actionConfig.navigation_path) {
      window.history.pushState(null, "", actionConfig.navigation_path);
      window.dispatchEvent(new Event("location-changed"));
    }
  }

  /**
   * Call Home Assistant service
   */
  callService(actionConfig) {
    if (actionConfig.service) {
      const [domain, service] = actionConfig.service.split(".");
      this._hass.callService(domain, service, actionConfig.service_data || {});
    }
  }

  /**
   * Open URL in new window/tab
   */
  openUrl(actionConfig) {
    if (actionConfig.url_path) {
      window.open(actionConfig.url_path, actionConfig.open_tab || "_blank");
    }
  }

  /**
   * Generate styles for the card
   */
  getStyles() {
    return `
      /* Base styles */
      :host {
        display: block;
      }
      
      /* Card container styles */
      .card-container {
        cursor: pointer;
        width: 100%;
        height: 100%;
      }
      
      /* ... rest of your existing styles ... */
    `;
  }

  /**
   * Render the calendar card
   */
  renderCard() {
    if (!this.isValidState()) {
        this.renderError('error');
        return;
    }
    
    if (this.isLoading && !this.events.length) {
        this.renderError('loading');
        return;
    }
    
    const eventsByDay = this.groupEventsByDay();
    const calendarContent = this.generateCalendarContent(eventsByDay);
    
    this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="card-container">
            <div class="card-content">
                ${this.config.title ? `<div class="title">${this.config.title}</div>` : ''}
                ${calendarContent}
            </div>
        </div>
    `;
    this.setupEventListeners();
}

 /**
   * Render error or loading message when needed
   */
  renderError(state) {
    const messages = {
      error: '<p style="color: var(--error-color, red);">Error: Calendar entity not found or improperly configured.</p>',
      loading: '<p style="color: var(--secondary-text-color);">Loading calendar events...</p>'
    };

    this.shadowRoot.innerHTML = `
      <div class="card-content">
        ${messages[state]}
      </div>
    `;
  }

/**
 * Group events by day for display
 */
groupEventsByDay() {
  let eventsByDay = {};
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);
  
  this.events.forEach(event => {
    const startDate = new Date(event.start.dateTime || event.start.date);
    const eventDateKey = startDate.toISOString().split('T')[0];
    const isAllDayEvent = !event.start.dateTime;
    const isEventToday = startDate >= todayStart && startDate <= todayEnd;
    const isFutureEvent = startDate > todayEnd;

    // Skip past days' events
    if (!isEventToday && !isFutureEvent) {
      return;
    }

    // Handle today's events
    if (isEventToday && !isAllDayEvent && !this.config.show_past_events) {
      if (startDate < now) {
        return;
      }
    }

    // Add event to the appropriate day
    if (!eventsByDay[eventDateKey]) {
      eventsByDay[eventDateKey] = {
        weekday: this.translations.daysOfWeek[startDate.getDay()],
        day: startDate.getDate(),
        month: this.translations.months[startDate.getMonth()],
        timestamp: startDate.getTime(),
        events: []
      };
    }

    let location = this.formatLocation(event.location);
    eventsByDay[eventDateKey].events.push({
      summary: event.summary,
      time: this.formatEventTime(event),
      location: location
    });
  });

  // Sort by date and return configured number of days
  const daysToShow = parseInt(this.config.days_to_show) || 3;
  return Object.values(eventsByDay)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, daysToShow);
}

/**
 * Format location string based on configuration
 */
formatLocation(location) {
  if (!this.config.show_location || !location) return '';
  
  if (this.config.location_remove_country) {
    return location.replace(/,\s*(Germany|Deutschland)$/i, '');
  }
  return location;
}

/**
 * Generate HTML content for calendar display
 */
generateCalendarContent(days) {
  if (!days.length) {
    return '<div class="no-events">No upcoming events</div>';
  }

  const dateColumnWidth = `${parseFloat(this.config.day_font_size) * 1.75}px`;
  const rowSpacingHalf = `${parseFloat(this.config.row_spacing) / 2}px`;
  
  return days.map(day => {
    if (day.events.length === 0) return '';

    const eventRows = day.events.map((event, index) => `
      <tr>
        ${index === 0 ? `
          <td class="date" rowspan="${day.events.length}">
            <div class="date-content">
              <div class="weekday">${day.weekday}</div>
              <div class="day">${day.day}</div>
              ${this.config.show_month ? `<div class="month">${day.month}</div>` : ''}
            </div>
          </td>
        ` : ''}
        <td class="event">
          <div class="event-content">
            <div class="event-title">${event.summary}</div>
            <div class="time-location">
              <div class="time">
                <ha-icon icon="hass:clock-outline"></ha-icon>
                <span>${event.time}</span>
              </div>
              ${event.location ? `
                <div class="location">
                  <ha-icon icon="hass:map-marker"></ha-icon>
                  <span>${event.location}</span>
                </div>
              ` : ''}
            </div>
          </div>
        </td>
      </tr>
    `).join('');

    return `<table>${eventRows}</table>`;
  }).join('');
}

/**
 * Get complete styles for the card
 */
getStyles() {
  return `
    :host {
      display: block;
    }
    .card-container {
      cursor: pointer;
      width: 100%;
      height: 100%;
    }
    .card-content {
      background: var(--ha-card-background, var(--card-background-color, #FFF));
      border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color));
      border-radius: var(--ha-card-border-radius, 10px);
      padding: 16px;
      padding-top: calc(16px + ${this.config.additional_card_spacing});
      padding-bottom: calc(16px + ${this.config.additional_card_spacing});
    }
    .title {
      font-size: ${this.config.title_font_size};
      line-height: ${this.config.title_font_size};
      font-weight: 500;
      color: ${this.config.title_color};
      margin-bottom: 16px;
    }
    ha-icon {
      margin-right: 4px;
      --mdc-icon-size: ${this.config.icon_size};
      vertical-align: middle;
      position: relative;
    }
    table {
      width: 100%;
      table-layout: fixed;
      border-spacing: 0;
      margin-bottom: ${this.config.row_spacing};
      border-bottom: ${this.config.horizontal_line_width} solid ${this.config.horizontal_line_color};
      padding-bottom: ${this.config.row_spacing};
    }
    .date {
      width: ${parseFloat(this.config.day_font_size) * 1.75}px;
      text-align: center;
      padding-right: 12px;
      border-right: ${this.config.vertical_line_width} solid ${this.config.vertical_line_color};
    }
    .weekday {
      font-size: ${this.config.weekday_font_size};
      line-height: ${this.config.weekday_font_size};
      color: ${this.config.weekday_color};
    }
    .day {
      font-size: ${this.config.day_font_size};
      line-height: ${this.config.day_font_size};
      font-weight: 500;
      color: ${this.config.day_color};
    }
    .month {
      font-size: ${this.config.month_font_size};
      line-height: ${this.config.month_font_size};
      text-transform: uppercase;
      color: ${this.config.month_color};
    }
    .event {
      padding-left: 12px;
    }
    .event-title {
      font-size: ${this.config.event_font_size};
      font-weight: 500;
      color: ${this.config.event_color};
    }
    .time-location {
      display: flex;
      flex-direction: column;
      margin-top: 4px;
    }
    .time, .location {
      display: flex;
      align-items: center;
      line-height: 1.2;
    }
    .time {
      font-size: ${this.config.time_font_size};
      color: ${this.config.time_color};
    }
    .location {
      font-size: ${this.config.location_font_size};
      color: ${this.config.location_color};
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
 * Handle touch start event
 */
handleTouchStart(e) {
  const touch = e.touches[0];
  this.touchState = {
    touchStartY: touch.clientY,
    touchStartX: touch.clientX,
    holdTriggered: false,
    holdTimer: setTimeout(() => {
      this.handleAction(e, this.config.hold_action);
      this.touchState.holdTriggered = true;
    }, 500)
  };
}

/**
 * Handle touch move event
 */
handleTouchMove(e) {
  if (!this.touchState) return;

  const touch = e.touches[0];
  const deltaY = Math.abs(touch.clientY - this.touchState.touchStartY);
  const deltaX = Math.abs(touch.clientX - this.touchState.touchStartX);

  if (deltaY > 10 && deltaY > deltaX) {
    clearTimeout(this.touchState.holdTimer);
  }
}

/**
   * Handle touch end event
   */
  handleTouchEnd(e) {
    if (!this.touchState) return;

    clearTimeout(this.touchState.holdTimer);

    const deltaX = Math.abs(this.touchState.touchStartX - e.changedTouches[0].clientX);
    const deltaY = Math.abs(this.touchState.touchStartY - e.changedTouches[0].clientY);
    const swipeThreshold = 10;

    // Prevent tap action if hold action was triggered or if a swipe was detected
    if (this.touchState.holdTriggered || deltaX > swipeThreshold || deltaY > swipeThreshold) {
      this.touchState.holdTriggered = false;
      return;
    }

    this.handleAction(e, this.config.tap_action);
  }

/**
 * Handle touch cancel event
 */
handleTouchCancel() {
  if (this.touchState?.holdTimer) {
    clearTimeout(this.touchState.holdTimer);
  }
}

/**
 * Handle mouse click event
 */
handleClick(e) {
  this.handleAction(e, this.config.tap_action);
}

/**
 * Handle mouse down event
 */
handleMouseDown(e) {
  this.mouseHoldTimer = setTimeout(() => {
    this.handleAction(e, this.config.hold_action);
  }, 500);
}

/**
 * Handle mouse up event
 */
handleMouseUp() {
  if (this.mouseHoldTimer) {
    clearTimeout(this.mouseHoldTimer);
  }
}

/**
 * Handle mouse leave event
 */
handleMouseLeave() {
  if (this.mouseHoldTimer) {
    clearTimeout(this.mouseHoldTimer);
  }
}

/**
 * Sets up event listeners for touch and mouse interactions
 */
setupEventListeners() {
  const cardContainer = this.shadowRoot.querySelector(".card-container");
  if (!cardContainer) return;

  // Touch events
  cardContainer.addEventListener("touchstart", this.handleTouchStart.bind(this), { passive: false });
  cardContainer.addEventListener("touchmove", this.handleTouchMove.bind(this), { passive: true });
  cardContainer.addEventListener("touchend", this.handleTouchEnd.bind(this));
  cardContainer.addEventListener("touchcancel", this.handleTouchCancel.bind(this));

  // Mouse events
  cardContainer.addEventListener("click", this.handleClick.bind(this));
  cardContainer.addEventListener("mousedown", this.handleMouseDown.bind(this));
  cardContainer.addEventListener("mouseup", this.handleMouseUp.bind(this));
  cardContainer.addEventListener("mouseleave", this.handleMouseLeave.bind(this));
}
}

// Register the custom element
customElements.define('calendar-card-pro', CalendarCardPro);