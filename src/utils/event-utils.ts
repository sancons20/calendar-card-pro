/* eslint-disable import/order */
/**
 * Event utilities for Calendar Card Pro
 *
 * Functions for fetching, processing, caching, and organizing calendar events
 */

import * as Types from '../config/types';
import * as Localize from '../translations/localize';
import * as FormatUtils from './format-utils';
import * as Helpers from './helpers';

// HIGH-LEVEL API FUNCTIONS FIRST

/**
 * Updates calendar events with caching and error handling
 *
 * @param hass - Home Assistant interface
 * @param config - Card configuration
 * @param instanceId - Component instance ID for cache keying
 * @param force - Force refresh ignoring cache
 * @param currentEvents - Current events array for fallback
 * @returns Object with events and status information
 */
export async function updateCalendarEvents(
  hass: Types.Hass | null,
  config: Types.Config,
  instanceId: string,
  force = false,
  currentEvents: Types.CalendarEventData[] = [],
): Promise<{
  events: Types.CalendarEventData[];
  fromCache: boolean;
  error: unknown | null;
}> {
  // Check if state is valid
  if (!isValidState(hass, config.entities)) {
    return { events: currentEvents, fromCache: false, error: null };
  }

  // Generate cache key
  const baseKey = getBaseCacheKey(
    instanceId,
    config.entities,
    config.days_to_show,
    config.show_past_events,
    config,
  );

  const cacheKey = getCacheKey(baseKey);

  // Try to get from cache if not forced
  const cachedEvents = !force && getCachedEvents(cacheKey);
  if (cachedEvents) {
    return { events: cachedEvents, fromCache: true, error: null };
  }

  try {
    // Convert string entities to EntityConfig objects
    const entities = config.entities.map((entity) => {
      return typeof entity === 'string' ? { entity, color: 'var(--primary-text-color)' } : entity;
    });

    // Fetch events
    const timeWindow = getTimeWindow(config.days_to_show);
    const events = await fetchEvents(hass!, entities, timeWindow);

    // Cache the events
    cacheEvents(cacheKey, [...events]);

    return { events: [...events], fromCache: false, error: null };
  } catch (error) {
    // Attempt fallback if no events already
    if (currentEvents.length === 0) {
      try {
        const firstEntity =
          typeof config.entities[0] === 'string' ? config.entities[0] : config.entities[0].entity;

        const partialEvents = await fetchTodayEvents(hass!, firstEntity);
        return {
          events: partialEvents ? [...partialEvents] : [],
          fromCache: false,
          error,
        };
      } catch (fallbackError) {
        return { events: [], fromCache: false, error: fallbackError };
      }
    }

    return { events: currentEvents, fromCache: false, error };
  }
}

/**
 * Check if the card state is valid for processing events
 *
 * @param hass - Home Assistant interface
 * @param entities - Calendar entities (strings or objects)
 * @returns Boolean indicating if the state is valid
 */
export function isValidState(
  hass: Types.Hass | null,
  entities: Array<string | Types.EntityConfig>,
): boolean {
  if (!hass || !entities.length) {
    return false;
  }
  return true;
}

/**
 * Group events by day for display
 *
 * @param events - Calendar events to group
 * @param config - Card configuration
 * @param isExpanded - Whether the card is in expanded mode
 * @param language - Language code for translations
 * @returns Array of day objects containing grouped events
 */
export function groupEventsByDay(
  events: Types.CalendarEventData[],
  config: Types.Config,
  isExpanded: boolean,
  language: string,
): Types.EventsByDay[] {
  const eventsByDay: Record<string, Types.EventsByDay> = {};
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  const upcomingEvents = events.filter((event) => {
    if (!event?.start || !event?.end) return false;

    const startDate = event.start.dateTime
      ? new Date(event.start.dateTime)
      : event.start.date
        ? new Date(event.start.date)
        : null;
    const endDate = event.end.dateTime
      ? new Date(event.end.dateTime)
      : event.end.date
        ? new Date(event.end.date)
        : null;
    if (!startDate || !endDate) return false;

    const isAllDayEvent = !event.start.dateTime;
    const isEventToday = startDate >= todayStart && startDate <= todayEnd;
    const isFutureEvent = startDate > todayEnd;

    // Keep only current and future events
    if (!isEventToday && !isFutureEvent) {
      return false;
    }

    // Filter out ended events if not showing past events
    if (!config.show_past_events) {
      if (!isAllDayEvent && endDate < now) {
        return false;
      }
    }

    return true;
  });

  // Return early if no upcoming events
  if (upcomingEvents.length === 0) {
    return [];
  }

  // Process events into days
  upcomingEvents.forEach((event) => {
    const startDate = event.start.dateTime
      ? new Date(event.start.dateTime)
      : event.start.date
        ? new Date(event.start.date)
        : null;
    if (!startDate) return;

    const eventDateKey = startDate.toISOString().split('T')[0];
    const translations = Localize.getTranslations(language);

    if (!eventsByDay[eventDateKey]) {
      eventsByDay[eventDateKey] = {
        weekday: translations.daysOfWeek[startDate.getDay()],
        day: startDate.getDate(),
        month: translations.months[startDate.getMonth()],
        timestamp: startDate.getTime(),
        events: [],
      };
    }

    eventsByDay[eventDateKey].events.push({
      summary: event.summary || '',
      time: FormatUtils.formatEventTime(event, config, language),
      location: config.show_location
        ? FormatUtils.formatLocation(event.location || '', config.remove_location_country)
        : '',
      start: event.start,
      end: event.end,
      _entityConfig: event._entityConfig,
    });
  });

  // Sort events within each day
  Object.values(eventsByDay).forEach((day) => {
    day.events.sort((a, b) => {
      const aStart = a.start.dateTime
        ? new Date(a.start.dateTime).getTime()
        : a.start.date
          ? new Date(a.start.date).getTime()
          : 0;
      const bStart = b.start.dateTime
        ? new Date(b.start.dateTime).getTime()
        : b.start.date
          ? new Date(b.start.date).getTime()
          : 0;
      return aStart - bStart;
    });
  });

  // Sort days and limit to configured number of days
  let days = Object.values(eventsByDay)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, config.days_to_show || 3);

  // Apply max_events_to_show limit if configured and not expanded
  if (config.max_events_to_show && !isExpanded) {
    let totalEvents = 0;
    days = days.filter((day) => {
      if (totalEvents >= (config.max_events_to_show ?? 0)) {
        return false;
      }
      totalEvents += day.events.length;
      return true;
    });
  }

  return days;
}

// FETCH FUNCTIONS

/**
 * Fetch calendar events from Home Assistant API
 *
 * @param hass - Home Assistant interface
 * @param entities - Calendar entities to fetch events for
 * @param timeWindow - Time window to fetch events in
 * @returns Array of calendar events
 */
export async function fetchEvents(
  hass: Types.Hass,
  entities: Array<Types.EntityConfig>,
  timeWindow: { start: Date; end: Date },
): Promise<ReadonlyArray<Types.CalendarEventData>> {
  const allEvents: Types.CalendarEventData[] = [];

  for (const entityConfig of entities) {
    try {
      const events = await hass.callApi(
        'GET',
        `calendars/${entityConfig.entity}?start=${timeWindow.start.toISOString()}&end=${timeWindow.end.toISOString()}`,
      );
      const processedEvents = (events as Types.CalendarEventData[]).map(
        (event: Types.CalendarEventData) => ({
          ...event,
          _entityConfig: {
            entity: entityConfig.entity,
            color: entityConfig.color || 'var(--primary-text-color)',
          },
        }),
      );
      allEvents.push(...processedEvents);
    } catch (error) {
      console.warn(`Calendar-Card-Pro: Failed to fetch events for ${entityConfig.entity}`, error);
    }
  }

  return allEvents;
}

/**
 * Fetch events for just today
 * Used as a fallback when full event fetching fails
 *
 * @param hass - Home Assistant interface
 * @param entity - Calendar entity to fetch events for
 * @returns Array of calendar events for today or null if fetching fails
 */
export async function fetchTodayEvents(
  hass: Types.Hass,
  entity: string,
): Promise<Types.CalendarEventData[] | null> {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const events = await hass.callApi(
      'GET',
      `calendars/${entity}?start=${start.toISOString()}&end=${end.toISOString()}`,
    );
    return events as Types.CalendarEventData[];
  } catch {
    return null;
  }
}

/**
 * Calculate time window for event fetching
 *
 * @param daysToShow - Number of days to show in the calendar
 * @returns Object containing start and end dates for the calendar window
 */
export function getTimeWindow(daysToShow: number): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
  const end = new Date(start);
  const days = parseInt(daysToShow.toString()) || 3;
  end.setDate(start.getDate() + days);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Update date objects used for time comparisons
 *
 * @param dateObjs - Object containing date references to update
 */
export function updateDateObjects(dateObjs: { now: Date; todayStart: Date; todayEnd: Date }): void {
  dateObjs.now = new Date();
  dateObjs.todayStart.setTime(dateObjs.now.getTime());
  dateObjs.todayStart.setHours(0, 0, 0, 0);
  dateObjs.todayEnd.setTime(dateObjs.todayStart.getTime());
  dateObjs.todayEnd.setHours(23, 59, 59, 999);
}

// CACHE MANAGEMENT FUNCTIONS

// Fixed cache duration (30 minutes)
export const CACHE_DURATION = 30 * 60 * 1000;

/**
 * Get cached event data if available and not expired
 *
 * @param key - Cache key
 * @param maxAge - Maximum age of cache in milliseconds
 * @returns Cached events or null if expired/unavailable
 */
export function getCachedEvents(key: string): Types.CalendarEventData[] | null {
  try {
    const cache = localStorage.getItem(key);
    if (!cache) return null;

    const cacheEntry = JSON.parse(cache) as Types.CacheEntry;
    const now = Date.now();

    if (now - cacheEntry.timestamp < CACHE_DURATION) {
      // Create a mutable copy of the events array to avoid readonly issues
      return [...cacheEntry.events];
    }
  } catch (e) {
    console.warn('Failed to retrieve cached events:', e);
  }
  return null;
}

/**
 * Cache event data in localStorage
 *
 * @param key - Cache key
 * @param events - Calendar event data to cache
 */
export function cacheEvents(key: string, events: Types.CalendarEventData[]): void {
  try {
    const cacheEntry: Types.CacheEntry = {
      events,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cacheEntry));
  } catch (e) {
    console.warn('Failed to cache calendar events:', e);
  }
}

/**
 * Generate a base cache key from configuration
 *
 * @param instanceId - Unique instance ID
 * @param entities - Calendar entities
 * @param daysToShow - Number of days to display
 * @param showPastEvents - Whether to show past events
 * @param config - Full configuration for hashing
 * @returns Base cache key
 */
export function getBaseCacheKey(
  instanceId: string,
  entities: Array<string | { entity: string; color?: string }>,
  daysToShow: number,
  showPastEvents: boolean,
  config: unknown,
): string {
  const configHash = Helpers.hashConfig(config);
  const entityIds = entities.map((e) => (typeof e === 'string' ? e : e.entity));
  return `calendar_${instanceId}_${entityIds.join('_')}_${daysToShow}_${showPastEvents}_${configHash}`;
}

/**
 * Get current cache key based on base key and current date
 *
 * @param baseKey - Base cache key
 * @returns Complete cache key including date
 */
export function getCacheKey(baseKey: string): string {
  return `${baseKey}_${new Date().toDateString()}`;
}

/**
 * Get all cache keys for the current configuration
 *
 * @param baseKey - Base cache key
 * @returns Array of cache keys
 */
export function getAllCacheKeys(baseKey: string): string[] {
  const keys: string[] = [];

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  [now, yesterday].forEach((date) => {
    keys.push(`${baseKey}_${date.toDateString()}`);
  });

  return keys;
}

/**
 * Invalidate cached events by removing them from storage
 *
 * @param keys - Array of cache keys to invalidate
 */
export function invalidateCache(keys: string[]): void {
  try {
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.warn('Failed to invalidate cache:', e);
  }
}

/**
 * Clean up old cache entries
 *
 * @param prefix - Cache key prefix to search for
 */
export function cleanupCache(prefix: string): void {
  try {
    // Find and remove all cache entries that start with the prefix
    Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => {
        try {
          const cacheEntry = JSON.parse(localStorage.getItem(key) || '') as Types.CacheEntry;
          const now = Date.now();

          // Remove if older than 24 hours
          if (now - cacheEntry.timestamp > 86400000) {
            localStorage.removeItem(key);
          }
        } catch {
          // If we can't parse it, just remove it
          localStorage.removeItem(key);
        }
      });
  } catch (e) {
    console.warn('Cache cleanup failed:', e);
  }
}
