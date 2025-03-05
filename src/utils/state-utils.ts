/* eslint-disable import/order */
/**
 * State management utilities for Calendar Card Pro
 *
 * Handles component state initialization, cleanup, and management.
 */

import * as Types from '../config/types';
import * as EventUtils from './event-utils';
import * as Logger from './logger-utils';

/**
 * Initialize component state
 *
 * @returns Initial state object for the calendar card
 */
export function initializeState(): {
  config: Types.Config;
  events: Types.CalendarEventData[];
  hass: null;
  rendered: boolean;
  touchState: {
    touchStartY: number;
    touchStartX: number;
    holdTimer: number | null;
    holdTriggered: boolean;
  };
  isLoading: boolean;
  isExpanded: boolean;
} {
  return {
    config: {} as Types.Config,
    events: [],
    hass: null,
    rendered: false,
    touchState: {
      touchStartY: 0,
      touchStartX: 0,
      holdTimer: null,
      holdTriggered: false,
    },
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
 * Clean up cache entries for specified calendar entities
 *
 * @param entities - Calendar entities to clean up
 */
export function cleanupCache(entities: Array<string | { entity: string; color?: string }>): void {
  const cachePrefix = `calendar_${entities.join('_')}`;
  EventUtils.cleanupCache(cachePrefix);
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
      if (timeSinceUpdate > 5 * 60 * 1000) {
        // 5 minutes
        updateCallback();
      }
    }
  };

  document.addEventListener('visibilitychange', handler);

  // Return cleanup function
  return () => document.removeEventListener('visibilitychange', handler);
}

/**
 * Sets up automatic refresh timer based on configuration
 *
 * @param updateCallback Function to call when timer triggers
 * @param getRefreshInterval Function that returns the refresh interval in minutes
 * @returns Object with timer control methods
 */
export function setupRefreshTimer(
  updateCallback: (force?: boolean) => void,
  getRefreshInterval: () => number,
): {
  start: () => void;
  stop: () => void;
} {
  let timerId: number | undefined;

  const start = () => {
    stop(); // Clear any existing timer
    const refreshMinutes = getRefreshInterval();
    timerId = window.setInterval(
      () => updateCallback(true), // Force refresh
      refreshMinutes * 60000,
    );
    Logger.debug(`Started refresh timer with interval ${refreshMinutes} minutes`);
  };

  const stop = () => {
    if (timerId !== undefined) {
      clearInterval(timerId);
      timerId = undefined;
      Logger.debug('Stopped refresh timer');
    }
  };

  return { start, stop };
}
