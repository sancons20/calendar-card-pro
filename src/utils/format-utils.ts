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
 * Handles all-day events, multi-day events, and time formats
 *
 * @param event Calendar event object
 * @param config Configuration object
 * @param language Language code for translations
 * @returns Formatted time string
 */
export function formatEventTime(
  event: Types.CalendarEventData,
  config: Types.Config,
  language: string = 'en',
): string {
  const startDate = new Date(event.start.dateTime || event.start.date || '');
  const endDate = new Date(event.end.dateTime || event.end.date || '');
  const translations = Localize.getTranslations(language);
  const isAllDayEvent = !event.start.dateTime;

  if (isAllDayEvent) {
    const adjustedEndDate = new Date(endDate);
    // For all-day events, the end date is exclusive in iCal format
    adjustedEndDate.setDate(adjustedEndDate.getDate() - 1);

    // Check if it's a multi-day event
    if (startDate.toDateString() !== adjustedEndDate.toDateString()) {
      return formatMultiDayAllDayTime(adjustedEndDate, language, translations);
    }

    // Single day all-day event
    return translations.allDay;
  }

  // Handle multi-day events with start/end times
  if (startDate.toDateString() !== endDate.toDateString()) {
    return formatMultiDayTime(startDate, endDate, language, translations);
  }

  // Single day event with start/end times
  return formatSingleDayTime(startDate, endDate, config.show_end_time, config.time_24h);
}

/**
 * Format multi-day all-day event time
 *
 * @param endDate End date of the event
 * @param language Language code for translations
 * @param translations Translations object
 * @returns Formatted time string
 */
function formatMultiDayAllDayTime(
  endDate: Date,
  language: string,
  translations: Types.Translations,
): string {
  const endDay = endDate.getDate();
  const endMonthName = translations.months[endDate.getMonth()];

  // Format day differently based on language
  const dayFormat = language === 'de' ? `${endDay}.` : endDay;

  return `${translations.allDay}, ${translations.multiDay} ${dayFormat} ${endMonthName}`;
}

/**
 * Format multi-day event time with start/end times
 *
 * @param startDate Start date of the event
 * @param endDate End date of the event
 * @param language Language code for translations
 * @param translations Translations object
 * @returns Formatted time string
 */
function formatMultiDayTime(
  startDate: Date,
  endDate: Date,
  language: string,
  translations: Types.Translations,
): string {
  const endDay = endDate.getDate();
  const endMonthName = translations.months[endDate.getMonth()];
  const endWeekday = translations.fullDaysOfWeek[endDate.getDay()];

  // Format day differently based on language
  const dayFormat = language === 'de' ? `${endDay}.` : endDay;

  const startTimeStr = formatTime(startDate, true);
  const endTimeStr = formatTime(endDate, true);

  return [
    startTimeStr,
    translations.multiDay,
    endWeekday + ',',
    dayFormat,
    endMonthName,
    translations.at,
    endTimeStr,
  ].join(' ');
}

/**
 * Format single day event time with start/end times
 *
 * @param startDate Start date of the event
 * @param endDate End date of the event
 * @param showEndTime Whether to show end time
 * @param time24h Whether to use 24-hour format
 * @returns Formatted time string
 */
function formatSingleDayTime(
  startDate: Date,
  endDate: Date,
  showEndTime: boolean,
  time24h: boolean,
): string {
  return showEndTime
    ? `${formatTime(startDate, time24h)} - ${formatTime(endDate, time24h)}`
    : formatTime(startDate, time24h);
}

/**
 * Format time according to 12/24 hour setting
 *
 * @param date Date object to format
 * @param use24h Whether to use 24-hour format
 * @returns Formatted time string
 */
export function formatTime(date: Date, use24h = true): string {
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
 * Format location string by removing country names if configured
 *
 * @param location Raw location string from calendar event
 * @param removeCountry Whether to remove country from location
 * @returns Formatted location string
 */
export function formatLocation(location: string, removeCountry = true): string {
  if (!location || !removeCountry) return location || '';

  const locationText = location.trim();

  // Get country names (this would be better from a proper static source)
  // For now using a simplified approach
  const countryNames = new Set([
    'Germany',
    'Deutschland',
    'United States',
    'USA',
    'United States of America',
    'United Kingdom',
    'Great Britain',
    'France',
    'Italy',
    'Italia',
    'Spain',
    'España',
    'Netherlands',
    'Nederland',
    'Austria',
    'Österreich',
    'Switzerland',
    'Schweiz',
  ]);

  // Handle comma-separated format (e.g., "City, Country")
  const parts = locationText.split(',').map((part) => part.trim());
  if (parts.length > 0 && countryNames.has(parts[parts.length - 1])) {
    parts.pop();
    return parts.join(', ');
  }

  // Handle space-separated format (e.g., "City Country")
  const words = locationText.split(/\s+/);
  if (words.length > 0 && countryNames.has(words[words.length - 1])) {
    words.pop();
    return words.join(' ');
  }

  return locationText;
}

// Additional location formatting helpers can be added here
