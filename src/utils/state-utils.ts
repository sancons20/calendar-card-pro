/* eslint-disable import/order */
/**
 * State management utilities for Calendar Card Pro
 *
 * Handles component state initialization, cleanup, and management.
 */

import * as Types from '../config/types';
import * as EventUtils from './event-utils';

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
