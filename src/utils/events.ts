/* eslint-disable import/order */
/**
 * Event utilities for Calendar Card Pro
 *
 * Functions for fetching, processing, caching, and organizing calendar events
 */

import * as Types from '../config/types';
import * as Localize from '../translations/localize';
import * as FormatUtils from './format';
import * as Logger from './logger';
import * as Constants from '../config/constants';
import * as Helpers from './helpers';

//-----------------------------------------------------------------------------
// HIGH-LEVEL API FUNCTIONS
//-----------------------------------------------------------------------------

/**
 * Fetch calendar event data with caching support
 * This function handles both API fetching and cache retrieval
 *
 * @param hass Home Assistant instance
 * @param config Calendar card configuration
 * @param instanceId Component instance ID for caching
 * @param force Whether to force API refresh
 * @returns Promise resolving to calendar event data array
 */
export async function fetchEventData(
  hass: Types.Hass,
  config: Types.Config,
  instanceId: string,
  force = false,
): Promise<Types.CalendarEventData[]> {
  // Generate cache key based on configuration
  const cacheKey = getBaseCacheKey(
    instanceId,
    config.entities,
    config.days_to_show,
    config.show_past_events,
    config.start_date,
    config.filter_duplicates, // Include filter_duplicates in cache key
  );

  // Try cache first
  const isManualPageReload = isManualPageLoad();
  if (!force) {
    const cachedEvents = getCachedEvents(cacheKey, config, isManualPageReload);
    if (cachedEvents) {
      Logger.info(`Using ${cachedEvents.length} events from cache`);
      return [...cachedEvents];
    }
  }

  // Fetch from API if needed
  Logger.info('Fetching events from API');
  const entities = config.entities.map((e) =>
    typeof e === 'string' ? { entity: e, color: 'var(--primary-text-color)' } : e,
  );

  const timeWindow = getTimeWindow(config.days_to_show, config.start_date);
  const fetchedEvents = await fetchEvents(hass, entities, timeWindow);

  // Create a mutable copy of the events
  const eventData = Array.from(fetchedEvents);

  // Apply list filtering first (blocklist/allowlist)
  const listFilteredEvents = filterEventsByLists(eventData, config);

  // Then apply duplicate filtering if enabled
  const filteredEvents = config.filter_duplicates
    ? filterDuplicateEvents(listFilteredEvents, config)
    : listFilteredEvents;

  // Cache and return the filtered results
  cacheEvents(cacheKey, filteredEvents);

  return filteredEvents;
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

    const isAllDayEvent = !event.start.dateTime;

    let startDate: Date | null;
    let endDate: Date | null;

    if (isAllDayEvent) {
      // Use special parsing for all-day events that preserves correct day
      startDate = event.start.date ? FormatUtils.parseAllDayDate(event.start.date) : null;
      endDate = event.end.date ? FormatUtils.parseAllDayDate(event.end.date) : null;

      // Adjust end date for all-day events (which is exclusive in iCal format)
      if (endDate) {
        const adjustedEndDate = new Date(endDate);
        adjustedEndDate.setDate(adjustedEndDate.getDate() - 1);
        endDate = adjustedEndDate;
      }
    } else {
      startDate = event.start.dateTime ? new Date(event.start.dateTime) : null;
      endDate = event.end.dateTime ? new Date(event.end.dateTime) : null;
    }

    if (!startDate || !endDate) return false;

    const isEventToday = startDate >= todayStart && startDate <= todayEnd;
    const isFutureEvent = startDate > todayEnd;
    // NEW: Check if event ends today or in the future (is still ongoing)
    const isOngoingEvent = endDate >= todayStart;

    // Include events that:
    // 1. Start today or in the future, OR
    // 2. Started in the past BUT are still ongoing
    if (!(isEventToday || isFutureEvent || isOngoingEvent)) {
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
    const isAllDayEvent = !event.start.dateTime;

    let startDate: Date | null;
    let endDate: Date | null;

    if (isAllDayEvent) {
      startDate = event.start.date ? FormatUtils.parseAllDayDate(event.start.date) : null;
      endDate = event.end.date ? FormatUtils.parseAllDayDate(event.end.date) : null;

      // For all-day events, end date is exclusive in iCal format
      if (endDate) {
        const adjustedEndDate = new Date(endDate);
        adjustedEndDate.setDate(adjustedEndDate.getDate() - 1);
        endDate = adjustedEndDate;
      }
    } else {
      startDate = event.start.dateTime ? new Date(event.start.dateTime) : null;
      endDate = event.end.dateTime ? new Date(event.end.dateTime) : null;
    }

    if (!startDate || !endDate) return;

    // NEW: Determine which day to display this event on
    let displayDate: Date;

    if (startDate >= todayStart) {
      // Event starts today or in future: Display on start date
      displayDate = startDate;
    } else if (endDate.toDateString() === todayStart.toDateString()) {
      // Event ends today: Display on today
      displayDate = todayStart;
    } else if (startDate < todayStart && endDate > todayStart) {
      // Multi-day event that started in past and continues after today: Display on today
      displayDate = todayStart;
    } else {
      // Fallback (shouldn't happen given our filter): Display on start date
      displayDate = startDate;
    }

    // Use displayDate for grouping instead of startDate
    const eventDateKey = FormatUtils.getLocalDateKey(displayDate);
    const translations = Localize.getTranslations(language);

    if (!eventsByDay[eventDateKey]) {
      eventsByDay[eventDateKey] = {
        weekday: translations.daysOfWeek[displayDate.getDay()],
        day: displayDate.getDate(),
        month: translations.months[displayDate.getMonth()],
        timestamp: displayDate.getTime(),
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
      _entityLabel: getEntityLabel(event._entityId, config),
    });
  });

  // After creating eventsByDay, add week/month metadata
  const firstDayOfWeek = FormatUtils.getFirstDayOfWeek(config.first_day_of_week, language);

  // Add week and month metadata to each day
  Object.values(eventsByDay).forEach((day) => {
    const dayDate = new Date(day.timestamp);

    // Use helper function to calculate week number with majority rule
    day.weekNumber = calculateWeekNumberWithMajorityRule(dayDate, config, firstDayOfWeek);

    // Store month number for boundary detection
    day.monthNumber = dayDate.getMonth();

    // Check if this is the first day of a month
    day.isFirstDayOfMonth = dayDate.getDate() === 1;

    // Check if this is the first day of a week
    day.isFirstDayOfWeek = dayDate.getDay() === firstDayOfWeek;
  });

  // Sort events within each day
  Object.values(eventsByDay).forEach((day) => {
    day.events.sort((a, b) => {
      const aIsAllDay = !a.start.dateTime;
      const bIsAllDay = !b.start.dateTime;

      // All-day events should appear before timed events
      if (aIsAllDay && !bIsAllDay) return -1;
      if (!aIsAllDay && bIsAllDay) return 1;

      let aStart, bStart;

      if (aIsAllDay && a.start.date) {
        aStart = FormatUtils.parseAllDayDate(a.start.date).getTime();
      } else {
        aStart = a.start.dateTime ? new Date(a.start.dateTime).getTime() : 0;
      }

      if (bIsAllDay && b.start.date) {
        bStart = FormatUtils.parseAllDayDate(b.start.date).getTime();
      } else {
        bStart = b.start.dateTime ? new Date(b.start.dateTime).getTime() : 0;
      }

      return aStart - bStart;
    });
  });

  // Sort days and limit to configured number of days
  let days = Object.values(eventsByDay)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, config.days_to_show || 3);

  // Add empty days if configured
  if (config.show_empty_days) {
    const translations = Localize.getTranslations(language);
    // Use the reference date based on configuration instead of hardcoding today
    const referenceDate = getStartDateReference(config);

    // Create an array of all days in the configured range
    const allDays: Types.EventsByDay[] = [];

    for (let i = 0; i < (config.days_to_show || 3); i++) {
      const currentDate = new Date(referenceDate);
      currentDate.setDate(referenceDate.getDate() + i);

      // Create date key for this day
      const dateKey = FormatUtils.getLocalDateKey(currentDate);

      // If we already have events for this day, use those
      if (eventsByDay[dateKey]) {
        allDays.push(eventsByDay[dateKey]);
      } else {
        // Use helper function to calculate week number with majority rule
        const weekNumber = calculateWeekNumberWithMajorityRule(currentDate, config, firstDayOfWeek);

        // Otherwise create an empty day with a "fake" event that can use the regular rendering path
        const dayObj: Types.EventsByDay = {
          weekday: translations.daysOfWeek[currentDate.getDay()],
          day: currentDate.getDate(),
          month: translations.months[currentDate.getMonth()],
          timestamp: currentDate.getTime(),
          events: [
            {
              summary: translations.noEvents,
              start: { date: FormatUtils.getLocalDateKey(currentDate) },
              end: { date: FormatUtils.getLocalDateKey(currentDate) },
              _entityId: '_empty_day_',
              _isEmptyDay: true,
              location: '',
            },
          ],
          // Add week and month metadata with properly calculated week number
          weekNumber,
          monthNumber: currentDate.getMonth(),
          isFirstDayOfMonth: currentDate.getDate() === 1,
          isFirstDayOfWeek: currentDate.getDay() === firstDayOfWeek,
        };

        allDays.push(dayObj);
      }
    }

    // Replace our days array with the complete one
    days = allDays;
  }

  // Apply entity-specific event limits first (pre-filtering)
  // This happens before the global max_events_to_show limit is applied
  if (!isExpanded) {
    // Create a map to track how many events we've seen from each entity
    const entityEventCounts = new Map<string, number>();

    // Process each day
    for (const day of days) {
      // Create a new array to hold the filtered events for this day
      const filteredEvents: Types.CalendarEventData[] = [];

      // Process each event in the day
      for (const event of day.events) {
        // Skip empty day placeholders - always include these
        if (event._isEmptyDay) {
          filteredEvents.push(event);
          continue;
        }

        // Get the entity ID for this event
        const entityId = event._entityId;
        if (!entityId) {
          // If no entity ID (shouldn't happen), include the event
          filteredEvents.push(event);
          continue;
        }

        // Find the entity config for this event's source
        const entityConfig = config.entities.find((e) =>
          typeof e === 'string' ? e === entityId : e.entity === entityId,
        );

        // Skip if no config found (shouldn't happen)
        if (!entityConfig) {
          filteredEvents.push(event);
          continue;
        }

        // Get entity-specific max_events_to_show (if set)
        const entityMaxEvents =
          typeof entityConfig === 'object' ? entityConfig.max_events_to_show : undefined;

        // If no entity-specific limit, include the event
        if (entityMaxEvents === undefined) {
          filteredEvents.push(event);
          continue;
        }

        // Get current count for this entity
        const currentCount = entityEventCounts.get(entityId) || 0;

        // Check if we've reached the limit for this entity
        if (currentCount < entityMaxEvents) {
          // Include the event and increment the counter
          filteredEvents.push(event);
          entityEventCounts.set(entityId, currentCount + 1);
        }
        // If we've hit the limit, skip this event
      }

      // Replace the day's events with our filtered list
      day.events = filteredEvents;
    }
  }

  // Apply max_events_to_show limit if configured and not expanded (global limit)
  if (config.max_events_to_show && !isExpanded) {
    let eventsShown = 0;
    const maxEvents = config.max_events_to_show ?? 0;
    const limitedDays: Types.EventsByDay[] = [];

    for (const day of days) {
      // If we've already hit the limit, stop adding days
      if (eventsShown >= maxEvents) {
        break;
      }

      // For empty days, always include them without counting toward the max_events_to_show limit
      if (day.events.length === 1 && day.events[0]._isEmptyDay) {
        limitedDays.push(day);
        continue;
      }

      // Calculate how many events we can still add from this day
      const remainingEvents = maxEvents - eventsShown;

      // If this day has events to show (considering our remaining limit)
      if (remainingEvents > 0 && day.events.length > 0) {
        // Create a new day object with limited events
        const limitedDay: Types.EventsByDay = {
          ...day,
          events: day.events.slice(0, remainingEvents),
        };

        // Add this day to our result
        limitedDays.push(limitedDay);

        // Update our counter
        eventsShown += limitedDay.events.length;
      }
    }

    // Replace the original days array with our limited version
    days = limitedDays;
  }

  return days;
}

/**
 * Generate synthetic empty days for when no events are found
 * Creates placeholder days with "No events" message using the regular rendering pipeline
 *
 * @param config - Card configuration
 * @param language - Language code for translations
 * @returns Array of EventsByDay objects with empty day placeholders
 */
export function generateEmptyStateEvents(
  config: Types.Config,
  language: string,
): Types.EventsByDay[] {
  const translations = Localize.getTranslations(language);
  // Use the reference date based on configuration instead of hardcoding today
  const referenceDate = getStartDateReference(config);
  const days: Types.EventsByDay[] = [];

  // Get first day of week from config
  const firstDayOfWeek = FormatUtils.getFirstDayOfWeek(config.first_day_of_week, language);

  // Generate either just today (if show_empty_days is false) or all configured days
  const daysToGenerate = config.show_empty_days ? config.days_to_show : 1;

  for (let i = 0; i < daysToGenerate; i++) {
    const currentDate = new Date(referenceDate);
    currentDate.setDate(referenceDate.getDate() + i);

    // Use helper function to calculate week number with majority rule
    const weekNumber = calculateWeekNumberWithMajorityRule(currentDate, config, firstDayOfWeek);

    days.push({
      weekday: translations.daysOfWeek[currentDate.getDay()],
      day: currentDate.getDate(),
      month: translations.months[currentDate.getMonth()],
      timestamp: currentDate.getTime(),
      events: [
        {
          summary: translations.noEvents,
          start: { date: FormatUtils.getLocalDateKey(currentDate) },
          end: { date: FormatUtils.getLocalDateKey(currentDate) },
          _entityId: '_empty_day_',
          _isEmptyDay: true,
          location: '',
        },
      ],
      weekNumber,
      monthNumber: currentDate.getMonth(),
      isFirstDayOfMonth: currentDate.getDate() === 1,
      isFirstDayOfWeek: currentDate.getDay() === firstDayOfWeek,
    });
  }

  return days;
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
 * Get entity accent color with applied opacity
 * Retrieves accent color from entity config and converts it to RGBA in one step
 *
 * @param entityId - The entity ID to find color for
 * @param config - Current card configuration
 * @param opacity - Opacity value (0-100), if omitted returns solid color
 * @returns Color string ready for use in CSS with opacity applied if requested
 */
export function getEntityAccentColorWithOpacity(
  entityId: string | undefined,
  config: Types.Config,
  opacity?: number,
): string {
  if (!entityId) return 'var(--calendar-card-line-color-vertical)';

  // Find entity config
  const entityConfig = config.entities.find(
    (e) =>
      (typeof e === 'string' && e === entityId) || (typeof e === 'object' && e.entity === entityId),
  );

  // Get base color - whether from entity config or from vertical_line_color config
  const baseColor =
    typeof entityConfig === 'string'
      ? config.vertical_line_color // Use vertical_line_color for simple entity strings
      : entityConfig?.accent_color || config.vertical_line_color;

  // Explicitly check if opacity is undefined or 0
  // If opacity is undefined, 0, or NaN, return the base color with no transparency
  if (opacity === undefined || opacity === 0 || isNaN(opacity)) {
    return baseColor;
  }

  // Convert to RGBA with the specified opacity
  return Helpers.convertToRGBA(baseColor, opacity);
}

/**
 * Get entity label from configuration based on entity ID
 *
 * @param entityId - The entity ID to find label for
 * @param config - Current card configuration
 * @returns Label string or undefined if not set
 */
export function getEntityLabel(
  entityId: string | undefined,
  config: Types.Config,
): string | undefined {
  if (!entityId) return undefined;

  const entityConfig = config.entities.find(
    (e) =>
      (typeof e === 'string' && e === entityId) || (typeof e === 'object' && e.entity === entityId),
  );

  if (!entityConfig || typeof entityConfig === 'string') return undefined;

  return entityConfig.label;
}

/**
 * Get entity-specific setting or fall back to global setting
 *
 * @param entityId - The entity ID to check settings for
 * @param settingName - Name of the setting to retrieve
 * @param config - Current card configuration
 * @returns The entity-specific setting if available, or undefined if not set
 */
export function getEntitySetting<K extends keyof Types.EntityConfig>(
  entityId: string | undefined,
  settingName: K,
  config: Types.Config,
): Types.EntityConfig[K] | undefined {
  if (!entityId) return undefined;

  // Find entity configuration
  const entityConfig = config.entities.find(
    (e) =>
      (typeof e === 'string' && e === entityId) || (typeof e === 'object' && e.entity === entityId),
  );

  // Only object configurations can have entity-specific settings
  if (!entityConfig || typeof entityConfig === 'string') return undefined;

  // Return the entity-specific setting
  return entityConfig[settingName];
}

/**
 * Determine if this is likely a manual page reload rather than an automatic refresh
 * Uses performance API to check navigation type when available
 *
 * @returns True if this appears to be a manual page load/reload
 */
export function isManualPageLoad(): boolean {
  // Use the Performance Navigation API when available
  if (window.performance && window.performance.navigation) {
    // navigation.type: 0=navigate, 1=reload, 2=back/forward
    return window.performance.navigation.type === 1; // reload
  }

  // For newer browsers using Navigation API
  if (window.performance && window.performance.getEntriesByType) {
    const navEntries = window.performance.getEntriesByType('navigation');
    if (navEntries.length > 0 && 'type' in navEntries[0]) {
      return (navEntries[0] as { type: string }).type === 'reload';
    }
  }

  // Default to false if we can't determine
  return false;
}

//-----------------------------------------------------------------------------
// DATA FETCHING FUNCTIONS
//-----------------------------------------------------------------------------

/**
 * Fetch calendar events from Home Assistant API
 * @private Internal utility used by fetchEventData
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
      } catch {
        // Silent
      }
    }
  }

  return allEvents;
}

/**
 * Calculate time window for event fetching
 *
 * @param daysToShow - Number of days to show in the calendar
 * @param startDate - Optional start date in YYYY-MM-DD format or ISO format
 * @returns Object containing start and end dates for the calendar window
 */
export function getTimeWindow(daysToShow: number, startDate?: string): { start: Date; end: Date } {
  let start: Date;

  // Parse custom start date if provided
  if (startDate && startDate.trim() !== '') {
    try {
      // Check if it's an ISO date string (which HA converts to when saving)
      if (startDate.includes('T')) {
        // Handle ISO format (e.g. "2025-03-14T00:00:00.000Z")
        start = new Date(startDate);

        // Check if valid date
        if (isNaN(start.getTime())) {
          Logger.warn(`Invalid ISO date: ${startDate}, falling back to today`);
          start = new Date();
          start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        }
      } else {
        // Handle YYYY-MM-DD format
        const [year, month, day] = startDate.split('-').map(Number);

        // Validate date components (month is 1-indexed in input, but 0-indexed in Date constructor)
        if (year && month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          start = new Date(year, month - 1, day);

          // Double-check if date is valid (e.g., not Feb 30)
          if (isNaN(start.getTime())) {
            Logger.warn(`Invalid date: ${startDate}, falling back to today`);
            start = new Date();
            start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
          }
        } else {
          Logger.warn(`Malformed date: ${startDate}, falling back to today`);
          start = new Date();
          start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        }
      }
    } catch (error) {
      Logger.warn(`Error parsing date: ${startDate}, falling back to today`, error);
      start = new Date();
      start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    }
  } else {
    // Default to today if no valid start date provided
    start = new Date();
    start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  }

  // Make sure time is set to 00:00:00
  start.setHours(0, 0, 0, 0);

  // Calculate end date based on start date
  const end = new Date(start);
  const days = parseInt(daysToShow.toString()) || 3;
  end.setDate(start.getDate() + days);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Filter duplicate events based on summary, start/end times, and location
 * Prioritizes events from entities that appear earlier in the config
 *
 * @param events Array of events to filter
 * @param config Card configuration
 * @returns Filtered array with duplicates removed
 */
function filterDuplicateEvents(
  events: Types.CalendarEventData[],
  config: Types.Config,
): Types.CalendarEventData[] {
  // Skip filtering if not enabled or no events
  if (!config.filter_duplicates || !events.length) return events;

  // Create index map for entity priority based on config order
  const entityIndexMap = new Map<string, number>();
  config.entities.forEach((entity, index) => {
    const entityId = typeof entity === 'string' ? entity : entity.entity;
    entityIndexMap.set(entityId, index);
  });

  // Sort by entity priority
  const sortedEvents = [...events].sort((a, b) => {
    // Skip empty day events (they should never be duplicates)
    if (a._isEmptyDay || b._isEmptyDay) return 0;

    const aIndex = a._entityId ? (entityIndexMap.get(a._entityId) ?? Infinity) : Infinity;
    const bIndex = b._entityId ? (entityIndexMap.get(b._entityId) ?? Infinity) : Infinity;
    return aIndex - bIndex;
  });

  // Track seen event signatures
  const seen = new Set<string>();

  // Filter out duplicates
  return sortedEvents.filter((event) => {
    // Always keep empty day events
    if (event._isEmptyDay) return true;

    const signature = generateEventSignature(event);
    if (seen.has(signature)) {
      Logger.debug(`Filtered duplicate event: ${event.summary}`);
      return false;
    }

    seen.add(signature);
    return true;
  });
}

/**
 * Filter events based on blocklist and allowlist patterns
 * Each calendar entity can have its own filtering rules
 */
function filterEventsByLists(
  events: Types.CalendarEventData[],
  config: Types.Config,
): Types.CalendarEventData[] {
  // Group events by their source entity
  const eventsByEntity: Record<string, Types.CalendarEventData[]> = {};
  events.forEach((event) => {
    if (!event?._entityId) return;

    if (!eventsByEntity[event._entityId]) {
      eventsByEntity[event._entityId] = [];
    }

    eventsByEntity[event._entityId].push(event);
  });

  // Process each entity's events with its specific filters
  const filteredEvents: Types.CalendarEventData[] = [];

  config.entities.forEach((entityConfig) => {
    const entityId = typeof entityConfig === 'string' ? entityConfig : entityConfig.entity;
    const entityEvents = eventsByEntity[entityId] || [];

    // Simple string entities have no filtering
    if (typeof entityConfig === 'string') {
      filteredEvents.push(...entityEvents);
      return;
    }

    // Apply filters based on configuration
    let filteredEntityEvents = [...entityEvents];

    // Allowlist takes precedence over blocklist
    if (entityConfig.allowlist) {
      const allowPattern = new RegExp(entityConfig.allowlist, 'i');
      filteredEntityEvents = filteredEntityEvents.filter(
        (event) => event.summary && allowPattern.test(event.summary),
      );
    } else if (entityConfig.blocklist) {
      const blockPattern = new RegExp(entityConfig.blocklist, 'i');
      filteredEntityEvents = filteredEntityEvents.filter(
        (event) => !(event.summary && blockPattern.test(event.summary)),
      );
    }

    filteredEvents.push(...filteredEntityEvents);
  });

  return filteredEvents;
}

/**
 * Generate a unique signature for an event based on summary, time, and location
 *
 * @param event Calendar event to generate signature for
 * @returns Unique string signature
 */
function generateEventSignature(event: Types.CalendarEventData): string {
  const summary = event.summary || '';
  const location = event.location || '';

  // Different handling for all-day vs timed events
  let timeSignature = '';

  if (event.start.dateTime) {
    // For timed events, use ISO string representation
    const startTime = new Date(event.start.dateTime).getTime();
    const endTime = event.end.dateTime ? new Date(event.end.dateTime).getTime() : 0;
    timeSignature = `${startTime}|${endTime}`;
  } else {
    // For all-day events, use date strings directly
    timeSignature = `${event.start.date || ''}|${event.end.date || ''}`;
  }

  // Combine summary, time signature, and location into a unique signature
  return `${summary}|${timeSignature}|${location}`;
}

//-----------------------------------------------------------------------------
// CACHE MANAGEMENT FUNCTIONS
//-----------------------------------------------------------------------------

/**
 * Get cached event data if available and not expired
 *
 * @param key - Cache key
 * @param config - Card configuration
 * @param isManualPageReload - Whether this check is during a manual page reload
 * @returns Cached events or null if expired/unavailable
 */
export function getCachedEvents(
  key: string,
  config?: Types.Config,
  isManualPageReload: boolean = false,
): Types.CalendarEventData[] | null {
  const cacheEntry = getValidCacheEntry(key, config, isManualPageReload);
  if (cacheEntry) {
    return [...cacheEntry.events];
  }
  return null;
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
 * Generate a base cache key from configuration
 * This function creates a stable cache key that depends only on data-affecting parameters
 *
 * @param instanceId - Component instance ID for uniqueness
 * @param entities - Calendar entities
 * @param daysToShow - Number of days to display
 * @param showPastEvents - Whether to show past events
 * @param startDate - Optional start date in YYYY-MM-DD format or ISO format
 * @param filterDuplicates - Whether duplicate filtering is enabled
 * @returns Base cache key
 */
export function getBaseCacheKey(
  instanceId: string,
  entities: Array<string | Types.EntityConfig>,
  daysToShow: number,
  showPastEvents: boolean,
  startDate?: string,
  filterDuplicates: boolean = false,
): string {
  const entityIds = entities
    .map((e) => (typeof e === 'string' ? e : e.entity))
    .sort()
    .join('_');

  // Normalize ISO date format to YYYY-MM-DD for caching
  let normalizedStartDate = '';
  if (startDate) {
    try {
      if (startDate.includes('T')) {
        // It's an ISO date, extract just the date part
        normalizedStartDate = startDate.split('T')[0];
      } else {
        normalizedStartDate = startDate;
      }
    } catch {
      normalizedStartDate = startDate; // Fallback to original
    }
  }

  // Include the normalized startDate in the cache key
  const startDatePart = normalizedStartDate ? `_${normalizedStartDate}` : '';

  // Include filter_duplicates state in the cache key
  const filterPart = filterDuplicates ? '_filtered' : '';

  // Include entity filter patterns in cache key
  const filterPatterns: string[] = [];
  entities.forEach((entity) => {
    if (typeof entity !== 'string') {
      if (entity.blocklist) filterPatterns.push(`b:${entity.entity}:${entity.blocklist}`);
      if (entity.allowlist) filterPatterns.push(`a:${entity.entity}:${entity.allowlist}`);
    }
  });

  const filterListPart =
    filterPatterns.length > 0 ? `_filters:${encodeURIComponent(filterPatterns.join('|'))}` : '';

  return `${Constants.CACHE.EVENT_CACHE_KEY_PREFIX}${instanceId}_${entityIds}_${daysToShow}_${showPastEvents ? 1 : 0}${startDatePart}${filterPart}${filterListPart}`;
}

/**
 * Parse and validate cache entry
 * Helper function to ensure consistent cache validation
 *
 * @param key - Cache key
 * @param config - Card configuration for cache duration
 * @param isManualPageReload - Whether this check is during a manual page reload
 * @returns Valid cache entry or null if invalid/expired
 */
export function getValidCacheEntry(
  key: string,
  config?: Types.Config,
  isManualPageReload: boolean = false,
): Types.CacheEntry | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const cache = JSON.parse(item) as Types.CacheEntry;
    const now = Date.now();

    // Determine cache duration based on context
    let cacheDuration;

    // Only apply short cache duration if refresh_on_navigate is enabled
    // and this is a manual page reload/navigation
    if (isManualPageReload && config?.refresh_on_navigate) {
      cacheDuration = Constants.CACHE.MANUAL_RELOAD_CACHE_DURATION_SECONDS * 1000;
    } else {
      // Otherwise use normal cache duration
      cacheDuration = getCacheDuration(config);
    }

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
 * Get refresh interval from config or use default
 *
 * @param config - Card configuration
 * @returns Cache duration in milliseconds
 */
export function getCacheDuration(config?: Types.Config): number {
  return (config?.refresh_interval || Constants.CACHE.DEFAULT_DATA_REFRESH_MINUTES) * 60 * 1000;
}

//-----------------------------------------------------------------------------
// DATE HANDLING HELPERS
//-----------------------------------------------------------------------------

/**
 * Get the reference start date based on configuration or today
 * Used for both empty days generation and time window calculations
 *
 * @param config - Card configuration with optional start_date
 * @returns Date object representing the starting reference date
 */
function getStartDateReference(config: Types.Config): Date {
  // If start_date is configured, use it
  if (config.start_date && config.start_date.trim() !== '') {
    // Reuse existing getTimeWindow function which already has date parsing logic
    const timeWindow = getTimeWindow(config.days_to_show, config.start_date);
    return timeWindow.start;
  }

  // Otherwise use today as fallback
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Calculate week number with majority rule adjustment applied
 * Handles special case for ISO week numbers when Sunday is the first day of week
 *
 * @param date Date to calculate week number for
 * @param config Card configuration
 * @param firstDayOfWeek First day of week (0 = Sunday, 1 = Monday)
 * @returns Calculated week number with majority rule applied
 */
export function calculateWeekNumberWithMajorityRule(
  date: Date,
  config: Types.Config,
  firstDayOfWeek: number,
): number | null {
  // Basic week number calculation
  let weekNumber = FormatUtils.getWeekNumber(date, config.show_week_numbers, firstDayOfWeek);

  // Apply "majority rule" for ISO week numbers when first day is Sunday
  if (config.show_week_numbers === 'iso' && firstDayOfWeek === 0 && date.getDay() === 0) {
    // For Sunday with ISO week numbering, get the week number of the next day (Monday)
    // This ensures we display the week number that applies to most days in the visible week
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    weekNumber = FormatUtils.getISOWeekNumber(nextDay);
  }

  return weekNumber;
}
