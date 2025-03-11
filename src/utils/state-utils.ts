/* eslint-disable import/order */
/**
 * State management utilities for Calendar Card Pro
 *
 * Handles component state initialization, cleanup, and management.
 */

import * as Config from '../config/config';
import * as Constants from '../config/constants';
import * as Types from '../config/types';
import * as Logger from './logger-utils';

/**
 * Initialize component state
 *
 * @returns Initial state object for the calendar card
 */
export function initializeState(): {
  config: Types.Config;
  events: Types.CalendarEventData[];
  hass: Types.Hass | null;
  isLoading: boolean;
  isExpanded: boolean;
} {
  return {
    config: { ...Config.DEFAULT_CONFIG },
    events: [],
    hass: null,
    isLoading: true,
    isExpanded: false,
  };
}

/**
 * Clean up resources used by the component
 *
 * @param renderTimeout - Timeout reference to clear
 * @param formatTimeCache - Cache to clear
 * @param formatLocationCache - Cache to clear
 */
export function cleanup(
  renderTimeout: number | undefined,
  formatTimeCache: Types.MemoCache<string>,
  formatLocationCache: Types.MemoCache<string>,
): void {
  if (renderTimeout) {
    clearTimeout(renderTimeout);
  }
  formatTimeCache.cache.clear();
  formatLocationCache.cache.clear();
}

/**
 * Sets up page visibility handling to refresh events when returning to the page
 *
 * @param updateCallback Function to call when page visibility changes
 * @param getLastUpdateTime Function that returns the timestamp of the last update
 * @returns Cleanup function to remove the event listener
 */
export function setupVisibilityHandling(
  updateCallback: () => void,
  getLastUpdateTime: () => number,
): () => void {
  const handler = () => {
    if (document.visibilityState === 'visible') {
      const timeSinceUpdate = Date.now() - getLastUpdateTime();
      if (timeSinceUpdate > Constants.TIMING.VISIBILITY_REFRESH_THRESHOLD) {
        updateCallback();
      }
    }
  };

  document.addEventListener('visibilitychange', handler);

  // Return cleanup function
  return () => document.removeEventListener('visibilitychange', handler);
}

/**
 * Setup refresh timer with proper cleanup
 */
export function setupRefreshTimer(
  refreshCallback: (force?: boolean) => void,
  getIntervalMinutes: () => number,
): { start: () => void; stop: () => void } {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const start = () => {
    // Clear any existing timer
    if (timerId) {
      clearTimeout(timerId);
      timerId = undefined;
    }

    // Get interval in minutes, convert to milliseconds
    const intervalMinutes = getIntervalMinutes();
    const intervalMs = intervalMinutes * 60 * 1000;

    // Set up new timer
    Logger.info(`Started refresh timer with interval ${intervalMinutes} minutes`);

    timerId = setTimeout(function refreshFn() {
      refreshCallback(false);

      // Re-schedule using current interval (which might have changed)
      const newIntervalMs = getIntervalMinutes() * 60 * 1000;
      timerId = setTimeout(refreshFn, newIntervalMs);
    }, intervalMs);
  };

  const stop = () => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = undefined;
      Logger.info('Stopped refresh timer');
    }
  };

  return { start, stop };
}
