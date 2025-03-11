/* eslint-disable import/order */
/**
 * Helper utilities for Calendar Card Pro
 *
 * General purpose utility functions for debouncing, memoization,
 * performance monitoring, and other common tasks.
 */

import * as Constants from '../config/constants';
import * as Types from '../config/types';
import * as Logger from './logger-utils';

/**
 * Debounce helper to limit function call frequency
 *
 * Creates a function that delays invoking the provided function until after
 * the specified wait time has elapsed since the last time it was invoked.
 * Useful for limiting API calls and expensive operations.
 *
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: number;
  return (...args: Parameters<T>): void => {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = window.setTimeout(later, wait);
  };
}

/**
 * Memoize helper for caching function results
 *
 * Creates a function that memoizes the result of func. If the function is called
 * with the same arguments, the cached result is returned instead of re-executing
 * the function. This is particularly useful for expensive calculations.
 *
 * @param func - Function to memoize
 * @param context - Function context (this reference)
 * @returns Memoized function with cache
 */
export function memoize<T extends readonly unknown[], R>(
  func: (...args: T) => R,
  context?: unknown,
): ((...args: T) => R) & Types.MemoCache<R> {
  const cache = new Map<string, R>();
  const memoizedFunc = (...args: T): R => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key)!;

    const result = context ? func.call(context, ...args) : func(...args);

    cache.set(key, result);
    return result;
  };
  return Object.assign(memoizedFunc, { cache, clear: () => cache.clear() });
}

/**
 * Begin performance measurement
 *
 * @param eventCount - Number of events being processed
 * @returns Metrics object for tracking performance
 */
export function beginPerfMetrics(eventCount: number): Types.PerfMetrics {
  return {
    startTime: performance.now(),
    eventCount: eventCount,
  };
}

/**
 * End performance measurement and process results
 *
 * @param metrics - Metrics object from beginPerfMetrics
 * @param performanceData - Performance data store for tracking over time
 * @param renderTimeThreshold - Threshold for warning about poor performance
 * @returns Duration in milliseconds
 */
export function endPerfMetrics(
  metrics: Types.PerfMetrics,
  performanceData: Types.PerformanceData,
  renderTimeThreshold: number,
): number {
  const duration = performance.now() - metrics.startTime;

  // Treat performance data as mutable internally for value tracking
  const mutablePerformanceData = performanceData as { renderTime: number[] };
  mutablePerformanceData.renderTime.push(duration);

  // Replace hardcoded max measurements
  if (mutablePerformanceData.renderTime.length > Constants.PERFORMANCE.MAX_MEASUREMENTS) {
    mutablePerformanceData.renderTime.shift();
  }

  // Log if performance is poor
  const avgRenderTime = getAverageRenderTime(performanceData);
  if (avgRenderTime > renderTimeThreshold) {
    Logger.warn('Poor rendering performance detected', {
      averageRenderTime: avgRenderTime,
      eventCount: metrics.eventCount,
    });
  }

  return duration;
}

/**
 * Calculate average render time from performance metrics
 *
 * @param performanceData - Performance data with render time history
 * @returns Average render time in milliseconds
 */
export function getAverageRenderTime(performanceData: Types.PerformanceData): number {
  if (!performanceData.renderTime.length) return 0;
  const sum = performanceData.renderTime.reduce((a, b) => a + b, 0);
  return sum / performanceData.renderTime.length;
}

/**
 * Generate a random instance ID
 *
 * @returns {string} Random alphanumeric identifier
 */
export function generateInstanceId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Generate a deterministic ID based on calendar config
 * Creates a stable ID that persists across page reloads
 * but changes when the data requirements change
 *
 * @param entities Array of calendar entities
 * @param daysToShow Number of days to display
 * @param showPastEvents Whether to show past events
 * @returns Deterministic ID string based on input parameters
 */
export function generateDeterministicId(
  entities: Array<string | { entity: string; color?: string }>,
  daysToShow: number,
  showPastEvents: boolean,
): string {
  // Extract just the entity IDs, normalized for comparison
  const entityIds = entities
    .map((e) => (typeof e === 'string' ? e : e.entity))
    .sort()
    .join('_');

  // Create a base string with all data-affecting parameters
  const baseString = `calendar_${entityIds}_${daysToShow}_${showPastEvents ? 1 : 0}`;

  // Hash it for a compact, consistent ID
  return hashString(baseString);
}

/**
 * Simple string hash function for creating deterministic IDs
 *
 * @param str Input string to hash
 * @returns Alphanumeric hash string
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to alphanumeric string
  return Math.abs(hash).toString(36);
}

/**
 * Creates a performance tracker for monitoring render performance
 *
 * @returns Object with performance tracking methods
 */
export function createPerformanceTracker(): {
  beginMeasurement: (eventCount: number) => Types.PerfMetrics;
  endMeasurement: (
    metrics: Types.PerfMetrics,
    performanceData: Types.PerformanceData,
    renderTimeThreshold?: number,
  ) => number;
  getAverageRenderTime: (performanceData: Types.PerformanceData) => number;
} {
  return {
    beginMeasurement: beginPerfMetrics,

    // Use a wrapper function to handle the missing parameter with a default value
    endMeasurement: (
      metrics: Types.PerfMetrics,
      performanceData: Types.PerformanceData,
      renderTimeThreshold?: number,
    ) => {
      return endPerfMetrics(
        metrics,
        performanceData,
        renderTimeThreshold || Constants.PERFORMANCE.RENDER_TIME_THRESHOLD,
      );
    },

    getAverageRenderTime,
  };
}
