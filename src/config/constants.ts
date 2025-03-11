/**
 * Calendar Card Pro Constants
 *
 * This module contains all constant values used throughout the application.
 * Centralizing constants makes them easier to adjust and ensures consistency.
 */

/**
 * Version information
 */
export const VERSION = {
  /** Current version of Calendar Card Pro */
  CURRENT: '0.1.0',
};

/**
 * Default values for configuration
 */
export const DEFAULTS = {
  /** Default number of days to show if not specified */
  DAYS_TO_SHOW: 3,
  /** Default language */
  LANGUAGE: 'en',
  /** Default showPastEvents setting */
  SHOW_PAST_EVENTS: false,
  /** Default max events to show when compact */
  MAX_EVENTS_TO_SHOW: undefined,
};

/**
 * Display options defaults
 */
export const DISPLAY = {
  /** Default 24h time format setting */
  TIME_24H: true,
  /** Default show end time setting */
  SHOW_END_TIME: true,
  /** Default show month setting */
  SHOW_MONTH: true,
  /** Default show location setting */
  SHOW_LOCATION: true,
  /** Default remove country from location */
  REMOVE_LOCATION_COUNTRY: true,
  /** Default card title */
  TITLE: '',
};

/**
 * Layout and spacing defaults
 */
export const LAYOUT = {
  /** Default background color */
  BACKGROUND_COLOR: 'var(--ha-card-background)',
  /** Default row spacing */
  ROW_SPACING: '5px',
  /** Default additional card spacing */
  ADDITIONAL_CARD_SPACING: '0px',
  /** Default vertical line width */
  VERTICAL_LINE_WIDTH: '2px',
  /** Default vertical line color */
  VERTICAL_LINE_COLOR: '#03a9f4',
  /** Default horizontal line width */
  HORIZONTAL_LINE_WIDTH: '0px',
  /** Default horizontal line color */
  HORIZONTAL_LINE_COLOR: 'var(--secondary-text-color)',
};

/**
 * Font size defaults
 */
export const FONTS = {
  /** Default title font size */
  TITLE_FONT_SIZE: '20px',
  /** Default weekday font size */
  WEEKDAY_FONT_SIZE: '14px',
  /** Default day font size */
  DAY_FONT_SIZE: '26px',
  /** Default month font size */
  MONTH_FONT_SIZE: '12px',
  /** Default event font size */
  EVENT_FONT_SIZE: '14px',
  /** Default time font size */
  TIME_FONT_SIZE: '12px',
  /** Default location font size */
  LOCATION_FONT_SIZE: '12px',
  /** Default time/location icon size */
  TIME_LOCATION_ICON_SIZE: '16px',
};

/**
 * Color defaults
 */
export const COLORS = {
  /** Default primary text color reference */
  PRIMARY_TEXT: 'var(--primary-text-color)',
  /** Default secondary text color reference */
  SECONDARY_TEXT: 'var(--secondary-text-color)',
  /** Default title color */
  TITLE_COLOR: 'var(--primary-text-color)',
  /** Default weekday color */
  WEEKDAY_COLOR: 'var(--primary-text-color)',
  /** Default day color */
  DAY_COLOR: 'var(--primary-text-color)',
  /** Default month color */
  MONTH_COLOR: 'var(--primary-text-color)',
  /** Default event color */
  EVENT_COLOR: 'var(--primary-text-color)',
  /** Default time color */
  TIME_COLOR: 'var(--secondary-text-color)',
  /** Default location color */
  LOCATION_COLOR: 'var(--secondary-text-color)',
};

/**
 * Action defaults
 */
export const ACTIONS = {
  /** Default tap action */
  DEFAULT_TAP_ACTION: { action: 'none' },
  /** Default hold action */
  DEFAULT_HOLD_ACTION: { action: 'none' },
};

/**
 * Cache-related constants
 */
export const CACHE = {
  /** Default interval (minutes) for refreshing event data from API */
  DEFAULT_DATA_REFRESH_MINUTES: 30,

  /** Default lifetime (minutes) for cache entries before they're considered stale */
  DEFAULT_CACHE_LIFETIME_MINUTES: 30,

  /** Multiplier used with cache lifetime to calculate when entries should be purged */
  CACHE_EXPIRY_MULTIPLIER: 4,

  /** Interval (milliseconds) between cache cleanup operations */
  CACHE_CLEANUP_INTERVAL_MS: 3600000, // 1 hour

  /** Prefix for calendar event cache keys in localStorage */
  EVENT_CACHE_KEY_PREFIX: 'calendar_data_',
};

/**
 * DOM and UI constants
 */
export const UI = {
  /** Default icon size for ha-icon */
  DEFAULT_ICON_SIZE: 16,

  /** Movement threshold in pixels for detecting significant pointer movement */
  MOVEMENT_THRESHOLD: 10,

  /** Ripple effect opacity values */
  RIPPLE_OPACITY: {
    HOVER: 0.04,
    PRESSED: 0.12,
  },

  /** Opacity for hold indicators */
  HOLD_INDICATOR_OPACITY: 0.2,
};

/**
 * Timing-related constants
 */
export const TIMING = {
  /** Default ripple animation duration in milliseconds - used for delaying expand action */
  RIPPLE_ANIMATION: 500,

  /** Hold indicator threshold in milliseconds */
  HOLD_THRESHOLD: 500,

  /** Hold indicator transition duration in milliseconds */
  HOLD_INDICATOR_TRANSITION: 200,

  /** Hold indicator fadeout duration in milliseconds */
  HOLD_INDICATOR_FADEOUT: 300,

  /** Debounce time for event updates in milliseconds */
  DEBOUNCE_TIME: 300,

  /** Threshold in milliseconds for refreshing data when returning to a tab */
  VISIBILITY_REFRESH_THRESHOLD: 300000, // 5 minutes
};

/**
 * Performance-related constants
 */
export const PERFORMANCE = {
  /** Threshold in milliseconds for warning about slow rendering */
  RENDER_TIME_THRESHOLD: 300,

  /** Size of chunks for progressive rendering */
  CHUNK_SIZE: 10,

  /** Delay between rendering chunks in milliseconds */
  RENDER_DELAY: 50,

  /** Maximum number of measurements to keep in performance history */
  MAX_MEASUREMENTS: 10,
};
