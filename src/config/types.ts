/**
 * Type definitions for Calendar Card Pro
 *
 * This file contains all type definitions used throughout the Calendar Card Pro application.
 */

// -----------------------------------------------------------------------------
// Window & Global Declarations
// -----------------------------------------------------------------------------

/**
 * Custom card registration interface for Home Assistant
 */
export interface CustomCard {
  type: string;
  name: string;
  preview: boolean;
  description: string;
  documentationURL?: string;
}

/**
 * Home Assistant more-info event interface
 */
export interface HassMoreInfoEvent extends CustomEvent {
  detail: {
    entityId: string;
  };
}

// -----------------------------------------------------------------------------
// Translations
// -----------------------------------------------------------------------------

/**
 * Interface for language translations
 */
export interface Translations {
  daysOfWeek: string[];
  fullDaysOfWeek: string[];
  months: string[];
  allDay: string;
  multiDay: string;
  at: string;
  noEvents: string;
  loading: string;
  error: string;
}

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/**
 * Calendar entity configuration
 */
export interface EntityConfig {
  entity: string;
  color?: string;
}

/**
 * Main configuration interface for the card
 */
export interface Config {
  entities: Array<string | EntityConfig>;
  days_to_show: number;
  max_events_to_show?: number;
  show_past_events: boolean;
  refresh_interval: number;
  language: string;
  time_24h: boolean;
  show_end_time: boolean;
  show_month: boolean;
  show_location: boolean;
  remove_location_country: boolean;
  title: string;
  background_color: string;
  row_spacing: string;
  additional_card_spacing: string;
  vertical_line_width: string;
  vertical_line_color: string;
  horizontal_line_width: string;
  horizontal_line_color: string;
  title_font_size: string;
  weekday_font_size: string;
  day_font_size: string;
  month_font_size: string;
  event_font_size: string;
  time_font_size: string;
  location_font_size: string;
  time_location_icon_size: string;
  title_color: string;
  weekday_color: string;
  day_color: string;
  month_color: string;
  event_color: string;
  time_color: string;
  location_color: string;
  tap_action: ActionConfig;
  hold_action: ActionConfig;
}

// -----------------------------------------------------------------------------
// Calendar Events
// -----------------------------------------------------------------------------

/**
 * Calendar event data structure
 */
export interface CalendarEventData {
  readonly start: { readonly dateTime?: string; readonly date?: string };
  readonly end: { readonly dateTime?: string; readonly date?: string };
  summary?: string;
  location?: string;
  _entityConfig?: { color: string; entity: string };
  time?: string;
}

/**
 * Grouped events by day
 */
export interface EventsByDay {
  weekday: string;
  day: number;
  month: string;
  timestamp: number;
  events: CalendarEventData[];
}

// -----------------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------------

/**
 * Action configuration for tap and hold actions
 */
export interface ActionConfig {
  action: string;
  navigation_path?: string;
  service?: string;
  service_data?: object;
  url_path?: string;
  open_tab?: string;
}

// -----------------------------------------------------------------------------
// Home Assistant
// -----------------------------------------------------------------------------

/**
 * Home Assistant interface
 */
export interface Hass {
  states: Record<string, { state: string }>;
  callApi: (method: string, path: string) => Promise<unknown>;
  callService: (domain: string, service: string, serviceData?: object) => void;
}

// -----------------------------------------------------------------------------
// Utility Types
// -----------------------------------------------------------------------------

/**
 * Cache entry structure
 */
export interface CacheEntry {
  events: CalendarEventData[];
  timestamp: number;
}

/**
 * Performance monitoring data
 */
export interface PerformanceData {
  readonly renderTime: number[];
  eventCount: number;
  lastUpdate: number;
}

/**
 * Performance metrics structure
 */
export interface PerfMetrics {
  startTime: number;
  eventCount: number;
}

/**
 * Memoization cache interface
 */
export interface MemoCache<T> {
  readonly cache: Map<string, T>;
  clear(): void;
}
