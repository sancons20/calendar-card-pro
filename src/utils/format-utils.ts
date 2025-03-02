/* eslint-disable import/order */
/**
 * Formatting utilities for Calendar Card Pro
 *
 * Handles formatting of dates, times, and locations for display.
 */

import * as Types from '../config/types';
import * as Localize from '../translations/localize';

/**
 * Format event time based on event type and configuration
 *
 * @param event - Calendar event data
 * @param config - Card configuration
 * @param language - Language code
 * @returns Formatted time string
 */
export function formatEventTime(
  event: Types.CalendarEventData,
  config: Types.Config,
  language: string,
): string {
  // Create Date objects
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

  if (!startDate || !endDate) {
    return '';
  }

  // Check for all-day event (no time portion)
  const isAllDay = !event.start.dateTime;

  // Multi-day events
  const isMultiDay =
    startDate.getDate() !== endDate.getDate() ||
    startDate.getMonth() !== endDate.getMonth() ||
    startDate.getFullYear() !== endDate.getFullYear();

  if (isMultiDay) {
    if (isAllDay) {
      return formatMultiDayAllDayTime(endDate, language);
    }
    return formatMultiDayTime(startDate, endDate, config, language);
  }

  // Single-day events
  if (isAllDay) {
    return Localize.translateString(language, 'allDay');
  }

  return formatSingleDayTime(startDate, endDate, config);
}

/**
 * Format a standard time (hours:minutes)
 *
 * @param date - Date object
 * @param use24h - Whether to use 24-hour format
 * @returns Formatted time string
 */
export function formatTime(date: Date, use24h = true): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();

  // 24-hour format
  if (use24h) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // 12-hour format
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format multi-day all-day event time
 *
 * @param endDate - End date
 * @param language - Language code
 * @returns Formatted time string
 */
export function formatMultiDayAllDayTime(endDate: Date, language: string): string {
  // End date is exclusive for all-day events, so subtract a day
  const adjustedEndDate = new Date(endDate);
  adjustedEndDate.setDate(adjustedEndDate.getDate() - 1);

  // Create human-readable date
  const month = Localize.getMonthName(language, adjustedEndDate.getMonth());
  const day = adjustedEndDate.getDate();

  return `${Localize.translateString(language, 'multiDay')} ${month} ${day}`;
}

/**
 * Format multi-day event time with start and end
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @param config - Card configuration
 * @param language - Language code
 * @returns Formatted time string
 */
export function formatMultiDayTime(
  startDate: Date,
  endDate: Date,
  config: Types.Config,
  language: string,
): string {
  const formattedStartTime = formatTime(startDate, config.time_24h);
  const month = Localize.getMonthName(language, endDate.getMonth());
  const day = endDate.getDate();

  if (!config.show_end_time) {
    return formattedStartTime;
  }

  const formattedEndTime = formatTime(endDate, config.time_24h);
  return `${formattedStartTime} ${Localize.translateString(
    language,
    'multiDay',
  )} ${month} ${day}, ${formattedEndTime}`;
}

/**
 * Format single-day event time with start and possibly end
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @param config - Card configuration
 * @returns Formatted time string
 */
export function formatSingleDayTime(startDate: Date, endDate: Date, config: Types.Config): string {
  if (!config.show_end_time) {
    return formatTime(startDate, config.time_24h);
  }

  // For events with same start and end time, just show the start time
  if (startDate.getTime() === endDate.getTime()) {
    return formatTime(startDate, config.time_24h);
  }

  // Otherwise show both start and end time
  return `${formatTime(startDate, config.time_24h)} - ${formatTime(endDate, config.time_24h)}`;
}

/**
 * Format location string with optional country removal
 *
 * @param location - Location string
 * @param removeCountry - Whether to remove country part
 * @returns Formatted location string
 */
export function formatLocation(location: string, removeCountry: boolean): string {
  if (!location || !removeCountry) {
    return location || '';
  }

  // Try to remove the country (typically after the last comma)
  const lastCommaIndex = location.lastIndexOf(',');
  if (lastCommaIndex >= 0) {
    // Check if there's text after the last comma
    const afterComma = location.substring(lastCommaIndex + 1).trim();

    // If the text after the comma looks like a country (2+ chars, all uppercase),
    // or if it contains something that looks like a country code (2-3 letters),
    // remove it
    if (
      afterComma.length >= 2 &&
      (afterComma === afterComma.toUpperCase() || /^[A-Z]{2,3}$/.test(afterComma.trim()))
    ) {
      return location.substring(0, lastCommaIndex).trim();
    }
  }

  return location;
}

/**
 * Format a date range for display
 *
 * @param startDate - Start date of the range
 * @param endDate - End date of the range
 * @param language - Language code
 * @returns Formatted date range
 */
export function formatDateRange(startDate: Date, endDate: Date, language: string): string {
  const startDay = startDate.getDate();
  const startMonth = Localize.getMonthName(language, startDate.getMonth());

  const endDay = endDate.getDate();
  const endMonth = Localize.getMonthName(language, endDate.getMonth());

  if (startDate.getMonth() === endDate.getMonth()) {
    // Same month
    return `${startDay}-${endDay} ${endMonth}`;
  }

  // Different months
  return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
}

/**
 * Check if two dates are on the same day
 *
 * @param date1 - First date to compare
 * @param date2 - Second date to compare
 * @returns True if both dates are on the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
