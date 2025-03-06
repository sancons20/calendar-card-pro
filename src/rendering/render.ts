/* eslint-disable import/order */
/**
 * Rendering utilities for Calendar Card Pro
 *
 * Contains functions for rendering calendar events, days, and handling
 * different display states of the calendar card.
 */

import * as Types from '../config/types';
import * as Localize from '../translations/localize';
import * as DomUtils from '../utils/dom-utils';
import * as Styles from './styles';

/**
 * Render a calendar card with proper container setup for ripple effects
 */
export async function renderCalendarCard(
  config: Types.Config,
  eventsByDay: Types.EventsByDay[],
  formatEventTime: (event: Types.CalendarEventData) => string,
  formatLocation: (location: string) => string,
  chunkSize: number,
  renderDelay: number,
): Promise<{ container: HTMLDivElement; style: HTMLStyleElement }> {
  // Create container for the card
  const container = document.createElement('div');
  container.className = 'card-container card-interactive hover-effect-target';

  // Add essential styling for interactions
  container.style.position = 'relative'; // Required for absolute positioning of ripple
  container.style.overflow = 'hidden'; // Keep ripples contained
  container.style.display = 'block'; // Ensure block display for proper sizing
  container.style.width = '100%'; // Fill available width
  container.style.height = '100%'; // Fill available height
  container.style.boxSizing = 'border-box'; // Include padding in dimensions

  // Create content div inside container
  const content = document.createElement('div');
  content.className = 'card-content';
  content.style.position = 'relative';
  content.style.zIndex = '2'; // Above ripples

  // Create ripple container for tap effects
  const rippleContainer = document.createElement('div');
  rippleContainer.className = 'card-ripple-container';

  // Add title if configured
  if (config.title) {
    const title = document.createElement('h2');
    title.className = 'title';
    title.textContent = config.title;
    content.appendChild(title);
  }

  // Add calendar content
  const calendarContent = await renderProgressively(
    eventsByDay,
    config,
    formatEventTime,
    formatLocation,
    chunkSize,
    renderDelay,
  );

  content.appendChild(calendarContent);

  // Layer order matters: ripple container first (under content)
  container.appendChild(rippleContainer);
  container.appendChild(content);

  // Create style element
  const style = document.createElement('style');
  style.textContent = Styles.getStyles(config);

  return { container, style };
}

/**
 * Wrapper for rendering error states to maintain consistent interface
 *
 * @param shadowRoot - Shadow DOM root to render to
 * @param state - Current state ('loading', 'empty', 'error')
 * @param config - Card configuration
 */
export function renderErrorToDOM(
  shadowRoot: ShadowRoot,
  state: 'loading' | 'empty' | 'error',
  config: Types.Config,
): void {
  // Clear shadow DOM first
  DomUtils.clearShadowRoot(shadowRoot);

  // Get error state content
  const result = renderErrorState(state, config);

  // Render error state content
  if ('container' in result && 'style' in result) {
    shadowRoot.appendChild(result.style);
    shadowRoot.appendChild(result.container);
  } else {
    shadowRoot.innerHTML = `
      <style>${result.styleText}</style>
      ${result.html}
    `;
  }
}

/**
 * Render calendar card content progressively to optimize performance
 *
 * @param days - Array of day objects to render
 * @param config - Card configuration
 * @param formatEventTime - Function to format event time
 * @param formatLocation - Function to format location
 * @param chunkSize - Number of days to render in each chunk
 * @param renderDelay - Delay between rendering chunks (ms)
 * @returns Promise resolving to DocumentFragment with content
 */
export async function renderProgressively(
  days: Types.EventsByDay[],
  config: Types.Config,
  formatEventTime: (event: Types.CalendarEventData) => string,
  formatLocation: (location: string) => string,
  chunkSize = 10,
  renderDelay = 50,
): Promise<DocumentFragment> {
  if (!days.length) {
    const fragment = document.createDocumentFragment();
    const noEventsDiv = document.createElement('div');
    noEventsDiv.className = 'no-events';
    noEventsDiv.textContent = 'No upcoming events';
    fragment.appendChild(noEventsDiv);
    return fragment;
  }

  const fragment = document.createDocumentFragment();
  const renderChunk = async (startIdx: number): Promise<void> => {
    const chunk = days.slice(startIdx, startIdx + chunkSize);
    if (!chunk.length) return;

    chunk.forEach((day: Types.EventsByDay) => {
      if (day.events.length === 0) return;
      const table = document.createElement('table');
      table.innerHTML = generateDayContent(day, config, formatEventTime, formatLocation);
      fragment.appendChild(table);
    });

    if (startIdx + chunkSize < days.length) {
      await new Promise((resolve) => setTimeout(resolve, renderDelay));
      await renderChunk(startIdx + chunkSize);
    }
  };

  await renderChunk(0);
  return fragment;
}

/**
 * Generate an error or loading state view
 *
 * @param state - Card state ('loading', 'empty', 'error')
 * @param config - Card configuration
 * @returns HTML Element containing the state view
 */
export function renderErrorState(
  state: 'loading' | 'empty' | 'error',
  config: Types.Config,
): { container: Element; style: HTMLStyleElement } | { html: string; styleText: string } {
  if (state === 'loading') {
    const container = document.createElement('div');
    container.className = 'card-container';

    const content = document.createElement('div');
    content.className = 'card-content';
    content.innerHTML = `
      <div style="text-align: center; color: var(--primary-text-color);">
        ${Localize.translateString(config.language, 'loading')}
      </div>`;

    container.appendChild(content);

    const style = document.createElement('style');
    style.textContent = Styles.getStyles(config);

    return { container, style };
  }

  if (state === 'empty') {
    // Create a card that looks like a regular calendar entry
    const now = new Date();
    const emptyDay = {
      weekday: Localize.getDayName(config.language, now.getDay()),
      day: now.getDate(),
      month: Localize.getMonthName(config.language, now.getMonth()),
      events: [
        {
          summary: Localize.translateString(config.language, 'noEvents'),
          time: '', // No time display
          location: '', // No location
          _entityConfig: { color: 'var(--secondary-text-color)' },
        },
      ],
    };

    const container = document.createElement('div');
    container.className = 'card-container';

    const content = document.createElement('div');
    content.className = 'card-content';

    // Modified the empty state to not show time icon
    content.innerHTML = `
      <table>
        <tr>
          <td class="date" rowspan="1">
            <div class="date-content">
              <div class="weekday">${emptyDay.weekday}</div>
              <div class="day">${emptyDay.day}</div>
              ${config.show_month ? `<div class="month">${emptyDay.month}</div>` : ''}
            </div>
          </td>
          <td class="event">
            <div class="event-content">
              <div class="event-title" style="color: ${emptyDay.events[0]._entityConfig.color}">
                ${emptyDay.events[0].summary}
              </div>
            </div>
          </td>
        </tr>
      </table>`;

    container.appendChild(content);

    const style = document.createElement('style');
    style.textContent = Styles.getStyles(config);

    return { container, style };
  }

  // For error states, return an HTML string and style
  const messages = {
    error: `<p style="color: var(--error-color, red);">${Localize.translateString(
      config.language,
      'error',
    )}</p>`,
    loading: `<p style="color: var(--secondary-text-color);">${Localize.translateString(
      config.language,
      'loading',
    )}</p>`,
  };

  const html = `
    <div class="card-content">
      ${messages[state]}
    </div>
  `;
  const styleText = Styles.getErrorStyles();

  return { html, styleText };
}

/**
 * Generate HTML content for all calendar days
 *
 * @param days - Array of day objects
 * @param config - Card configuration
 * @param formatEventTime - Function to format event time
 * @param formatLocation - Function to format location
 * @returns HTML string for the full calendar
 */
export function generateCalendarContent(
  days: Types.EventsByDay[],
  config: Types.Config,
  formatEventTime: (event: Types.CalendarEventData) => string,
  formatLocation: (location: string) => string,
): string {
  if (!days.length) {
    return '<div class="no-events">No upcoming events</div>';
  }

  return days
    .map((day) => {
      if (day.events.length === 0) return '';

      const eventRows = day.events
        .map(
          (event: Types.CalendarEventData, index: number) => `
      <tr>
        ${
          index === 0
            ? `
          <td class="date" rowspan="${day.events.length}">
            <div class="date-content">
              <div class="weekday">${day.weekday}</div>
              <div class="day">${day.day}</div>
              ${config.show_month ? `<div class="month">${day.month}</div>` : ''}
            </div>
          </td>
        `
            : ''
        }
        <td class="event">
          <div class="event-content">
            <div class="event-title">${event.summary}</div>
            <div class="time-location">
              <div class="time">
                <ha-icon icon="hass:clock-outline"></ha-icon>
                <span>${formatEventTime(event)}</span>
              </div>
              ${
                event.location && config.show_location
                  ? `
                <div class="location">
                  <ha-icon icon="hass:map-marker"></ha-icon>
                  <span>${formatLocation(event.location)}</span>
                </div>
              `
                  : ''
              }
            </div>
          </div>
        </td>
      </tr>
    `,
        )
        .join('');

      return `<table>${eventRows}</table>`;
    })
    .join('');
}

/**
 * Generate HTML content for a single day's events
 *
 * @param day - Day object containing events
 * @param config - Card configuration
 * @param formatEventTime - Function to format event time
 * @param formatLocation - Function to format location
 * @returns HTML string representing the day's events
 */
export function generateDayContent(
  day: Types.EventsByDay,
  config: Types.Config,
  formatEventTime: (event: Types.CalendarEventData) => string,
  formatLocation: (location: string) => string,
): string {
  return day.events
    .map(
      (event: Types.CalendarEventData, index: number) => `
    <tr>
      ${
        index === 0
          ? `
        <td class="date" rowspan="${day.events.length}">
          <div class="date-content">
            <div class="weekday">${day.weekday}</div>
            <div class="day">${day.day}</div>
            ${config.show_month ? `<div class="month">${day.month}</div>` : ''}
          </div>
        </td>
      `
          : ''
      }
      <td class="event">
        <div class="event-content">
          <div class="event-title" style="color: ${
            event._entityConfig?.color
          }">${event.summary}</div>
          <div class="time-location">
            <div class="time">
              <ha-icon icon="hass:clock-outline"></ha-icon>
              <span>${formatEventTime(event)}</span>
            </div>
            ${
              event.location && config.show_location
                ? `
              <div class="location">
                <ha-icon icon="hass:map-marker"></ha-icon>
                <span>${formatLocation(event.location)}</span>
              </div>
            `
                : ''
            }
          </div>
        </div>
      </td>
    </tr>
  `,
    )
    .join('');
}
