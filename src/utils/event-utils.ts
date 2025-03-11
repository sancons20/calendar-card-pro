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
import * as Logger from './logger-utils';
import * as Config from '../config/config'; // Add this import

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
  );
  const cacheKey = getCacheKey(baseKey);

  // Try to get from cache if not forced
  const cachedEvents = !force && getCachedEvents(cacheKey, config);
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
    Logger.info(`Fetched ${events.length} events from ${entities.length} calendars`);

    // Cache the events
    cacheEvents(cacheKey, [...events]);

    return { events: [...events], fromCache: false, error: null };
  } catch (error) {
    Logger.error('API error:', error);

    // Attempt fallback if no events already
    if (currentEvents.length === 0) {
      try {
        Logger.info('Trying fallback to fetch today events');
        const firstEntity =
          typeof config.entities[0] === 'string' ? config.entities[0] : config.entities[0].entity;

        const partialEvents = await fetchTodayEvents(hass!, firstEntity);
        return {
          events: partialEvents ? [...partialEvents] : [],
          fromCache: false,
          error,
        };
      } catch (fallbackError) {
        Logger.error('Fallback failed:', fallbackError);
        return { events: [], fromCache: false, error: fallbackError };
      }
    }

    return { events: currentEvents, fromCache: false, error };
  }
}

/**
 * Orchestrates the complete event update process with state management
 * This function manages loading states, cache access, API calls, and error handling
 *
 * @param options Configuration object containing all necessary parameters
 * @returns Promise that resolves when the update is complete
 */
export async function orchestrateEventUpdate(options: {
  hass: Types.Hass | null;
  config: Types.Config;
  instanceId: string;
  force: boolean;
  currentEvents: Types.CalendarEventData[];
  callbacks: {
    setLoading: (loading: boolean) => void;
    setEvents: (events: Types.CalendarEventData[]) => void;
    updateLastUpdate: () => void;
    renderCallback: () => void;
  };
}): Promise<void> {
  const { hass, config, instanceId, force, currentEvents, callbacks } = options;

  // Early return if state is invalid
  if (!isValidState(hass, config.entities)) return;

  const cacheKey = getCacheKey(
    getBaseCacheKey(instanceId, config.entities, config.days_to_show, config.show_past_events),
  );

  // Check cache first unless forced refresh
  const cacheExists = !force && doesCacheExist(cacheKey);

  if (cacheExists) {
    const cachedEvents = getCachedEvents(cacheKey, config);
    if (cachedEvents) {
      Logger.info(`Using ${cachedEvents.length} events from cache`);
      callbacks.setEvents(cachedEvents);
      callbacks.setLoading(false);
      callbacks.renderCallback();
      return;
    }
  }

  // Show loading state and fetch fresh data
  Logger.info(`Fetching events from API${force ? ' (forced refresh)' : ''}`);
  callbacks.setLoading(true);
  callbacks.renderCallback();

  try {
    const result = await updateCalendarEvents(hass, config, instanceId, force, currentEvents);

    if (result.events) {
      callbacks.setEvents(result.events);
      callbacks.updateLastUpdate();
    }

    if (result.error) {
      Logger.error('Error during event update:', result.error);
    }
  } catch (error) {
    Logger.error('Failed to update events:', error);
  } finally {
    callbacks.setLoading(false);
    callbacks.renderCallback();
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
      _entityId: event._entityId,
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
 * @param hass - Home Assistant instance
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
      const path = `calendars/${entityConfig.entity}?start=${timeWindow.start.toISOString()}&end=${timeWindow.end.toISOString()}`;

      Logger.info(`Fetching calendar events with path: ${path}`);

      const events = await hass.callApi('GET', path);

      if (!events || !Array.isArray(events)) {
        Logger.warn(`Invalid response for ${entityConfig.entity}`);
        continue;
      }

      const processedEvents = (events as Types.CalendarEventData[]).map(
        (event: Types.CalendarEventData) => ({
          ...event,
          _entityId: entityConfig.entity,
        }),
      );
      allEvents.push(...processedEvents);
    } catch (error) {
      Logger.error(`Failed to fetch events for ${entityConfig.entity}:`, error);

      try {
        Logger.info(
          'Available hass API methods:',
          Object.keys(hass).filter((k) => typeof hass[k as keyof Types.Hass] === 'function'),
        );
      } catch (e) {
        // Silent
      }
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

// Replace the hardcoded CACHE_DURATION constant with a function that uses the config
export function getCacheDuration(config?: Types.Config): number {
  return (config?.cache_duration || 30) * 60 * 1000;
}

/**
 * Parse and validate cache entry
 * Helper function to ensure consistent cache validation
 *
 * @param key - Cache key
 * @returns Valid cache entry or null if invalid/expired
 */
export function getValidCacheEntry(key: string, config?: Types.Config): Types.CacheEntry | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const cache = JSON.parse(item) as Types.CacheEntry;
    const now = Date.now();
    const cacheDuration = getCacheDuration(config);
    const isValid = now - cache.timestamp < cacheDuration;

    if (!isValid) {
      localStorage.removeItem(key);
      Logger.info(`Cache expired and removed for ${key}`);
      return null;
    }

    return cache;
  } catch (e) {
    Logger.warn('Cache error:', e);
    try {
      localStorage.removeItem(key);
    } catch {}
    return null;
  }
}

/**
 * Get cached event data if available and not expired
 *
 * @param key - Cache key
 * @returns Cached events or null if expired/unavailable
 */
export function getCachedEvents(
  key: string,
  config?: Types.Config,
): Types.CalendarEventData[] | null {
  const cacheEntry = getValidCacheEntry(key, config);
  if (cacheEntry) {
    return [...cacheEntry.events];
  }
  return null;
}

/**
 * Check if valid cache exists for a key
 *
 * @param key - Cache key
 * @returns Boolean indicating if valid cache exists
 */
export function doesCacheExist(key: string): boolean {
  return getValidCacheEntry(key) !== null;
}

/**
 * Cache event data in localStorage
 *
 * @param key - Cache key
 * @param events - Calendar event data to cache
 * @returns Boolean indicating if caching was successful
 */
export function cacheEvents(key: string, events: Types.CalendarEventData[]): boolean {
  try {
    Logger.info(`Caching ${events.length} events`);
    const cacheEntry: Types.CacheEntry = {
      events,
      timestamp: Date.now(),
    };

    localStorage.setItem(key, JSON.stringify(cacheEntry));

    return getValidCacheEntry(key) !== null;
  } catch (e) {
    Logger.error('Failed to cache calendar events:', e);
    return false;
  }
}

/**
 * Invalidate cached events by removing them from storage
 *
 * @param keys - Array of cache keys to invalidate
 */
export function invalidateCache(keys: string[]): void {
  try {
    const invalidated = keys.filter((key) => {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        return true;
      }
      return false;
    });

    if (invalidated.length > 0) {
      Logger.info(`Invalidated ${invalidated.length} cache entries`);
    }
  } catch (e) {
    Logger.warn('Failed to invalidate cache:', e);
  }
}

/**
 * Generate a base cache key from configuration
 * This function creates a stable cache key that depends only on data-affecting parameters
 *
 * @param _instanceId - Component instance ID (unused, maintained for backward compatibility)
 * @param entities - Calendar entities
 * @param daysToShow - Number of days to display
 * @param showPastEvents - Whether to show past events
 * @returns Base cache key
 */
export function getBaseCacheKey(
  _instanceId: string,
  entities: Array<string | { entity: string; color?: string }>,
  daysToShow: number,
  showPastEvents: boolean,
): string {
  const entityIds = entities
    .map((e) => (typeof e === 'string' ? e : e.entity))
    .sort()
    .join('_');

  return `calendar_data_${entityIds}_${daysToShow}_${showPastEvents ? 1 : 0}`;
}

/**
 * Get current cache key based on base key and current date
 *
 * @param baseKey - Base cache key
 * @returns Complete cache key including date
 */
export function getCacheKey(baseKey: string): string {
  return baseKey;
}

/**
 * Get all cache keys for the current configuration
 *
 * @param baseKey - Base cache key
 * @returns Array of cache keys
 */
export function getAllCacheKeys(baseKey: string): string[] {
  return [baseKey];
}

/**
 * Clean up old cache entries
 *
 * @param _prefix - Cache key prefix (unused but kept for API compatibility)
 */
export function cleanupCache(_prefix: string): void {
  try {
    const keysToRemove: string[] = [];
    const now = Date.now();

    Object.keys(localStorage)
      .filter((key) => key.startsWith('calendar_data_'))
      .forEach((key) => {
        try {
          const cacheEntry = JSON.parse(localStorage.getItem(key) || '') as Types.CacheEntry;
          if (now - cacheEntry.timestamp > 86400000) {
            keysToRemove.push(key);
          }
        } catch {
          keysToRemove.push(key);
        }
      });

    if (keysToRemove.length > 0) {
      Logger.info(`Cleaned up ${keysToRemove.length} old cache entries`);
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }
  } catch (e) {
    Logger.warn('Cache cleanup failed:', e);
  }
}

/**
 * Get entity color from configuration based on entity ID
 *
 * @param entityId - The entity ID to find color for
 * @param config - Current card configuration
 * @returns Color string from entity config or default
 */
export function getEntityColor(entityId: string | undefined, config: Types.Config): string {
  if (!entityId) return 'var(--primary-text-color)';

  const entityConfig = config.entities.find(
    (e) =>
      (typeof e === 'string' && e === entityId) || (typeof e === 'object' && e.entity === entityId),
  );

  if (!entityConfig) return 'var(--primary-text-color)';

  return typeof entityConfig === 'string'
    ? 'var(--primary-text-color)'
    : entityConfig.color || 'var(--primary-text-color)';
}

/**
 * Process calendar events from API response
 *
 * @param events - Raw events from Home Assistant API
 * @param entityConfig - Entity configuration with color information
 * @returns Processed calendar events
 */
export function processEvents(
  events: Types.CalendarEventData[],
  entityConfig: Types.EntityConfig,
): Types.CalendarEventData[] {
  return events.map((event) => {
    event._entityId = entityConfig.entity;

    return event;
  });
}

/**
 * Sort calendar events by start time
 *
 * @param events - Calendar events to sort
 * @returns Sorted events array
 */
export function sortEvents(events: Types.CalendarEventData[]): Types.CalendarEventData[] {
  return [...events].sort((a, b) => {
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
}
