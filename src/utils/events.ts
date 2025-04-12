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

  // Process events according to configuration rules
  const processedEvents = processEvents(fetchedEvents, config);

  // Cache and return the processed results
  cacheEvents(cacheKey, processedEvents);

  return processedEvents;
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

  // Use reference date from configuration instead of hardcoded "today"
  const referenceDate = getStartDateReference(config);
  const referenceStart = new Date(referenceDate);
  const referenceEnd = new Date(referenceStart);
  referenceEnd.setHours(23, 59, 59, 999);

  // Current time is still needed for past event filtering
  const now = new Date();

  // Process events into initial days structure
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

    // Use reference date instead of today for event filtering
    const isEventOnOrAfterReference = startDate >= referenceStart && startDate <= referenceEnd;
    const isFutureEvent = startDate > referenceEnd;
    const isOngoingEvent = endDate >= referenceStart;

    // Include events that:
    // 1. Start on or after the reference date, OR
    // 2. Started before reference date BUT are still ongoing
    if (!(isEventOnOrAfterReference || isFutureEvent || isOngoingEvent)) {
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

    // Determine which day to display this event on, using reference date instead of today
    let displayDate: Date;

    if (startDate >= referenceStart) {
      // Event starts on or after reference date: Display on start date
      displayDate = startDate;
    } else if (endDate.toDateString() === referenceStart.toDateString()) {
      // Event ends on reference date: Display on reference date
      displayDate = referenceStart;
    } else if (startDate < referenceStart && endDate > referenceStart) {
      // Multi-day event that started before reference date and continues after:
      // Display on reference date
      displayDate = referenceStart;
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
      _entityLabel: getEntityLabel(event._entityId, config, event),
      _matchedConfig: event._matchedConfig,
      _isEmptyDay: event._isEmptyDay,
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

      // If both events are all-day events with the same start date, check entity order first
      if (aIsAllDay && bIsAllDay && aStart === bStart) {
        // First, respect entity order from configuration
        const aEntityIndex = getEntityIndex(a._entityId, config);
        const bEntityIndex = getEntityIndex(b._entityId, config);

        if (aEntityIndex !== bEntityIndex) {
          // Sort by entity order first
          return aEntityIndex - bEntityIndex;
        }

        // For events from the same entity, sort alphabetically by summary (case insensitive)
        return (a.summary || '').localeCompare(b.summary || '', undefined, { sensitivity: 'base' });
      }

      // Otherwise sort by start time
      return aStart - bStart;
    });
  });

  // Sort days and determine effective days to show based on mode
  const effectiveDaysToShow = isExpanded
    ? config.days_to_show
    : config.compact_days_to_show || config.days_to_show;

  // Get days in chronological order limited to effective days to show
  let days = Object.values(eventsByDay)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, effectiveDaysToShow || 3);

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
          typeof entityConfig === 'object'
            ? (entityConfig.compact_events_to_show ?? entityConfig.max_events_to_show)
            : undefined;

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

  // Apply events limit if configured and not expanded (compact mode event limiting)
  // Consider both max_events_to_show (legacy) and compact_events_to_show (new)
  if (!isExpanded) {
    // Get the effective max events setting (compact_events_to_show takes precedence over max_events_to_show)
    const maxEvents = config.compact_events_to_show ?? config.max_events_to_show;

    if (maxEvents !== undefined) {
      let filteredDays: Types.EventsByDay[] = [];
      let totalEventsShown = 0;

      // Handle soft limit (complete days) mode
      if (config.compact_events_complete_days) {
        const daysStarted = new Set<string>();

        // First pass - identify which days have at least one event that would be shown
        for (const day of days) {
          // Skip empty days for counting purposes
          if (day.events.length === 1 && day.events[0]._isEmptyDay) {
            continue;
          }

          // If we can show at least one event from this day
          if (totalEventsShown < maxEvents && day.events.length > 0) {
            // Calculate how many events we would show from this day
            const eventsToShow = Math.min(day.events.length, maxEvents - totalEventsShown);

            if (eventsToShow > 0) {
              // Mark this day as "started" and update our event counter
              daysStarted.add(FormatUtils.getLocalDateKey(new Date(day.timestamp)));
              totalEventsShown += eventsToShow;
            }
          }
        }

        // Second pass - keep only the days we've started showing
        filteredDays = days.filter((day) => {
          const dayKey = FormatUtils.getLocalDateKey(new Date(day.timestamp));
          return daysStarted.has(dayKey);
        });
      }
      // Handle hard limit mode (standard behavior)
      else {
        filteredDays = [];

        // Process days until we hit our event limit
        for (const day of days) {
          // If already at limit and this isn't an empty day, skip
          if (
            totalEventsShown >= maxEvents &&
            !(day.events.length === 1 && day.events[0]._isEmptyDay)
          ) {
            break;
          }

          // If this is an empty day with just a placeholder event, add it without counting
          if (day.events.length === 1 && day.events[0]._isEmptyDay) {
            filteredDays.push(day);
            continue;
          }

          // Calculate how many more events we can show
          const remainingEvents = maxEvents - totalEventsShown;

          // If we can show at least some events from this day
          if (remainingEvents > 0 && day.events.length > 0) {
            // Create a copy of the day with only the events we can show
            const limitedDay: Types.EventsByDay = {
              ...day,
              events: day.events.slice(0, remainingEvents),
            };

            // Add the limited day to our result and update our counter
            filteredDays.push(limitedDay);
            totalEventsShown += limitedDay.events.length;
          }
        }
      }

      // Replace our days array with the filtered version
      days = filteredDays;
    }
  }

  // Only add empty days AFTER we've filtered events in compact mode
  // This ensures empty days are only added for days that would actually be shown
  if (config.show_empty_days) {
    const translations = Localize.getTranslations(language);

    // Always start from the configured reference date
    let startDateForEmptyDays = new Date(referenceDate);
    let endDateForEmptyDays: Date;

    if (!isExpanded && days.length > 0) {
      // In compact mode with existing days: only fill empty days within the range of days we're already showing
      const maxTimestamp = Math.max(...days.map((d) => d.timestamp));

      // Keep startDateForEmptyDays as the configured reference date
      endDateForEmptyDays = new Date(maxTimestamp);
    } else {
      // In expanded mode or when no days: use full range from reference date
      endDateForEmptyDays = new Date(referenceDate);
      endDateForEmptyDays.setDate(endDateForEmptyDays.getDate() + effectiveDaysToShow - 1);
    }

    // Create a set of existing day keys for quick lookup
    const existingDayKeys = new Set(
      days.map((day) => FormatUtils.getLocalDateKey(new Date(day.timestamp))),
    );

    // Create a combined array with both existing days and new empty days
    const allDays: Types.EventsByDay[] = [...days];

    // Calculate the number of days between start and end dates
    const dayDiff = Math.floor(
      (endDateForEmptyDays.getTime() - startDateForEmptyDays.getTime()) / (24 * 60 * 60 * 1000),
    );

    // Generate empty days for any missing dates in the range
    for (let i = 0; i <= dayDiff; i++) {
      const currentDate = new Date(startDateForEmptyDays);
      currentDate.setDate(startDateForEmptyDays.getDate() + i);

      // Create a date key for this day
      const dateKey = FormatUtils.getLocalDateKey(currentDate);

      // Only add if we don't already have events for this day
      if (!existingDayKeys.has(dateKey)) {
        // Create an empty day with a "fake" event
        const dayObj: Types.EventsByDay = {
          weekday: translations.daysOfWeek[currentDate.getDay()],
          day: currentDate.getDate(),
          month: translations.months[currentDate.getMonth()],
          timestamp: currentDate.getTime(),
          events: [
            {
              summary: config.no_events_text ?? translations.noEvents,
              start: { date: dateKey },
              end: { date: dateKey },
              _entityId: '_empty_day_',
              _isEmptyDay: true,
              location: '',
            },
          ],
          weekNumber: calculateWeekNumberWithMajorityRule(currentDate, config, firstDayOfWeek),
          monthNumber: currentDate.getMonth(),
          isFirstDayOfMonth: currentDate.getDate() === 1,
          isFirstDayOfWeek: currentDate.getDay() === firstDayOfWeek,
        };

        allDays.push(dayObj);
      }
    }

    // Sort the combined days and limit to the effective days to show
    allDays.sort((a, b) => a.timestamp - b.timestamp);
    days = allDays;
  }

  // Final limit to ensure we don't exceed effectiveDaysToShow
  return days.slice(0, effectiveDaysToShow);
}

/**
 * Helper function to get the entity index from the configuration
 * Used to maintain the order of events based on the entity order in the configuration
 *
 * @param entityId - Entity ID to find
 * @param config - Card configuration
 * @returns Numeric index of entity in the config (lower = higher priority)
 */
function getEntityIndex(entityId: string | undefined, config: Types.Config): number {
  if (!entityId) return Number.MAX_SAFE_INTEGER;

  // Find the entity in the configuration
  const index = config.entities.findIndex((e) =>
    typeof e === 'string' ? e === entityId : e.entity === entityId,
  );

  // Return the found index or a large number if not found
  return index !== -1 ? index : Number.MAX_SAFE_INTEGER;
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
          summary: config.no_events_text ?? translations.noEvents,
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

//-----------------------------------------------------------------------------
// EVENT PROCESSING & FILTERING
//-----------------------------------------------------------------------------

/**
 * Process events according to configuration - handles duplicates and applies filters
 *
 * @param events Raw calendar events fetched from API
 * @param config Calendar card configuration
 * @returns Processed events with filters and duplicate handling applied
 */
function processEvents(
  events: ReadonlyArray<Types.CalendarEventData>,
  config: Types.Config,
): Types.CalendarEventData[] {
  // Group events by their source calendar entity
  const eventsByEntity: Record<string, Types.CalendarEventData[]> = {};
  events.forEach((event) => {
    if (!event?._entityId) return;

    if (!eventsByEntity[event._entityId]) {
      eventsByEntity[event._entityId] = [];
    }

    eventsByEntity[event._entityId].push({ ...event });
  });

  // Final array to hold all processed events
  const processedEvents: Types.CalendarEventData[] = [];

  // Set to track already handled events when filter_duplicates is true
  const handledEventSignatures = config.filter_duplicates ? new Set<string>() : null;

  // Process each entity configuration in order to maintain priority
  for (const entityConfig of config.entities) {
    const entityId = typeof entityConfig === 'string' ? entityConfig : entityConfig.entity;
    const entityEvents = eventsByEntity[entityId] || [];

    if (entityEvents.length === 0) continue;

    // Filter events based on entity configuration
    const matchedEvents = filterEventsForEntity(entityEvents, entityConfig);

    // Process matched events
    for (const event of matchedEvents) {
      // Generate unique signature for duplicate detection
      const signature = config.filter_duplicates ? generateEventSignature(event) : '';

      // Skip this event if it's a duplicate and filter_duplicates is enabled
      if (config.filter_duplicates && handledEventSignatures?.has(signature)) {
        continue;
      }

      // Mark this event as handled if filter_duplicates is enabled
      if (config.filter_duplicates) {
        handledEventSignatures?.add(signature);
      }

      // Create a copy with matched configuration
      const processedEvent = { ...event };

      // Store the matched configuration for rendering
      if (typeof entityConfig !== 'string') {
        processedEvent._matchedConfig = entityConfig;
      }

      // Add to final result
      processedEvents.push(processedEvent);
    }
  }

  // Split multi-day events after all processing is complete
  const finalEvents = processMultiDayEvents(processedEvents, config);

  Logger.debug(`Processed ${finalEvents.length} events after filtering and splitting`);
  return finalEvents;
}

/**
 * Process and split multi-day events based on configuration
 */
function processMultiDayEvents(
  events: Types.CalendarEventData[],
  config: Types.Config,
): Types.CalendarEventData[] {
  const result: Types.CalendarEventData[] = [];

  for (const event of events) {
    // Skip if we shouldn't split this event
    if (!shouldSplitEvent(event, config)) {
      result.push(event);
      continue;
    }

    // Skip if not a multi-day event
    if (!isMultiDayEvent(event)) {
      result.push(event);
      continue;
    }

    // Split multi-day event into segments
    const segments = splitMultiDayEvent(event);
    result.push(...segments);
  }

  return result;
}

/**
 * Check if an event spans multiple days
 */
function isMultiDayEvent(event: Types.CalendarEventData): boolean {
  if (!event.start || !event.end) return false;

  // Handle all-day events
  if (event.start.date && event.end.date) {
    const startDate = new Date(event.start.date);
    // For all-day events, end date is exclusive in iCal format
    const endDate = new Date(event.end.date);
    endDate.setDate(endDate.getDate() - 1);

    return startDate.toDateString() !== endDate.toDateString();
  }

  // Handle timed events
  if (event.start.dateTime && event.end.dateTime) {
    const startDate = new Date(event.start.dateTime);
    const endDate = new Date(event.end.dateTime);

    return startDate.toDateString() !== endDate.toDateString();
  }

  return false;
}

/**
 * Check if event splitting should be applied based on configuration
 */
function shouldSplitEvent(event: Types.CalendarEventData, config: Types.Config): boolean {
  // Check entity-specific setting if available
  if (
    event._entityId &&
    event._matchedConfig &&
    typeof event._matchedConfig.split_multiday_events !== 'undefined'
  ) {
    return event._matchedConfig.split_multiday_events;
  }

  // Otherwise use global setting
  return config.split_multiday_events;
}

/**
 * Format a Date object to YYYY-MM-DD string format
 * This is the inverse of parseAllDayDate and preserves local date values
 */
function formatAllDayDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Split a multi-day event into daily segments
 */
function splitMultiDayEvent(event: Types.CalendarEventData): Types.CalendarEventData[] {
  const segments: Types.CalendarEventData[] = [];

  // Handle all-day events
  if (event.start.date && event.end.date) {
    // Parse dates using the helper function that handles local dates properly
    const startDate = FormatUtils.parseAllDayDate(event.start.date);
    const endDate = FormatUtils.parseAllDayDate(event.end.date);
    endDate.setDate(endDate.getDate() - 1); // Adjust end date (exclusive in iCal)

    // For each day in the range, create a segment
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      // Format dates using our local-aware formatter
      const currentDateStr = formatAllDayDate(date);

      // Create the next day for end date (exclusive end date)
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = formatAllDayDate(nextDate);

      // Create segment with proper all-day format
      const segment: Types.CalendarEventData = {
        ...event,
        start: { date: currentDateStr },
        end: { date: nextDateStr },
      };

      segments.push(segment);
    }
  }
  // Handle timed events
  else if (event.start.dateTime && event.end.dateTime) {
    const startDateTime = new Date(event.start.dateTime);
    const endDateTime = new Date(event.end.dateTime);

    // First day: start time to end of day
    const firstDayEnd = new Date(startDateTime);
    firstDayEnd.setHours(23, 59, 59, 999);

    if (firstDayEnd < endDateTime) {
      // First day segment
      const firstDaySegment: Types.CalendarEventData = {
        ...event,
        start: { dateTime: startDateTime.toISOString() },
        end: { dateTime: firstDayEnd.toISOString() },
      };
      segments.push(firstDaySegment);

      // Middle days: full days (if any)
      const middleStart = new Date(startDateTime);
      middleStart.setDate(middleStart.getDate() + 1);
      middleStart.setHours(0, 0, 0, 0);

      const lastDayStart = new Date(endDateTime);
      lastDayStart.setHours(0, 0, 0, 0);

      for (
        let date = new Date(middleStart);
        date < lastDayStart;
        date.setDate(date.getDate() + 1)
      ) {
        // Format middle days as all-day events using our local-aware formatter
        const currentDateStr = formatAllDayDate(date);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = formatAllDayDate(nextDate);

        const middleDaySegment: Types.CalendarEventData = {
          ...event,
          // Create all-day event for middle days
          start: { date: currentDateStr },
          end: { date: nextDateStr },
        };

        segments.push(middleDaySegment);
      }

      // Last day: start of day to end time
      const lastDaySegment: Types.CalendarEventData = {
        ...event,
        start: { dateTime: lastDayStart.toISOString() },
        end: { dateTime: endDateTime.toISOString() },
      };
      segments.push(lastDaySegment);
    } else {
      // Event doesn't cross midnight, keep as is
      segments.push({ ...event });
    }
  }

  return segments;
}

/**
 * Filter events for a specific entity configuration
 * Applies allowlist/blocklist filters
 */
function filterEventsForEntity(
  events: Types.CalendarEventData[],
  entityConfig: string | Types.EntityConfig,
): Types.CalendarEventData[] {
  // Simple entity ID format has no filters
  if (typeof entityConfig === 'string') {
    return [...events];
  }

  // Start with all events
  let matchedEvents = [...events];

  // Apply allowlist if specified (has precedence over blocklist)
  if (entityConfig.allowlist) {
    try {
      const allowPattern = new RegExp(entityConfig.allowlist, 'i');
      matchedEvents = matchedEvents.filter(
        (event) => event.summary && allowPattern.test(event.summary),
      );
    } catch (error) {
      Logger.warn(`Invalid allowlist pattern: ${entityConfig.allowlist}`, error);
    }
  }
  // Apply blocklist if no allowlist was specified
  else if (entityConfig.blocklist) {
    try {
      const blockPattern = new RegExp(entityConfig.blocklist, 'i');
      matchedEvents = matchedEvents.filter(
        (event) => !(event.summary && blockPattern.test(event.summary)),
      );
    } catch (error) {
      Logger.warn(`Invalid blocklist pattern: ${entityConfig.blocklist}`, error);
    }
  }

  return matchedEvents;
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
// DATA ACCESS FUNCTIONS
//-----------------------------------------------------------------------------

/**
 * Get entity color from configuration based on entity ID
 *
 * @param entityId - The entity ID to find color for
 * @param config - Current card configuration
 * @param event - Optional event data containing matched configuration
 * @returns Color string from entity config or default
 */
export function getEntityColor(
  entityId: string | undefined,
  config: Types.Config,
  event?: Types.CalendarEventData,
): string {
  if (!entityId) return 'var(--primary-text-color)';

  // Check if we have a matched config stored directly on the event
  if (event && event._matchedConfig) {
    const matchedConfig = event._matchedConfig;
    return matchedConfig.color || 'var(--primary-text-color)';
  }

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
 * @param event - Optional event data containing matched configuration
 * @returns Color string ready for use in CSS with opacity applied if requested
 */
export function getEntityAccentColorWithOpacity(
  entityId: string | undefined,
  config: Types.Config,
  opacity?: number,
  event?: Types.CalendarEventData,
): string {
  if (!entityId) return 'var(--calendar-card-line-color-vertical)';

  // Check if we have a matched config stored directly on the event
  let entityConfig;
  if (event && event._matchedConfig) {
    entityConfig = event._matchedConfig;
  } else {
    // Find entity config the traditional way
    entityConfig = config.entities.find(
      (e) =>
        (typeof e === 'string' && e === entityId) ||
        (typeof e === 'object' && e.entity === entityId),
    );
  }

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
 * @param event - Optional event data containing matched configuration
 * @returns Label string or undefined if not set
 */
export function getEntityLabel(
  entityId: string | undefined,
  config: Types.Config,
  event?: Types.CalendarEventData,
): string | undefined {
  if (!entityId) return undefined;

  // Check if we have a matched config stored directly on the event
  if (event && event._matchedConfig) {
    return event._matchedConfig.label;
  }

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
 * @param event - Optional event data containing matched configuration
 * @returns The entity-specific setting if available, or undefined if not set
 */
export function getEntitySetting<K extends keyof Types.EntityConfig>(
  entityId: string | undefined,
  settingName: K,
  config: Types.Config,
  event?: Types.CalendarEventData,
): Types.EntityConfig[K] | undefined {
  if (!entityId) return undefined;

  // Check if we have a matched config stored directly on the event
  if (event && event._matchedConfig) {
    return event._matchedConfig[settingName];
  }

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
 * Check if an event is currently running (started but not yet ended)
 *
 * @param event Calendar event to check
 * @returns True if the event is currently running
 */
export function isEventCurrentlyRunning(event: Types.CalendarEventData): boolean {
  if (!event || event._isEmptyDay) return false;

  const now = new Date();
  const isAllDayEvent = !event.start.dateTime;

  // All-day events don't show a progress bar
  if (isAllDayEvent) return false;

  const startDateTime = event.start.dateTime ? new Date(event.start.dateTime) : null;
  const endDateTime = event.end.dateTime ? new Date(event.end.dateTime) : null;

  if (!startDateTime || !endDateTime) return false;

  // Event is running if current time is between start and end
  return now >= startDateTime && now < endDateTime;
}

/**
 * Calculate progress percentage for a running event
 *
 * @param event Calendar event to calculate progress for
 * @returns Progress percentage (0-100) or null if event is not running
 */
export function calculateEventProgress(event: Types.CalendarEventData): number | null {
  if (!isEventCurrentlyRunning(event)) return null;

  const now = new Date();
  const startDateTime = new Date(event.start.dateTime!);
  const endDateTime = new Date(event.end.dateTime!);

  const totalDuration = endDateTime.getTime() - startDateTime.getTime();
  const elapsedTime = now.getTime() - startDateTime.getTime();

  // Calculate percentage and ensure it's between 0-100
  const progressPercentage = Math.min(
    100,
    Math.max(0, Math.floor((elapsedTime / totalDuration) * 100)),
  );

  return progressPercentage;
}

//-----------------------------------------------------------------------------
// DATA FETCHING & API FUNCTIONS
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

  // Create a Set to track which entity IDs we've already fetched
  const fetchedEntityIds = new Set<string>();

  for (const entityConfig of entities) {
    // Skip entities we already fetched
    if (fetchedEntityIds.has(entityConfig.entity)) {
      continue;
    }

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

      // Mark this entity as fetched
      fetchedEntityIds.add(entityConfig.entity);
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
 * Parse a relative date string like "today+7" or "today-3"
 * Returns a Date object for the specified offset from today
 *
 * @param relativeDate - String in format "today+n" or "today-n" where n is number of days
 * @returns Date object or null if invalid format
 */
function parseRelativeDate(relativeDate: string): Date | null {
  // Check for simplified format: +7 or -3 (without "today" prefix)
  const simplifiedMatch = relativeDate.match(/^([+-])(\d+)$/);
  if (simplifiedMatch) {
    const sign = simplifiedMatch[1] === '+' ? 1 : -1;
    const days = parseInt(simplifiedMatch[2], 10);

    if (!isNaN(days)) {
      const date = new Date();
      date.setHours(0, 0, 0, 0); // Normalize to start of day
      date.setDate(date.getDate() + sign * days);
      return date;
    }
    return null;
  }

  // Check for standard format: today+7 or today-3
  const match = relativeDate.match(/^today([+-])(\d+)$/i);
  if (!match) return null;

  const sign = match[1] === '+' ? 1 : -1;
  const days = parseInt(match[2], 10);

  if (isNaN(days)) return null;

  const date = new Date();
  date.setHours(0, 0, 0, 0); // Normalize to start of day
  date.setDate(date.getDate() + sign * days);
  return date;
}

/**
 * Calculate time window for event fetching
 *
 * @param daysToShow - Number of days to show in the calendar
 * @param startDate - Optional start date in YYYY-MM-DD format, ISO format, or relative format "today+n"
 * @returns Object containing start and end dates for the calendar window
 */
export function getTimeWindow(daysToShow: number, startDate?: string): { start: Date; end: Date } {
  let start: Date;

  // Parse custom start date if provided
  if (startDate && startDate.trim() !== '') {
    try {
      // First try to parse as relative date (today+n or today-n)
      const relativeDate = parseRelativeDate(startDate.trim());
      if (relativeDate) {
        start = relativeDate;
      }
      // Check if it's an ISO date string (which HA converts to when saving)
      else if (startDate.includes('T')) {
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

  return `${Constants.CACHE.EVENT_CACHE_KEY_PREFIX}${instanceId}_${entityIds}_${daysToShow}_${showPastEvents ? 1 : 0}${startDatePart}${filterPart}${filterListPart}${Constants.VERSION.CURRENT}`;
}

/**
 * Parse and validate cache entry
 * Helper function to ensure consistent cache validation
 *
 * @param key - Cache key
 * @param config - Card configuration
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
