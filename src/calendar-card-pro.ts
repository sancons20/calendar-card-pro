/* eslint-disable import/order */
/**
 * Calendar Card Pro
 *
 * A sleek and highly customizable calendar card for Home Assistant,
 * designed for performance and a clean, modern look.
 */

// Import Lit libraries
import { LitElement, html, css, PropertyValues, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { classMap } from 'lit/directives/class-map.js';
import { unsafeCSS } from 'lit';

// Import all types via namespace for cleaner imports
import * as Config from './config/config';
import * as Constants from './config/constants';
import * as Types from './config/types';
import * as Localize from './translations/localize';
import * as FormatUtils from './utils/format';
import * as EventUtils from './utils/events';
import * as Core from './interaction/core';
import * as Actions from './interaction/actions';
import * as Helpers from './utils/helpers';
import * as Logger from './utils/logger';
import * as Editor from './rendering/editor';
import * as Styles from './rendering/styles';
import * as Feedback from './interaction/feedback';

// Ensure this file is treated as a module
export {};

// Add global type declarations
declare global {
  interface Window {
    customCards: Array<Types.CustomCard>;
  }

  interface HTMLElementTagNameMap {
    'calendar-card-pro-dev': CalendarCardPro;
    'calendar-card-pro-dev-editor': Editor.CalendarCardProEditor;
    'ha-ripple': HTMLElement;
  }
}

/**
 * The main Calendar Card Pro component
 */
@customElement('calendar-card-pro-dev')
class CalendarCardPro extends LitElement {
  //-----------------------------------------------------------------------------
  // PROPERTIES
  //-----------------------------------------------------------------------------

  @property({ attribute: false }) hass?: Types.Hass;
  @property({ attribute: false }) config: Types.Config = { ...Config.DEFAULT_CONFIG };
  @property({ attribute: false }) events: Types.CalendarEventData[] = [];
  @property({ attribute: false }) isLoading = true;
  @property({ attribute: false }) isExpanded = false;

  // Private, non-reactive properties
  private _instanceId = Helpers.generateInstanceId();
  private _language = '';
  private _refreshTimerId?: number;
  private _lastUpdateTime = Date.now();

  // Interaction state
  private _activePointerId: number | null = null;
  private _holdTriggered = false;
  private _holdTimer: number | null = null;
  private _holdIndicator: HTMLElement | null = null;

  //-----------------------------------------------------------------------------
  // COMPUTED GETTERS
  //-----------------------------------------------------------------------------

  /**
   * Safe accessor for hass - always returns hass object or null
   */
  get safeHass(): Types.Hass | null {
    return this.hass || null;
  }

  /**
   * Get the effective language to use based on configuration and HA locale
   */
  get effectiveLanguage(): string {
    if (!this._language && this.hass) {
      this._language = Localize.getEffectiveLanguage(this.config.language, this.hass.locale);
    }
    return this._language || 'en';
  }

  /**
   * Get events grouped by day
   */
  get groupedEvents(): Types.EventsByDay[] {
    return EventUtils.groupEventsByDay(
      this.events,
      this.config,
      this.isExpanded,
      this.effectiveLanguage,
    );
  }

  //-----------------------------------------------------------------------------
  // STATIC PROPERTIES
  //-----------------------------------------------------------------------------

  static get styles() {
    return css`
      ${unsafeCSS(Styles.getBaseCardStyles())}
    `;
  }

  //-----------------------------------------------------------------------------
  // LIFECYCLE METHODS
  //-----------------------------------------------------------------------------

  constructor() {
    super();
    this._instanceId = Helpers.generateInstanceId();
    Logger.initializeLogger(Constants.VERSION.CURRENT);
  }

  connectedCallback() {
    super.connectedCallback();
    Logger.debug('Component connected');

    // Set up refresh timer
    this.startRefreshTimer();

    // Load events on initial connection
    this.updateEvents();

    // Set up visibility listener
    document.addEventListener('visibilitychange', this._handleVisibilityChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    // Clean up timers
    if (this._refreshTimerId) {
      clearTimeout(this._refreshTimerId);
    }

    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }

    // Clean up hold indicator if it exists
    if (this._holdIndicator) {
      Feedback.removeHoldIndicator(this._holdIndicator);
      this._holdIndicator = null;
    }

    // Remove listeners
    document.removeEventListener('visibilitychange', this._handleVisibilityChange);

    Logger.debug('Component disconnected');
  }

  firstUpdated() {
    // Style updates need to happen after first render
    this.updateStyles();
  }

  updated(changedProps: PropertyValues) {
    // Update language if locale or config language changed
    if (
      (changedProps.has('hass') && this.hass?.locale) ||
      (changedProps.has('config') && changedProps.get('config')?.language !== this.config.language)
    ) {
      this._language = Localize.getEffectiveLanguage(this.config.language, this.hass?.locale);
    }

    // Update styles if config changed
    if (changedProps.has('config')) {
      this.updateStyles();
    }
  }

  //-----------------------------------------------------------------------------
  // PRIVATE METHODS
  //-----------------------------------------------------------------------------

  /**
   * Update custom CSS properties based on configuration
   */
  private updateStyles() {
    // Generate custom properties from config
    const customProperties = Styles.generateCustomProperties(this.config);
    this.style.cssText = customProperties;
  }

  /**
   * Handle visibility changes to refresh data when returning to the page
   */
  private _handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      // Only refresh if it's been a while
      if (now - this._lastUpdateTime > Constants.TIMING.VISIBILITY_REFRESH_THRESHOLD) {
        Logger.debug('Visibility changed to visible, updating events');
        this.updateEvents();
      }
    }
  };

  /**
   * Start the refresh timer
   */
  private startRefreshTimer() {
    if (this._refreshTimerId) {
      clearTimeout(this._refreshTimerId);
    }

    const refreshMinutes =
      this.config.refresh_interval || Constants.CACHE.DEFAULT_DATA_REFRESH_MINUTES;
    const refreshMs = refreshMinutes * 60 * 1000;

    this._refreshTimerId = window.setTimeout(() => {
      this.updateEvents();
      this.startRefreshTimer();
    }, refreshMs);

    Logger.debug(`Scheduled next refresh in ${refreshMinutes} minutes`);
  }

  /**
   * Handle pointer down events for hold detection
   */
  private _handlePointerDown(ev: PointerEvent) {
    // Store this pointer ID to track if it's the same pointer throughout
    this._activePointerId = ev.pointerId;
    this._holdTriggered = false;

    // Only set up hold timer if hold action is configured
    if (this.config.hold_action?.action !== 'none') {
      // Clear any existing timer
      if (this._holdTimer) {
        clearTimeout(this._holdTimer);
      }

      // Start a new hold timer
      this._holdTimer = window.setTimeout(() => {
        if (this._activePointerId === ev.pointerId) {
          this._holdTriggered = true;

          // Create hold indicator for visual feedback
          this._holdIndicator = Feedback.createHoldIndicator(ev, this.config);
        }
      }, Constants.TIMING.HOLD_THRESHOLD);
    }
  }

  /**
   * Handle pointer up events to execute actions
   */
  private _handlePointerUp(ev: PointerEvent) {
    // Only process if this is the pointer we've been tracking
    if (ev.pointerId !== this._activePointerId) return;

    // Clear hold timer
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }

    // Execute the appropriate action based on whether hold was triggered
    if (this._holdTriggered && this.config.hold_action) {
      Logger.debug('Executing hold action');
      const entityId = Core.getPrimaryEntityId(this.config.entities);
      Actions.handleAction(this.config.hold_action, this.safeHass, this, entityId, () =>
        this.toggleExpanded(),
      );
    } else if (!this._holdTriggered && this.config.tap_action) {
      Logger.debug('Executing tap action');
      const entityId = Core.getPrimaryEntityId(this.config.entities);
      Actions.handleAction(this.config.tap_action, this.safeHass, this, entityId, () =>
        this.toggleExpanded(),
      );
    }

    // Reset state
    this._activePointerId = null;
    this._holdTriggered = false;

    // Remove hold indicator if it exists
    if (this._holdIndicator) {
      Feedback.removeHoldIndicator(this._holdIndicator);
      this._holdIndicator = null;
    }
  }

  /**
   * Handle pointer cancel/leave events to clean up
   */
  private _handlePointerCancel() {
    // Clear hold timer
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }

    // Reset state
    this._activePointerId = null;
    this._holdTriggered = false;

    // Remove hold indicator if it exists
    if (this._holdIndicator) {
      Feedback.removeHoldIndicator(this._holdIndicator);
      this._holdIndicator = null;
    }
  }

  /**
   * Handle keyboard navigation for accessibility
   */
  private _handleKeyDown(ev: KeyboardEvent) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      const entityId = Core.getPrimaryEntityId(this.config.entities);
      Actions.handleAction(this.config.tap_action, this.safeHass, this, entityId, () =>
        this.toggleExpanded(),
      );
    }
  }

  //-----------------------------------------------------------------------------
  // PUBLIC METHODS
  //-----------------------------------------------------------------------------

  /**
   * Handle configuration updates from Home Assistant
   */
  setConfig(config: Partial<Types.Config>) {
    const previousConfig = this.config;
    this.config = { ...Config.DEFAULT_CONFIG, ...config };
    this.config.entities = Config.normalizeEntities(this.config.entities);

    // Generate deterministic ID for caching
    this._instanceId = Helpers.generateDeterministicId(
      this.config.entities,
      this.config.days_to_show,
      this.config.show_past_events,
    );

    // Check if we need to reload data
    const configChanged = Config.hasConfigChanged(previousConfig, this.config);
    if (configChanged) {
      Logger.debug('Configuration changed, refreshing data');
      this.updateEvents(true);
    }

    // Restart the timer with new config
    this.startRefreshTimer();
  }

  /**
   * Update calendar events from API or cache
   */
  async updateEvents(force = false): Promise<void> {
    Logger.debug(`Updating events (force=${force})`);

    // Skip update if no Home Assistant connection or no entities
    if (!this.safeHass || !this.config.entities.length) {
      this.isLoading = false;
      return;
    }

    try {
      this.isLoading = true;

      const cacheKey = EventUtils.getBaseCacheKey(
        this._instanceId,
        this.config.entities,
        this.config.days_to_show,
        this.config.show_past_events,
      );

      // Try to get from cache first
      const isManualReload = false; // Simplified case
      if (!force) {
        const cachedEvents = EventUtils.getCachedEvents(cacheKey, this.config, isManualReload);
        if (cachedEvents) {
          Logger.info(`Using ${cachedEvents.length} events from cache`);
          // Fix for TypeScript error: Create a mutable copy of the readonly array
          this.events = [...cachedEvents];
          this.isLoading = false;
          this._lastUpdateTime = Date.now();
          return;
        }
      }

      // Fetch from API
      Logger.info('Fetching events from API');
      const entities = this.config.entities.map((e) =>
        typeof e === 'string' ? { entity: e, color: 'var(--primary-text-color)' } : e,
      );

      const timeWindow = EventUtils.getTimeWindow(this.config.days_to_show);
      const fetchedEvents = await EventUtils.fetchEvents(this.safeHass, entities, timeWindow);

      // Fix for TypeScript error: Create a mutable copy of the readonly array
      const mutableEvents = Array.from(fetchedEvents);

      // Cache the results
      EventUtils.cacheEvents(cacheKey, mutableEvents);

      // Update component state with a new array
      this.events = [...mutableEvents];
      this._lastUpdateTime = Date.now();

      Logger.info('Event update completed successfully');
    } catch (error) {
      Logger.error('Failed to update events:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Toggle expanded state for view modes with limited events
   */
  toggleExpanded(): void {
    if (this.config.max_events_to_show) {
      this.isExpanded = !this.isExpanded;
    }
  }

  /**
   * Handle user action
   */
  handleAction(actionConfig: Types.ActionConfig): void {
    const entityId = Core.getPrimaryEntityId(this.config.entities);
    Actions.handleAction(actionConfig, this.safeHass, this, entityId, () => this.toggleExpanded());
  }

  //-----------------------------------------------------------------------------
  // RENDERING
  //-----------------------------------------------------------------------------

  render() {
    // Show loading state
    if (this.isLoading) {
      return this._renderError('loading');
    }

    // Show error state if missing hass or entities
    if (!this.safeHass || !this.config.entities.length) {
      return this._renderError('error');
    }

    // Get grouped events
    const eventsByDay = this.groupedEvents;

    // Show empty state if no events
    if (eventsByDay.length === 0) {
      return this._renderError('empty');
    }

    // Regular rendering
    return html`
      <ha-card
        tabindex="0"
        @keydown=${this._handleKeyDown}
        @pointerdown=${this._handlePointerDown}
        @pointerup=${this._handlePointerUp}
        @pointercancel=${this._handlePointerCancel}
        @pointerleave=${this._handlePointerCancel}
      >
        <ha-ripple></ha-ripple>
        <div class="calendar-card">
          ${this.config.title ? html`<h1 class="header">${this.config.title}</h1>` : ''}
          ${eventsByDay.map((day) => this._renderDay(day))}
        </div>
      </ha-card>
    `;
  }

  /**
   * Render a single day with its events
   */
  private _renderDay(day: Types.EventsByDay) {
    return html`
      <table>
        ${repeat(
          day.events,
          (event, index) => `${event._entityId}-${event.summary}-${index}`,
          (event, index) => this._renderEvent(event, day, index),
        )}
      </table>
    `;
  }

  /**
   * Render a single event
   */
  private _renderEvent(event: Types.CalendarEventData, day: Types.EventsByDay, index: number) {
    // Get color from config based on entity ID
    const entityColor = EventUtils.getEntityColor(event._entityId, this.config);

    // Format event time and location
    const eventTime = FormatUtils.formatEventTime(event, this.config, this.effectiveLanguage);
    const eventLocation =
      event.location && this.config.show_location
        ? FormatUtils.formatLocation(event.location, this.config.remove_location_country)
        : '';

    // Determine event position for styling
    const isFirst = index === 0;
    const isLast = index === day.events.length - 1;
    const isMiddle = !isFirst && !isLast;

    // Create class map with position classes
    const eventClasses = {
      event: true,
      'event-first': isFirst,
      'event-middle': isMiddle,
      'event-last': isLast,
    };

    return html`
      <tr>
        ${index === 0
          ? html`
              <td class="date-column" rowspan="${day.events.length}">
                <div class="date-content">
                  <div class="weekday">${day.weekday}</div>
                  <div class="day">${day.day}</div>
                  ${this.config.show_month ? html`<div class="month">${day.month}</div>` : ''}
                </div>
              </td>
            `
          : ''}
        <td class=${classMap(eventClasses)}>
          <div class="event-content">
            <div class="event-title" style="color: ${entityColor}">${event.summary}</div>
            <div class="time-location">
              <div class="time">
                <ha-icon icon="mdi:clock-outline"></ha-icon>
                <span>${eventTime}</span>
              </div>
              ${eventLocation
                ? html`
                    <div class="location">
                      <ha-icon icon="mdi:map-marker"></ha-icon>
                      <span>${eventLocation}</span>
                    </div>
                  `
                : ''}
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Render error, loading, or empty states
   */
  private _renderError(state: 'loading' | 'empty' | 'error') {
    const translations = Localize.getTranslations(this.effectiveLanguage);

    if (state === 'loading') {
      return html`
        <ha-card>
          <div class="calendar-card">
            <div class="loading">${translations.loading}</div>
          </div>
        </ha-card>
      `;
    }

    if (state === 'error') {
      return html`
        <ha-card>
          <div class="calendar-card">
            <div class="error">${translations.error}</div>
          </div>
        </ha-card>
      `;
    }

    // Empty state
    const now = new Date();
    const emptyDay = {
      weekday: Localize.getDayName(this.effectiveLanguage, now.getDay()),
      day: now.getDate(),
      month: Localize.getMonthName(this.effectiveLanguage, now.getMonth()),
    };

    return html`
      <ha-card>
        <div class="calendar-card">
          <table>
            <tr>
              <td class="date-column" rowspan="1">
                <div class="date-content">
                  <div class="weekday">${emptyDay.weekday}</div>
                  <div class="day">${emptyDay.day}</div>
                  ${this.config.show_month ? html`<div class="month">${emptyDay.month}</div>` : ''}
                </div>
              </td>
              <td class="event">
                <div class="event-content">
                  <div class="event-title">${translations.noEvents}</div>
                </div>
              </td>
            </tr>
          </table>
        </div>
      </ha-card>
    `;
  }
}

//-----------------------------------------------------------------------------
// ELEMENT REGISTRATION
//-----------------------------------------------------------------------------

// Register the editor - main component registered by decorator
customElements.define('calendar-card-pro-dev-editor', Editor.CalendarCardProEditor);

// Register with HACS
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'calendar-card-pro-dev',
  name: 'Calendar Card Pro',
  preview: true,
  description: 'A calendar card that supports multiple calendars with individual styling.',
  documentationURL: 'https://github.com/alexpfau/calendar-card-pro',
});
