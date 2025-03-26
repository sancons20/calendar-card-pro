/* eslint-disable import/order */
/**
 * Rendering module for Calendar Card Pro
 *
 * Contains pure functions for rendering the calendar card's UI components.
 * These functions generate Lit TemplateResult objects that can be used
 * within the main component's render method.
 */

import { TemplateResult, html, nothing } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { repeat } from 'lit/directives/repeat.js';
import * as Constants from '../config/constants';
import * as Types from '../config/types';
import * as Localize from '../translations/localize';
import * as FormatUtils from '../utils/format';
import * as EventUtils from '../utils/events';

//-----------------------------------------------------------------------------
// MAIN CARD STRUCTURE RENDERING
//-----------------------------------------------------------------------------

/**
 * Render the main calendar card structure
 * Creates a stable DOM structure for card-mod compatibility
 *
 * @param customStyles Custom style properties from configuration
 * @param title Card title from configuration
 * @param content Main card content (events or status)
 * @param handlers Event handler functions
 * @param maxHeightSet Flag to add max-height-set class
 * @returns TemplateResult for the complete card
 */
export function renderMainCardStructure(
  customStyles: Record<string, string>,
  title: string | undefined,
  content: TemplateResult,
  handlers: {
    keyDown: (ev: KeyboardEvent) => void;
    pointerDown: (ev: PointerEvent) => void;
    pointerUp: (ev: PointerEvent) => void;
    pointerCancel: (ev: Event) => void;
    pointerLeave: (ev: Event) => void;
  },
  maxHeightSet: boolean = false,
): TemplateResult {
  return html`
    <ha-card
      class="calendar-card-pro ${maxHeightSet ? 'max-height-set' : ''}"
      style=${styleMap(customStyles)}
      tabindex="0"
      @keydown=${handlers.keyDown}
      @pointerdown=${handlers.pointerDown}
      @pointerup=${handlers.pointerUp}
      @pointercancel=${handlers.pointerCancel}
      @pointerleave=${handlers.pointerLeave}
    >
      <ha-ripple></ha-ripple>

      <!-- Title is always rendered with the same structure, even if empty -->
      <div class="header-container">
        ${title
          ? html`<h1 class="card-header">${title}</h1>`
          : html`<div class="card-header-placeholder"></div>`}
      </div>

      <!-- Content container is always present -->
      <div class="content-container">${content}</div>
    </ha-card>
  `;
}

/**
 * Render card content based on state
 *
 * @param state Card state (loading, error)renderWeekRow
 * @param language Language code for translations
 * @returns Template result for card content
 */
export function renderCardContent(state: 'loading' | 'error', language: string): TemplateResult {
  const translations = Localize.getTranslations(language);

  if (state === 'loading') {
    return html`
      <div class="calendar-card">
        <div class="loading">${translations.loading}</div>
      </div>
    `;
  }

  return html`
    <div class="calendar-card">
      <div class="error">${translations.error}</div>
    </div>
  `;
}

//-----------------------------------------------------------------------------
// SEPARATOR RENDERING HELPERS
//-----------------------------------------------------------------------------

/**
 * Create consistent separator styles for any type of horizontal separator
 * Properly calculates margins based on day_spacing to ensure vertical centering
 * with appropriate multipliers for different separator types
 *
 * @param lineWidth - Border width for the separator
 * @param lineColor - Border color for the separator
 * @param config - Card configuration for spacing values
 * @param separatorType - Type of separator (day, week, or month)
 * @returns Style object for use with styleMap
 */
function createSeparatorStyle(
  lineWidth: string,
  lineColor: string,
  config: Types.Config,
  separatorType: 'day' | 'week' | 'month' = 'day',
): Record<string, string> {
  // Base spacing from configuration
  const baseSpacing = parseFloat(config.day_spacing);

  // Special handling for day separators to balance margins
  if (separatorType === 'day') {
    // For day separators, we want equal spacing above and below
    return {
      borderTopWidth: lineWidth,
      borderTopColor: lineColor,
      borderTopStyle: 'solid',
      marginTop: '0px', // No additional margin needed on top (table already has margin)
      marginBottom: `${baseSpacing}px`, // Equal spacing below
    };
  }

  // For week and month separators, determine the appropriate multiplier
  let multiplier = Constants.UI.SEPARATOR_SPACING.WEEK; // Default to week multiplier
  if (separatorType === 'month') {
    multiplier = Constants.UI.SEPARATOR_SPACING.MONTH;
  }

  // Calculate the desired total spacing between elements (finalSpacing)
  const finalSpacing = baseSpacing * multiplier;

  return {
    borderTopWidth: lineWidth,
    borderTopColor: lineColor,
    borderTopStyle: 'solid',
    marginTop: `${finalSpacing}px`,
    marginBottom: `${finalSpacing}px`,
  };
}

/**
 * Render a horizontal separator line with consistent styling
 *
 * @param lineWidth - Width of the separator line
 * @param lineColor - Color of the separator line
 * @param className - CSS class to apply (week-separator or month-separator)
 * @param config - Card configuration
 * @param isFirstWeek - Whether this is the first week in the view
 * @returns TemplateResult or nothing
 */
function renderHorizontalSeparator(
  lineWidth: string,
  lineColor: string,
  className: string,
  config: Types.Config,
  isFirstWeek: boolean = false,
  separatorType: 'day' | 'week' | 'month' = 'day',
): TemplateResult | typeof nothing {
  // Don't render for zero width or first week
  if (lineWidth === '0px' || isFirstWeek) {
    return nothing;
  }

  const separatorStyle = createSeparatorStyle(lineWidth, lineColor, config, separatorType);

  return html`<div class="${className}" style=${styleMap(separatorStyle)}></div>`;
}

/**
 * Render a month separator line
 *
 * @param config - Card configuration
 * @returns TemplateResult or nothing
 */
function renderMonthSeparator(config: Types.Config): TemplateResult | typeof nothing {
  return renderHorizontalSeparator(
    config.month_separator_width,
    config.month_separator_color,
    'month-separator',
    config,
    false,
    'month',
  );
}

/**
 * Render a full-width week separator line (when show_week_numbers is null)
 *
 * @param config - Card configuration
 * @param isFirstWeek - Whether this is the first week in the view
 * @returns TemplateResult or nothing
 */
function renderWeekSeparator(
  config: Types.Config,
  isFirstWeek: boolean = false,
): TemplateResult | typeof nothing {
  return renderHorizontalSeparator(
    config.week_separator_width,
    config.week_separator_color,
    'week-separator',
    config,
    isFirstWeek,
    'week',
  );
}

/**
 * Render a week row with a week number pill and a separator line
 * Uses table structure to align perfectly with day tables
 *
 * @param weekNumber - Week number to display
 * @param isMonthBoundary - Whether this is also a month boundary
 * @param config - Card configuration
 * @param isFirstWeek - Whether this is the first week in the view
 * @returns TemplateResult or nothing
 */
function renderWeekRow(
  weekNumber: number | null,
  isMonthBoundary: boolean,
  config: Types.Config,
  isFirstWeek: boolean = false,
): TemplateResult | typeof nothing {
  if (weekNumber === null) {
    return nothing;
  }

  // Use the appropriate multiplier for week separator spacing
  const baseSpacing = parseFloat(config.day_spacing);
  const multiplier = isMonthBoundary
    ? Constants.UI.SEPARATOR_SPACING.MONTH
    : Constants.UI.SEPARATOR_SPACING.WEEK;
  const finalSpacing = (baseSpacing * multiplier) / 2;
  const marginTop = finalSpacing - baseSpacing;

  const rowStyle = {
    marginTop: `${marginTop}px`, // Adjusted margin that accounts for existing table margin
    marginBottom: `${finalSpacing}px`, // Half of the desired spacing below
  };

  // Modified line style generation
  const lineStyle: Record<string, string> = {};

  if (!isFirstWeek) {
    if (isMonthBoundary && config.month_separator_width !== '0px') {
      lineStyle['--separator-border-width'] = config.month_separator_width;
      lineStyle['--separator-border-color'] = config.month_separator_color;
      lineStyle['--separator-display'] = 'block';
    } else if (config.week_separator_width !== '0px') {
      lineStyle['--separator-border-width'] = config.week_separator_width;
      lineStyle['--separator-border-color'] = config.week_separator_color;
      lineStyle['--separator-display'] = 'block';
    } else {
      lineStyle['--separator-display'] = 'none';
    }
  } else {
    lineStyle['--separator-display'] = 'none';
  }

  return html`
    <table class="week-row-table" style=${styleMap(rowStyle)}>
      <tr>
        <td class="week-number-cell">
          <div class="week-number">${weekNumber}</div>
        </td>
        <td class="separator-cell" style=${styleMap(lineStyle)}>
          <div class="separator-line"></div>
        </td>
      </tr>
    </table>
  `;
}

//-----------------------------------------------------------------------------
// CONTENT GENERATION FUNCTIONS
//-----------------------------------------------------------------------------

/**
 * Render a single day with its events
 *
 * @param day - Day data containing events
 * @param config - Card configuration
 * @param language - Language code for translations
 * @param prevDay - Previous day data for determining separators
 * @param boundaryInfo - Information about week and month boundaries
 * @returns TemplateResult for the day
 */
export function renderDay(
  day: Types.EventsByDay,
  config: Types.Config,
  language: string,
  prevDay?: Types.EventsByDay,
  boundaryInfo?: { isNewWeek: boolean; isNewMonth: boolean },
): TemplateResult {
  // Check if this day is today
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayDate = new Date(day.timestamp);
  const isToday = dayDate.toDateString() === todayStart.toDateString();

  // Separator precedence hierarchy (highest to lowest):
  // 1. Month boundaries (with month separator enabled)
  // 2. Week boundaries (with week separator or week numbers enabled)
  // 3. Regular day boundaries (with regular horizontal line enabled)
  // Only render the highest precedence separator that applies

  let daySeparator: TemplateResult | typeof nothing = nothing;

  // Only add a regular horizontal line separator between days IF:
  // 1. This is not the first day displayed (prevDay exists)
  // 2. This is not a month boundary with month separators enabled
  // 3. This is not a week boundary with week separators or week numbers enabled
  // 4. Horizontal line width is not zero
  const isMonthBoundary = boundaryInfo?.isNewMonth || false;
  const isWeekBoundary = boundaryInfo?.isNewWeek || false;
  const hasMonthSeparator = isMonthBoundary && config.month_separator_width !== '0px';
  const hasWeekSeparator =
    isWeekBoundary && (config.show_week_numbers !== null || config.week_separator_width !== '0px');

  // Use day_separator_width with fallback to horizontal_line_width
  const daySeparatorWidth = config.day_separator_width || config.horizontal_line_width;
  const daySeparatorColor = config.day_separator_color || config.horizontal_line_color;

  if (prevDay && daySeparatorWidth !== '0px' && !hasMonthSeparator && !hasWeekSeparator) {
    const separatorStyle = createSeparatorStyle(
      daySeparatorWidth,
      daySeparatorColor,
      config,
      'day',
    );

    daySeparator = html`<div class="separator" style=${styleMap(separatorStyle)}></div>`;
  }

  return html`
    ${daySeparator}
    <table class="day-table ${isToday ? 'today' : 'future-day'}">
      ${repeat(
        day.events,
        (event, index) => `${event._entityId}-${event.summary}-${index}`,
        (event, index) => renderEvent(event, day, index, config, language),
      )}
    </table>
  `;
}

/**
 * Render grouped events with week and month separators
 * Uses a precedence system for different separator types
 */
export function renderGroupedEvents(
  days: Types.EventsByDay[],
  config: Types.Config,
  language: string,
): TemplateResult {
  // Get the configured first day of week
  const firstDayOfWeek = FormatUtils.getFirstDayOfWeek(config.first_day_of_week, language);

  return html`
    ${days.map((day, index) => {
      const prevDay = index > 0 ? days[index - 1] : undefined;
      const weekNumber = day.weekNumber ?? null;

      // Enhanced week boundary detection - compare week numbers instead of just day of week
      let isNewWeek = false;

      if (!prevDay) {
        // First day is always a new week
        isNewWeek = true;
      } else {
        // Compare week numbers to detect week boundaries
        // This works even when days are missing (show_empty_days: false)
        const currentWeekNumber = day.weekNumber;
        const prevWeekNumber = prevDay.weekNumber;

        // Week boundary if week numbers differ
        isNewWeek = currentWeekNumber !== prevWeekNumber;

        // As a fallback, still check the day of week
        // This ensures we don't miss a week boundary if week numbers are null
        if (!isNewWeek && currentWeekNumber === null) {
          const dayDate = new Date(day.timestamp);
          isNewWeek = dayDate.getDay() === firstDayOfWeek;
        }
      }

      const isNewMonth = prevDay && day.monthNumber !== prevDay.monthNumber;
      const isFirstWeek = index === 0;

      // Pass boundary information to renderDay
      const boundaryInfo = {
        isNewWeek,
        isNewMonth: Boolean(isNewMonth),
      };

      // Determine which separator to show based on precedence rules
      let separator: TemplateResult | typeof nothing = nothing;

      // Apply precedence: Month separator > Week separator
      if (isNewMonth && (!isNewWeek || config.show_week_numbers === null)) {
        // Month boundaries without week change get month separator
        separator = renderMonthSeparator(config);
      } else if (isNewWeek) {
        // Check for first week + config setting
        if (isFirstWeek && config.show_week_numbers !== null && !config.show_current_week_number) {
          // Skip week number pill for first week if setting disabled, but keep month/week separators if needed
          separator = isNewMonth
            ? renderMonthSeparator(config)
            : renderWeekSeparator(config, isFirstWeek);
        } else {
          // Normal rendering logic - week boundaries get either week number pill or week separator
          separator =
            config.show_week_numbers !== null
              ? renderWeekRow(weekNumber, Boolean(isNewMonth), config, isFirstWeek)
              : renderWeekSeparator(config, isFirstWeek);
        }
      }

      return html` ${separator} ${renderDay(day, config, language, prevDay, boundaryInfo)} `;
    })}
  `;
}

/**
 * Render a single event
 *
 * @param event - Event data to render
 * @param day - Day that contains this event
 * @param index - Event index within the day
 * @param config - Card configuration
 * @param language - Language code for translations
 * @returns TemplateResult for the event
 */
export function renderEvent(
  event: Types.CalendarEventData,
  day: Types.EventsByDay,
  index: number,
  config: Types.Config,
  language: string,
): TemplateResult {
  // Add CSS class for empty days
  const isEmptyDay = Boolean(event._isEmptyDay);

  // Check if this is a past event (already ended)
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let isPastEvent = false;

  if (!isEmptyDay) {
    const isAllDayEvent = !event.start.dateTime;

    if (isAllDayEvent) {
      // All-day events should NOT be marked as past when they:
      // 1. Occur today (single-day) OR
      // 2. End today (multi-day) OR
      // 3. Span across today (multi-day)

      // Get end date
      let endDate = event.end.date ? FormatUtils.parseAllDayDate(event.end.date) : null;

      // Adjust for iCal all-day end date convention (exclusive end date)
      if (endDate) {
        const adjustedEndDate = new Date(endDate);
        adjustedEndDate.setDate(adjustedEndDate.getDate() - 1);
        endDate = adjustedEndDate;
      }

      // All-day events are only "past" if today is completely after their end date
      // If today is the end date or earlier, the event should NOT be greyed out
      isPastEvent = endDate !== null && today > endDate;
    } else {
      // Regular event with time - use end time to determine if it's past
      const endDateTime = event.end.dateTime ? new Date(event.end.dateTime) : null;
      isPastEvent = endDateTime !== null && now > endDateTime;
    }
  }

  // Get colors from config based on entity ID
  const entityColor = EventUtils.getEntityColor(event._entityId, config);

  // Get line color (solid) and background color (with opacity)
  const entityAccentColor = EventUtils.getEntityAccentColorWithOpacity(event._entityId, config);

  // Explicitly check if event_background_opacity is defined and greater than 0
  const backgroundOpacity =
    config.event_background_opacity > 0 ? config.event_background_opacity : 0;
  const entityAccentBackgroundColor =
    backgroundOpacity > 0
      ? EventUtils.getEntityAccentColorWithOpacity(event._entityId, config, backgroundOpacity)
      : ''; // Empty string for no background

  // Get entity-specific settings with fallback to global settings
  const showTime =
    EventUtils.getEntitySetting(event._entityId, 'show_time', config) ?? config.show_time;
  const showLocation =
    EventUtils.getEntitySetting(event._entityId, 'show_location', config) ?? config.show_location;

  // Check if this is an all-day event
  const isAllDayEvent = !event.start.dateTime;

  // Check if this is a multi-day all-day event
  const isMultiDayAllDayEvent =
    isAllDayEvent &&
    event.time &&
    (event.time.includes(Localize.getTranslations(language).multiDay) ||
      event.time.includes(Localize.getTranslations(language).endsTomorrow) ||
      event.time.includes(Localize.getTranslations(language).endsToday));

  // Determine if we should show time for this specific event
  // Hide if:
  // 1. showTime is false (global setting or entity override) OR
  // 2. It's a SINGLE-DAY all-day event AND show_single_allday_time is false OR
  // 3. It's an empty day placeholder
  const shouldShowTime =
    showTime &&
    !(isAllDayEvent && !isMultiDayAllDayEvent && !config.show_single_allday_time) &&
    !isEmptyDay;

  // Format event time and location
  const eventTime = FormatUtils.formatEventTime(event, config, language);
  const eventLocation =
    event.location && showLocation
      ? FormatUtils.formatLocation(event.location, config.remove_location_country)
      : '';

  // Determine event position for styling
  const isFirst = index === 0;
  const isLast = index === day.events.length - 1;
  const isMiddle = !isFirst && !isLast;

  // Create class map with position classes
  const eventClasses = {
    event: true,
    'event-first': isFirst,
    'event-middle': isMiddle,
    'event-last': isLast,
    'past-event': isPastEvent,
  };

  return html`
    <tr>
      ${index === 0
        ? html`
            <td class="date-column" rowspan="${day.events.length}">
              <div class="date-content">
                <div class="weekday">${day.weekday}</div>
                <div class="day">${day.day}</div>
                ${config.show_month ? html`<div class="month">${day.month}</div>` : ''}
              </div>
            </td>
          `
        : ''}
      <td
        class=${classMap(eventClasses)}
        style="border-left: var(--calendar-card-line-width-vertical) solid ${entityAccentColor}; background-color: ${entityAccentBackgroundColor};"
      >
        <div class="event-content">
          <div
            class="event-title ${isEmptyDay ? 'empty-day-title' : ''}"
            style="color: ${entityColor}"
          >
            ${event._entityLabel
              ? html`<span class="calendar-label">${event._entityLabel}</span> `
              : ''}${isEmptyDay ? `✓ ${event.summary}` : event.summary}
          </div>
          <div class="time-location">
            ${shouldShowTime
              ? html`
                  <div class="time">
                    <ha-icon icon="mdi:clock-outline"></ha-icon>
                    <span>${eventTime}</span>
                  </div>
                `
              : ''}
            ${eventLocation
              ? html`
                  <div class="location">
                    <ha-icon icon="mdi:map-marker"></ha-icon>
                    <span>${eventLocation}</span>
                  </div>
                `
              : ''}
          </div>
        </div>
      </td>
    </tr>
  `;
}
