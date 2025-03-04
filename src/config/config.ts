/* eslint-disable import/order */
/**
 * Configuration module for Calendar Card Pro
 *
 * Contains default configuration values and helper functions for handling configuration
 * settings and entities.
 */

import * as Types from './types';

/**
 * Default configuration for Calendar Card Pro
 */
export const DEFAULT_CONFIG: Types.Config = {
  entities: [],
  days_to_show: 3,
  max_events_to_show: undefined,
  show_past_events: false,
  refresh_interval: 30,
  language: 'en',
  time_24h: true,
  show_end_time: true,
  show_month: true,
  show_location: true,
  remove_location_country: true,
  title: '',
  background_color: 'var(--ha-card-background)',
  row_spacing: '5px',
  additional_card_spacing: '0px',
  vertical_line_width: '2px',
  vertical_line_color: '#03a9f4',
  horizontal_line_width: '0px',
  horizontal_line_color: 'var(--secondary-text-color)',
  title_font_size: '20px',
  weekday_font_size: '14px',
  day_font_size: '26px',
  month_font_size: '12px',
  event_font_size: '14px',
  time_font_size: '12px',
  location_font_size: '12px',
  time_location_icon_size: '16px',
  title_color: 'var(--primary-text-color)',
  weekday_color: 'var(--primary-text-color)',
  day_color: 'var(--primary-text-color)',
  month_color: 'var(--primary-text-color)',
  event_color: 'var(--primary-text-color)',
  time_color: 'var(--secondary-text-color)',
  location_color: 'var(--secondary-text-color)',
  tap_action: { action: 'expand' },
  hold_action: { action: 'none' },
};

/**
 * Normalizes entity configuration to ensure consistent format
 */
export function normalizeEntities(
  entities: Array<string | { entity: string; color?: string }>,
): Array<Types.EntityConfig> {
  if (!Array.isArray(entities)) {
    return [];
  }

  return entities
    .map((item) => {
      if (typeof item === 'string') {
        return {
          entity: item,
          color: 'var(--primary-text-color)',
        };
      }
      if (typeof item === 'object' && item.entity) {
        return {
          entity: item.entity,
          color: item.color || 'var(--primary-text-color)',
        };
      }
      return null;
    })
    .filter(Boolean) as Array<Types.EntityConfig>;
}

/**
 * Checks if relevant configuration properties have changed
 */
export function hasConfigChanged(previous: Partial<Types.Config>, current: Types.Config): boolean {
  if (!previous) return true;

  const relevantKeys = ['entities', 'days_to_show', 'show_past_events', 'refresh_interval'];

  return relevantKeys.some((key) => JSON.stringify(previous[key]) !== JSON.stringify(current[key]));
}

/**
 * Checks if entities configuration has changed
 */
export function hasEntitiesChanged(
  previous: Array<string | { entity: string; color?: string }>,
  current: Array<string | { entity: string; color?: string }>,
): boolean {
  if (previous.length !== current.length) return true;
  return previous.some((entity, index) => entity !== current[index]);
}

/**
 * Find a calendar entity in Home Assistant states
 */
export function findCalendarEntity(hass: Record<string, { state: string }>): string | null {
  return Object.keys(hass).find((entityId) => entityId.startsWith('calendar.')) || null;
}

/**
 * Generate a stub configuration for the card editor
 */
export function getStubConfig(hass: Record<string, { state: string }>): Record<string, unknown> {
  const calendarEntity = findCalendarEntity(hass);
  return {
    type: 'custom:calendar-card-pro-dev',
    entities: calendarEntity ? [calendarEntity] : [],
    days_to_show: 3,
    show_location: true,
    _description: !calendarEntity
      ? 'A calendar card that displays events from multiple calendars with individual styling. Add a calendar integration to Home Assistant to use this card.'
      : undefined,
  };
}
