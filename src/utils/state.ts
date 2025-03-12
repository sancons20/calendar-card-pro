/* eslint-disable import/order */
/**
 * State Management utilities for Calendar Card Pro
 *
 * This module handles component lifecycle management including visibility tracking,
 * timers, state initialization, cleanup, and restoration.
 */

import * as Types from '../config/types';
import * as Logger from './logger';
import * as Config from '../config/config';
import * as EventUtils from './events';
import * as Constants from '../config/constants';
import * as Helpers from './helpers';
import * as Interaction from './interaction';

/**
 * Initialize component state with default values
 *
 * @returns Default state object for component initialization
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
 * Set up the complete component state and lifecycle handlers
 *
 * @param component - The component instance to set up
 * @returns Object containing cleanup functions and initialized controllers
 */
export function setupComponentLifecycle(component: any): {
  performanceTracker: any;
  visibilityCleanup: () => void;
  refreshTimer: { start: () => void; stop: () => void };
  cleanupInterval: number;
  debouncedUpdate: () => void;
  memoizedFormatTime: (date: Date) => string & Types.MemoCache<string>;
  memoizedFormatLocation: (location: string) => string & Types.MemoCache<string>;
  interactionManager: {
    state: Interaction.InteractionState;
    container: HTMLElement | null;
    cleanup: (() => void) | null;
  };
} {
  // Initialize logger
  Logger.initializeLogger(Constants.VERSION.CURRENT);

  // Create performance tracker
  const performanceTracker = Helpers.createPerformanceTracker();

  // Set up visibility handling
  const visibilityCleanup = setupVisibilityHandling(
    () => component.updateEvents(),
    () => component.performanceMetrics.lastUpdate,
  );

  // Create refresh timer controller
  const refreshTimer = setupRefreshTimer(
    (force = false) => component.updateEvents(force),
    () => component.config?.refresh_interval || Constants.CACHE.DEFAULT_DATA_REFRESH_MINUTES,
  );

  // Create debounced update function
  const debouncedUpdate = Helpers.debounce(
    () => component.updateEvents(),
    Constants.TIMING.DEBOUNCE_TIME,
  );

  // Create memoized format functions
  const memoizedFormatTime = Helpers.memoize((date: Date) => {
    // This will be called with the component's config later
    const use24h = component.config?.time_24h ?? true;
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: !use24h,
    });
  }, component) as unknown as (date: Date) => string & Types.MemoCache<string>;

  const memoizedFormatLocation = Helpers.memoize((location: string) => {
    // This will be called with the component's config later
    const removeCountry = component.config?.remove_location_country ?? true;
    if (removeCountry) {
      return location.replace(/,\s*[A-Z]{2}$/, '');
    }
    return location;
  }, component) as unknown as (location: string) => string & Types.MemoCache<string>;

  // Set up cache cleanup interval
  const cleanupInterval = window.setInterval(
    () => EventUtils.cleanupCache(Constants.CACHE.EVENT_CACHE_KEY_PREFIX, component.config),
    Constants.CACHE.CACHE_CLEANUP_INTERVAL_MS,
  );

  // Start refresh timer
  refreshTimer.start();

  // Create interaction manager
  const interactionManager = {
    state: Interaction.createDefaultState(),
    container: null,
    cleanup: null,
  };

  return {
    performanceTracker,
    visibilityCleanup,
    refreshTimer,
    cleanupInterval,
    debouncedUpdate,
    memoizedFormatTime,
    memoizedFormatLocation,
    interactionManager,
  };
}

/**
 * Handle component connection and state restoration
 * Restores interactions and refreshes ripple elements when needed
 *
 * @param component - The component instance that was connected
 */
export function handleConnectedCallback(component: any): void {
  Logger.debug('Connected callback called - checking if rendering needed');

  // Check if we have content in the shadow DOM
  const hasContent =
    component.shadowRoot?.childElementCount && component.shadowRoot.childElementCount > 0;

  if (!hasContent && component._hass) {
    // No content, but we have hass - likely returning from navigation
    Logger.debug('No content found after navigation - triggering render');
    component.renderCard();
    return;
  }

  // Restore interactions if we have a container but no cleanup function
  if (
    component.interactionManager.container &&
    !component.interactionManager.cleanup &&
    component._hass
  ) {
    // Find our ripple element
    const oldRipple = component.interactionManager.container.querySelector('calendar-ripple');

    // Remove the old ripple element completely to prevent opacity accumulation
    if (oldRipple) {
      try {
        // Make sure it's properly detached before removal
        if ('detach' in oldRipple) {
          (oldRipple as any).detach();
        }
        oldRipple.remove();
      } catch (e) {
        Logger.warn('Error removing old ripple element:', e);
      }
    }

    // Create a fresh ripple element
    const newRipple = document.createElement('calendar-ripple');

    // Ensure it's the first child in the container (for proper z-index layering)
    if (component.interactionManager.container.firstChild) {
      component.interactionManager.container.insertBefore(
        newRipple,
        component.interactionManager.container.firstChild,
      );
    } else {
      component.interactionManager.container.appendChild(newRipple);
    }

    const entityId = Interaction.getPrimaryEntityId(component.config.entities);

    // Set up interactions using our module with the fresh ripple
    component.interactionManager.cleanup = Interaction.setupInteractions(
      component.config,
      component.interactionManager.container,
      component._hass,
      entityId,
      () => component.toggleExpanded(),
      newRipple,
    );

    Logger.debug('Restored interaction handlers with fresh ripple in connectedCallback');
  }
}

/**
 * Clean up component resources and state
 *
 * @param component - The component instance to clean up
 */
export function cleanupComponent(component: any): void {
  // Clean up visibility handler
  if (component.visibilityCleanup) {
    component.visibilityCleanup();
  }

  // Stop refresh timer
  if (component.refreshTimer) {
    component.refreshTimer.stop();
  }

  // Clear cleanup interval
  if (component.cleanupInterval) {
    clearInterval(component.cleanupInterval);
  }

  // Clean up interaction manager
  if (component.interactionManager.cleanup) {
    component.interactionManager.cleanup();
    component.interactionManager.cleanup = null;
  }

  // Reset interaction state but maintain reference
  if (component.interactionManager.state.holdTimer) {
    clearTimeout(component.interactionManager.state.holdTimer);
    component.interactionManager.state.holdTimer = null;
  }

  // Make sure any remaining hold indicator is removed
  if (component.interactionManager.state.holdIndicator) {
    Logger.debug('Cleaning up orphaned hold indicator in disconnectedCallback');
    Interaction.removeHoldIndicator(component.interactionManager.state.holdIndicator);
    component.interactionManager.state.holdIndicator = null;
  }

  component.interactionManager.state.holdTriggered = false;
  component.interactionManager.state.pendingHoldAction = false;
  component.interactionManager.state.activePointerId = null;

  // Ensure all global hold indicators are cleaned up
  Interaction.cleanupAllHoldIndicators();

  // Use enhanced unified cleanup for render timeout and memoization caches
  cleanup(
    component.renderTimeout,
    component.memoizedFormatTime,
    component.memoizedFormatLocation,
    component.interactionManager?.state,
  );
}

/**
 * Utility function to set up visibility change handling
 *
 * @param updateCallback - Function to call when visibility changes
 * @param getLastUpdateTime - Function to get the last update time
 * @returns Cleanup function to remove event listeners
 */
export function setupVisibilityHandling(
  updateCallback: () => void,
  getLastUpdateTime: () => number,
): () => void {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      const lastUpdate = getLastUpdateTime();
      const now = Date.now();

      // Only update if it's been a while since the last update
      if (now - lastUpdate > Constants.TIMING.VISIBILITY_REFRESH_THRESHOLD) {
        Logger.debug('Refreshing data after returning from hidden state');
        updateCallback();
      }
    }
  };

  // Add visibility change listener
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

/**
 * Utility function to set up a refresh timer
 *
 * @param updateCallback - Function to call when the timer triggers
 * @param getInterval - Function to get the current interval in minutes
 * @returns Controller object with start and stop methods
 */
export function setupRefreshTimer(
  updateCallback: (force?: boolean) => void,
  getInterval: () => number,
): { start: () => void; stop: () => void } {
  let timerId: number | undefined;

  const scheduleNextUpdate = () => {
    // Clear any existing timer
    if (timerId) {
      clearTimeout(timerId);
    }

    // Get current interval in minutes and convert to milliseconds
    const interval = getInterval() * 60 * 1000;

    // Schedule next update
    timerId = window.setTimeout(() => {
      updateCallback(false); // Not forced
      scheduleNextUpdate(); // Re-schedule for next time
    }, interval);

    Logger.debug(`Scheduled next refresh in ${getInterval()} minutes`);
  };

  return {
    start: () => {
      scheduleNextUpdate();
    },
    stop: () => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = undefined;
      }
    },
  };
}

/**
 * Clean up memoization caches and other resources
 * Enhanced to handle interaction state and hold indicators
 *
 * @param renderTimeout - Render timeout to clear
 * @param memoizedFormatTime - Memoized time formatter to clear
 * @param memoizedFormatLocation - Memoized location formatter to clear
 * @param interactionState - Optional interaction state for hold indicator cleanup
 */
export function cleanup(
  renderTimeout?: number,
  memoizedFormatTime?: Types.MemoCache<string>,
  memoizedFormatLocation?: Types.MemoCache<string>,
  interactionState?: Interaction.InteractionState,
): void {
  // Clear render timeout if any
  if (renderTimeout) {
    clearTimeout(renderTimeout);
  }

  // Clear memoization caches
  if (memoizedFormatTime?.cache) {
    memoizedFormatTime.cache.clear();
  }

  if (memoizedFormatLocation?.cache) {
    memoizedFormatLocation.cache.clear();
  }

  // Handle interaction state cleanup if provided
  if (interactionState) {
    // Clean up hold timer
    if (interactionState.holdTimer) {
      clearTimeout(interactionState.holdTimer);
      interactionState.holdTimer = null;
    }

    // Clean up hold indicator
    if (interactionState.holdIndicator) {
      Logger.debug('Cleaning up hold indicator in unified cleanup method');
      Interaction.removeHoldIndicator(interactionState.holdIndicator);
      interactionState.holdIndicator = null;
    }

    // Reset state flags
    interactionState.holdTriggered = false;
    interactionState.pendingHoldAction = false;
    interactionState.activePointerId = null;
  }
}
