/* eslint-disable import/order */
/**
 * Helper utilities for Calendar Card Pro
 *
 * General purpose utility functions for debouncing, memoization,
 * performance monitoring, and other common tasks.
 */

import * as Types from '../config/types';

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

  // Keep only last 10 measurements
  if (mutablePerformanceData.renderTime.length > 10) {
    mutablePerformanceData.renderTime.shift();
  }

  // Log if performance is poor
  const avgRenderTime = getAverageRenderTime(performanceData);
  if (avgRenderTime > renderTimeThreshold) {
    console.warn('Calendar-Card-Pro: Poor rendering performance detected', {
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
 * Create a hash from configuration object for cache keys
 *
 * @param config - Configuration object to hash
 * @returns Short hash string representation
 */
export function hashConfig(config: unknown): string {
  return btoa(JSON.stringify(config)).substring(0, 8);
}

/**
 * Generate a unique ID for instances
 *
 * @returns Random ID string
 */
export function generateInstanceId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Handle errors with consistent logging
 *
 * @param error - Error object or string
 * @param prefix - Optional prefix for the error message
 */
export function handleError(error: unknown, prefix = 'Calendar-Card-Pro:'): void {
  console.error(prefix, error instanceof Error ? error.message : String(error));
}

/**
 * Performance constants for calendar card
 *
 * These constants define thresholds and parameters for performance optimizations
 * throughout the calendar card. Adjusting these values can affect rendering
 * performance and responsiveness.
 */
export const PERFORMANCE_CONSTANTS = {
  /** Threshold in milliseconds for warning about slow rendering */
  RENDER_TIME_THRESHOLD: 100,
  /** Size of chunks for progressive rendering */
  CHUNK_SIZE: 10,
  /** Delay between rendering chunks in milliseconds */
  RENDER_DELAY: 50,
} as const;
