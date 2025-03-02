/* eslint-disable import/order */
/**
 * Event utilities for Calendar Card Pro
 *
 * Functions for fetching, processing, caching, and organizing calendar events
 */

import * as Types from '../config/types';
import * as Localize from '../translations/localize';
import * as FormatUtils from './format-utils';

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
 * Cache events in localStorage for future use
 *
 * @param cacheKey - Key to use for localStorage
 * @param events - Calendar events to cache
 * @returns Boolean indicating if caching was successful
 */
export function cacheEvents(
  cacheKey: string,
  events: ReadonlyArray<Types.CalendarEventData>,
): boolean {
  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        events,
        timestamp: Date.now(),
      }),
    );
    return true;
  } catch (error) {
    console.error('Calendar-Card-Pro: Failed to cache events:', error);
    return false;
  }
}

/**
 * Retrieve cached events from localStorage
 *
 * @param cacheKey - Key to use for localStorage
 * @param cacheDuration - How long (in milliseconds) to keep the cache valid
 * @returns Cached events or null if cache is invalid/expired
 */
export function getCachedEvents(
  cacheKey: string,
  cacheDuration: number,
): ReadonlyArray<Types.CalendarEventData> | null {
  try {
    const cacheStr = localStorage.getItem(cacheKey);
    if (!cacheStr) return null;

    const cache = JSON.parse(cacheStr) as Types.CacheEntry;

    if (cache && Date.now() - cache.timestamp < cacheDuration) {
      sessionStorage.setItem(cacheKey, 'used');
      return cache.events;
    }
  } catch (error) {
    console.warn('Calendar-Card-Pro: Failed to retrieve cached events:', error);
  }
  return null;
}

/**
 * Remove cached events for specific keys
 *
 * @param keys - Array of cache keys to remove
 */
export function invalidateCache(keys: string[]): void {
  keys.forEach((key) => localStorage.removeItem(key));
}

/**
 * Clean up old cache entries
 *
 * @param cachePrefix - Prefix to identify related cache entries
 * @param maxAge - Maximum age in milliseconds before removing cache
 */
export function cleanupCache(cachePrefix: string, maxAge = 86400000): void {
  const now = Date.now();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(cachePrefix)) {
      try {
        const cache = JSON.parse(localStorage.getItem(key)!);
        if (now - cache.timestamp > maxAge) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  }
}
