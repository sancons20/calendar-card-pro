/* eslint-disable import/order */
/**
 * Styles module for Calendar Card Pro
 */

import type * as Types from '../config/types';

/**
 * Generate CSS custom properties based on card configuration
 */
export function generateCustomProperties(config: Types.Config): string {
  return `
    --calendar-card-background-color: ${config.background_color};
    --calendar-card-font-size-title: ${config.title_font_size};
    --calendar-card-font-size-weekday: ${config.weekday_font_size};
    --calendar-card-font-size-day: ${config.day_font_size};
    --calendar-card-font-size-month: ${config.month_font_size};
    --calendar-card-font-size-event: ${config.event_font_size};
    --calendar-card-font-size-time: ${config.time_font_size};
    --calendar-card-font-size-location: ${config.location_font_size};
    --calendar-card-color-title: ${config.title_color};
    --calendar-card-color-weekday: ${config.weekday_color};
    --calendar-card-color-day: ${config.day_color};
    --calendar-card-color-month: ${config.month_color};
    --calendar-card-color-event: ${config.event_color};
    --calendar-card-color-time: ${config.time_color};
    --calendar-card-color-location: ${config.location_color};
    --calendar-card-line-color-vertical: ${config.vertical_line_color};
    --calendar-card-line-color-horizontal: ${config.horizontal_line_color};
    --calendar-card-line-width-vertical: ${config.vertical_line_width};
    --calendar-card-line-width-horizontal: ${config.horizontal_line_width};
    --calendar-card-spacing-row: ${config.row_spacing};
    --calendar-card-spacing-additional: ${config.additional_card_spacing};
    --calendar-card-icon-size-time: ${config.time_icon_size || '14px'};
    --calendar-card-icon-size-location: ${config.location_icon_size || '14px'};
    --calendar-card-date-column-width: ${parseFloat(config.day_font_size) * 1.75}px;
    --calendar-card-event-border-radius: calc(var(--ha-card-border-radius, 10px) / 2);
    --ha-ripple-hover-opacity: 0.04;
    --ha-ripple-hover-color: ${config.vertical_line_color};
    --ha-ripple-pressed-opacity: 0.12;
    --ha-ripple-pressed-color: ${config.vertical_line_color};
  `;
}

/**
 * Get base styles for the card component
 */
export function getBaseCardStyles() {
  return `
    :host {
      display: block;
    }

    ha-card {
      background: var(--calendar-card-background-color, var(--ha-card-background), #000);
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
      cursor: pointer;
      padding-top: var(--calendar-card-spacing-additional);
      padding-bottom: var(--calendar-card-spacing-additional);
    }

    ha-card:focus {
      outline: none;
    }
    
    ha-card:focus-visible {
      outline: 2px solid var(--calendar-card-line-color-vertical);
    }

    .calendar-card {
      height: 100%;
      width: 100%;
      padding: 16px;
      box-sizing: border-box;
      position: relative;
    }

    .header {
      color: var(--calendar-card-color-title, var(--ha-card-header-font-color), var(--primary-text-color));
      font-size: var(--calendar-card-font-size-title, var(--ha-card-header-font-size, 24px));
      font-weight: var(--ha-card-header-font-weight, 500);
      margin-top: 0px;
      margin-bottom: 16px;
    }

    /* Each table represents a single day, so styling resets for each day */
    table {
      width: 100%;
      table-layout: fixed;
      border-spacing: 0;
      margin-bottom: var(--calendar-card-spacing-row);
      border-bottom: var(--calendar-card-line-width-horizontal) solid var(--calendar-card-line-color-horizontal, var(--secondary-text-color));
      padding-bottom: var(--calendar-card-spacing-row);
    }

    table:last-of-type {
      margin-bottom: 0;
      border-bottom: 0;
      padding-bottom: 0;
    }

    .date-column {
      width: var(--calendar-card-date-column-width);
      text-align: center;
      padding-right: 12px;
      border-right: var(--calendar-card-line-width-vertical) solid var(--calendar-card-line-color-vertical);
    }

    .date-content {
      display: flex;
      flex-direction: column;
    }

    .weekday {
      font-size: var(--calendar-card-font-size-weekday);
      line-height: var(--calendar-card-font-size-weekday);
      color: var(--calendar-card-color-weekday);
    }

    .day {
      font-size: var(--calendar-card-font-size-day);
      line-height: var(--calendar-card-font-size-day);
      font-weight: 500;
      color: var(--calendar-card-color-day);
    }

    .month {
      font-size: var(--calendar-card-font-size-month);
      line-height: var(--calendar-card-font-size-month);
      text-transform: uppercase;
      color: var(--calendar-card-color-month);
    }

    /* Base event styling */
    .event {
      padding-top: 4px;
      padding-bottom: 4px;
      padding-left: 12px;
      border-radius: 0;
    }

    /* Single event (both first and last) */
    .event-first.event-last {
      border-radius: 0 var(--calendar-card-event-border-radius) var(--calendar-card-event-border-radius) 0;
    }

    /* First event in a day, rounded top-right corner */
    .event-first {
      border-radius: 0 var(--calendar-card-event-border-radius) 0 0;
    }

    /* Middle event in a day */
    .event-middle {
    }

    /* Last event in a day, rounded bottom-right corner */
    .event-last {
      border-radius: 0 0 var(--calendar-card-event-border-radius) 0;
    }

    .event-content {
      display: flex;
      flex-direction: column;
    }

    .event-title {
      font-size: var(--calendar-card-font-size-event);
      font-weight: 500;
      color: var(--calendar-card-color-event);
      line-height: 1.2;
      padding-bottom: 2px;
    }

    .time-location {
      display: flex;
      flex-direction: column;
      margin-top: 0;
    }

    .time, .location {
      display: flex;
      align-items: center;
      line-height: 1.2;
      margin-top: 2px;
    }

    .time span, .location span {
      display: inline-block;
      vertical-align: middle;
    }

    .time {
      font-size: var(--calendar-card-font-size-time);
      color: var(--calendar-card-color-time);
    }

    .location {
      font-size: var(--calendar-card-font-size-location);
      color: var(--calendar-card-color-location);
    }

    ha-icon {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: top;
      position: relative;
      top: 0;
      margin-right: 4px;
    }

    .time ha-icon {
      --mdc-icon-size: var(--calendar-card-icon-size-time, 14px);
    }

    .location ha-icon {
      --mdc-icon-size: var(--calendar-card-icon-size-location, 14px);
    }

    .no-events {
      text-align: center;
      color: var(--secondary-text-color);
      font-style: italic;
      padding: 16px;
    }

    .loading, .error {
      text-align: center;
      padding: 16px;
    }

    .error {
      color: var(--error-color);
    }
  `;
}
