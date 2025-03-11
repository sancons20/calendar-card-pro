/* eslint-disable import/order */
/**
 * Configuration module for Calendar Card Pro
 */

import * as Constants from './constants';
import * as Types from './types';
import * as Logger from '../utils/logger-utils';

/**
 * Default configuration for Calendar Card Pro
 */
export const DEFAULT_CONFIG: Types.Config = {
  // Core settings
  entities: [],
  days_to_show: Constants.DEFAULTS.DAYS_TO_SHOW,
  max_events_to_show: Constants.DEFAULTS.MAX_EVENTS_TO_SHOW,
  show_past_events: Constants.DEFAULTS.SHOW_PAST_EVENTS,
  language: Constants.DEFAULTS.LANGUAGE,

  // Display settings
  time_24h: Constants.DISPLAY.TIME_24H,
  show_end_time: Constants.DISPLAY.SHOW_END_TIME,
  show_month: Constants.DISPLAY.SHOW_MONTH,
  show_location: Constants.DISPLAY.SHOW_LOCATION,
  remove_location_country: Constants.DISPLAY.REMOVE_LOCATION_COUNTRY,
  title: Constants.DISPLAY.TITLE,

  // Layout and spacing
  background_color: Constants.LAYOUT.BACKGROUND_COLOR,
  row_spacing: Constants.LAYOUT.ROW_SPACING,
  additional_card_spacing: Constants.LAYOUT.ADDITIONAL_CARD_SPACING,
  vertical_line_width: Constants.LAYOUT.VERTICAL_LINE_WIDTH,
  vertical_line_color: Constants.LAYOUT.VERTICAL_LINE_COLOR,
  horizontal_line_width: Constants.LAYOUT.HORIZONTAL_LINE_WIDTH,
  horizontal_line_color: Constants.LAYOUT.HORIZONTAL_LINE_COLOR,

  // Font sizes
  title_font_size: Constants.FONTS.TITLE_FONT_SIZE,
  weekday_font_size: Constants.FONTS.WEEKDAY_FONT_SIZE,
  day_font_size: Constants.FONTS.DAY_FONT_SIZE,
  month_font_size: Constants.FONTS.MONTH_FONT_SIZE,
  event_font_size: Constants.FONTS.EVENT_FONT_SIZE,
  time_font_size: Constants.FONTS.TIME_FONT_SIZE,
  location_font_size: Constants.FONTS.LOCATION_FONT_SIZE,
  time_location_icon_size: Constants.FONTS.TIME_LOCATION_ICON_SIZE,

  // Colors
  title_color: Constants.COLORS.TITLE_COLOR,
  weekday_color: Constants.COLORS.WEEKDAY_COLOR,
  day_color: Constants.COLORS.DAY_COLOR,
  month_color: Constants.COLORS.MONTH_COLOR,
  event_color: Constants.COLORS.EVENT_COLOR,
  time_color: Constants.COLORS.TIME_COLOR,
  location_color: Constants.COLORS.LOCATION_COLOR,

  // Actions
  tap_action: Constants.ACTIONS.DEFAULT_TAP_ACTION,
  hold_action: Constants.ACTIONS.DEFAULT_HOLD_ACTION,

  // Cache and refresh settings
  refresh_interval: Constants.CACHE.DEFAULT_DATA_REFRESH_MINUTES,
  cache_duration: Constants.CACHE.DEFAULT_CACHE_LIFETIME_MINUTES,
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
          color: Constants.COLORS.PRIMARY_TEXT,
        };
      }
      if (typeof item === 'object' && item.entity) {
        return {
          entity: item.entity,
          color: item.color || Constants.COLORS.PRIMARY_TEXT,
        };
      }
      return null;
    })
    .filter(Boolean) as Array<Types.EntityConfig>;
}

/**
 * Determine if configuration changes affect data retrieval
 */
export function hasConfigChanged(
  previous: Partial<Types.Config> | undefined,
  current: Types.Config,
): boolean {
  // Handle empty/undefined config
  if (!previous || Object.keys(previous).length === 0) {
    return true;
  }

  // Extract entity IDs without colors for comparison - entity colors are styling only
  // and don't require API data refresh
  const previousEntityIds = (previous.entities || [])
    .map((e) => (typeof e === 'string' ? e : e.entity))
    .sort()
    .join(',');

  const currentEntityIds = (current.entities || [])
    .map((e) => (typeof e === 'string' ? e : e.entity))
    .sort()
    .join(',');

  // Check refresh interval separately (it affects timers but not data)
  const refreshIntervalChanged = previous?.refresh_interval !== current?.refresh_interval;

  // Check if core data-affecting properties changed
  const dataChanged =
    previousEntityIds !== currentEntityIds ||
    previous.days_to_show !== current.days_to_show ||
    previous.show_past_events !== current.show_past_events ||
    previous.cache_duration !== current.cache_duration;

  if (dataChanged || refreshIntervalChanged) {
    Logger.debug('Configuration change requires data refresh');
  }

  return dataChanged || refreshIntervalChanged;
}

/**
 * Check if entity colors have changed in the configuration
 * This is used to determine if a re-render (but not data refresh) is needed
 *
 * @param previous - Previous configuration
 * @param current - New configuration
 * @returns True if entity colors have changed
 */
export function haveEntityColorsChanged(
  previous: Partial<Types.Config> | undefined,
  current: Types.Config,
): boolean {
  if (!previous || !previous.entities) return false;

  const prevEntities = previous.entities;
  const currEntities = current.entities;

  // If entity count changed, let other functions handle it
  if (prevEntities.length !== currEntities.length) return false;

  // Create a map of entity IDs to colors for previous config
  const prevColorMap = new Map<string, string>();
  prevEntities.forEach((entity) => {
    if (typeof entity === 'string') {
      prevColorMap.set(entity, Constants.COLORS.PRIMARY_TEXT);
    } else {
      prevColorMap.set(entity.entity, entity.color || Constants.COLORS.PRIMARY_TEXT);
    }
  });

  // Check if any entity colors changed in current config
  for (const entity of currEntities) {
    const entityId = typeof entity === 'string' ? entity : entity.entity;
    const color =
      typeof entity === 'string'
        ? Constants.COLORS.PRIMARY_TEXT
        : entity.color || Constants.COLORS.PRIMARY_TEXT;

    if (!prevColorMap.has(entityId)) {
      // New entity, let other functions handle it
      continue;
    }

    // If color changed for an existing entity, return true
    if (prevColorMap.get(entityId) !== color) {
      Logger.debug(`Entity color changed for ${entityId}, will re-render`);
      return true;
    }
  }

  return false;
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
    days_to_show: Constants.DEFAULTS.DAYS_TO_SHOW,
    show_location: Constants.DISPLAY.SHOW_LOCATION,
    _description: !calendarEntity
      ? 'A calendar card that displays events from multiple calendars with individual styling. Add a calendar integration to Home Assistant to use this card.'
      : undefined,
  };
}
