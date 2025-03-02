/* eslint-disable import/order */
/**
 * Format utilities for Calendar Card Pro
 *
 * Provides date, time, and location formatting functions
 */

import * as Types from '../config/types';
import * as Localize from '../translations/localize';

/**
 * Format time according to 12/24 hour setting
 *
 * @param date - Date object to format
 * @param use24h - Whether to use 24-hour format
 * @returns Formatted time string
 */
export function formatTime(date: Date, use24h: boolean): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();

  if (!use24h) {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }

  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Format location string, optionally removing the country
 *
 * @param location - Location string to format
 * @param removeCountry - Whether to remove country name
 * @returns Formatted location string
 */
export function formatLocation(location: string, removeCountry = true): string {
  if (removeCountry) {
    return location.replace(/, [^,]+$/, '');
  }
  return location;
}

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
  config: Partial<Types.Config>,
  language: string,
): string {
  const startDate = new Date(event.start.dateTime || event.start.date || '');
  const endDate = new Date(event.end.dateTime || event.end.date || '');
  const isAllDayEvent = !event.start.dateTime;

  if (isAllDayEvent) {
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setDate(adjustedEndDate.getDate() - 1);

    if (startDate.toDateString() !== adjustedEndDate.toDateString()) {
      return formatMultiDayAllDayTime(adjustedEndDate, language);
    }
    return Localize.translateString(language, 'allDay');
  }

  if (startDate.toDateString() !== endDate.toDateString()) {
    return formatMultiDayTime(startDate, endDate, config, language);
  }

  return formatSingleDayTime(startDate, endDate, config);
}

/**
 * Format a multi-day all-day event
 *
 * @param endDate - End date of the event
 * @param language - Language code
 * @returns Formatted date range string
 */
export function formatMultiDayAllDayTime(endDate: Date, language: string): string {
  const endDay = endDate.getDate();
  const endMonthName = Localize.getMonthName(language, endDate.getMonth());
  const dayFormat = language === 'de' ? `${endDay}.` : endDay;

  return `${Localize.translateString(language, 'allDay')}, ${Localize.translateString(language, 'multiDay')} ${dayFormat} ${endMonthName}`;
}

/**
 * Format a multi-day event with time
 *
 * @param startDate - Start date/time of the event
 * @param endDate - End date/time of the event
 * @param config - Card configuration
 * @param language - Language code
 * @returns Formatted date/time range string
 */
export function formatMultiDayTime(
  startDate: Date,
  endDate: Date,
  config: Partial<Types.Config>,
  language: string,
): string {
  const endDay = endDate.getDate();
  const endMonthName = Localize.getMonthName(language, endDate.getMonth());
  const endWeekday = Localize.getDayName(language, endDate.getDay(), true);
  const dayFormat = language === 'de' ? `${endDay}.` : endDay;

  const startTimeStr = formatTime(startDate, Boolean(config.time_24h));
  const endTimeStr = formatTime(endDate, Boolean(config.time_24h));

  return [
    startTimeStr,
    Localize.translateString(language, 'multiDay'),
    endWeekday + ',',
    dayFormat,
    endMonthName,
    Localize.translateString(language, 'at'),
    endTimeStr,
  ].join(' ');
}

/**
 * Format a single-day event with start and optional end time
 *
 * @param startDate - Start date/time of the event
 * @param endDate - End date/time of the event
 * @param config - Card configuration
 * @returns Formatted time range string
 */
export function formatSingleDayTime(
  startDate: Date,
  endDate: Date,
  config: Partial<Types.Config>,
): string {
  const use24h = Boolean(config.time_24h);
  return config.show_end_time
    ? `${formatTime(startDate, use24h)} - ${formatTime(endDate, use24h)}`
    : formatTime(startDate, use24h);
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
