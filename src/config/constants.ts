/**
 * Calendar Card Pro Constants
 *
 * This module contains all constant values used throughout the application.
 * Centralizing constants makes them easier to adjust and ensures consistency.
 */

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
};

/**
 * Timing-related constants
 */
export const TIMING = {
  /** Hold duration threshold in milliseconds */
  HOLD_THRESHOLD: 500,

  /** Default ripple animation duration */
  RIPPLE_ANIMATION: 500,

  /** Default cache duration (in days) for cleaning up old entries */
  CACHE_CLEANUP_DAYS: 1,
};

/**
 * Cache-related constants
 */
export const CACHE = {
  /** Multiplier for cleanup duration relative to cache_duration */
  CLEANUP_MULTIPLIER: 4,

  /** Prefix for calendar event cache keys */
  KEY_PREFIX: 'calendar_data_',

  /** Default cache duration in minutes (fallback if config not provided) */
  DEFAULT_DURATION_MINUTES: 30,
};

/**
 * DOM and UI constants
 */
export const UI = {
  /** Default icon size for ha-icon */
  DEFAULT_ICON_SIZE: 16,
};
