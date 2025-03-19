/* eslint-disable import/order */
/**
 * Rendering utilities for Calendar Card Pro
 *
 * Contains functions for rendering calendar events, days, and handling
 * different display states of the calendar card.
 */

import * as Types from '../config/types';
import * as Localize from '../translations/localize';
import * as DomUtils from '../utils/dom';
import * as EventUtils from '../utils/events';
import * as Styles from './styles';
import * as Constants from '../config/constants';

//-----------------------------------------------------------------------------
// HIGH-LEVEL API FUNCTIONS
//-----------------------------------------------------------------------------

/**
 * @deprecated This function is obsolete with the LitElement implementation.
 * Use the render method in the main component class instead.
 *
 * Render a calendar card with proper container setup for MDC ripple
 */
export async function renderCalendarCard(
  config: Types.Config,
  eventsByDay: Types.EventsByDay[],
  formatEventTime: (event: Types.CalendarEventData) => string,
  formatLocation: (location: string) => string,
  chunkSize: number,
  renderDelay: number,
): Promise<{ container: HTMLDivElement; style: HTMLStyleElement }> {
  // Create container for the card content (not the outer container)
  const container = document.createElement('div');
  container.className = 'card-content';

  // Add title if configured
  if (config.title) {
    const title = document.createElement('h2');
    title.className = 'title';
    title.textContent = config.title;
    container.appendChild(title);
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

  container.appendChild(calendarContent);

  // Create style element
  const style = document.createElement('style');
  style.textContent = Styles.getStyles(config);

  return { container, style };
}

/**
 * @deprecated This function is obsolete with the LitElement implementation.
 * Error states are now handled by the render method in the main component.
 *
 * Wrapper for rendering error states to maintain consistent interface
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

//-----------------------------------------------------------------------------
// CONTENT GENERATION FUNCTIONS
//-----------------------------------------------------------------------------

/**
 * @deprecated This function is obsolete with the LitElement implementation.
 * Use lit-html's repeat directive for progressive rendering instead.
 *
 * Render calendar card content progressively to optimize performance
 */
export async function renderProgressively(
  days: Types.EventsByDay[],
  config: Types.Config,
  formatEventTime: (event: Types.CalendarEventData) => string,
  formatLocation: (location: string) => string,
  chunkSize = Constants.PERFORMANCE.CHUNK_SIZE,
  renderDelay = Constants.PERFORMANCE.RENDER_DELAY,
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
 * @deprecated This function is obsolete with the LitElement implementation.
 * Use the renderDay and renderEvent methods in the main component instead.
 *
 * Generate HTML content for a single day's events
 */
export function generateDayContent(
  day: Types.EventsByDay,
  config: Types.Config,
  formatEventTime: (event: Types.CalendarEventData) => string,
  formatLocation: (location: string) => string,
): string {
  return day.events
    .map((event: Types.CalendarEventData, index: number) => {
      // Get color from config based on entity ID
      const entityColor = EventUtils.getEntityColor(event._entityId, config);

      // Apply additional spacing to any event that's not the first one
      const isNotFirstEvent = index > 0;
      const eventClass = isNotFirstEvent ? 'event event-not-first' : 'event';

      return `
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
      <td class="${eventClass}">
        <div class="event-content">
          <div class="event-title" style="color: ${entityColor}">${event.summary}</div>
          <div class="time-location">
            <div class="time">
              <ha-icon icon="mdi:clock-outline"></ha-icon>
              <span>${formatEventTime(event)}</span>
            </div>
            ${
              event.location && config.show_location
                ? `
              <div class="location">
                <ha-icon icon="mdi:map-marker"></ha-icon>
                <span>${formatLocation(event.location)}</span>
              </div>
            `
                : ''
            }
          </div>
        </div>
      </td>
    </tr>
  `;
    })
    .join('');
}

//-----------------------------------------------------------------------------
// STATE RENDERING HELPERS
//-----------------------------------------------------------------------------

/**
 * @deprecated This function is obsolete with the LitElement implementation.
 * Error states are now handled by the renderError method in the main component.
 *
 * Generate an error or loading state view
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
      <div style="text-align: center; color: ${Constants.COLORS.PRIMARY_TEXT};">
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
          _entityId: '', // Use empty entity ID for default color
        },
      ],
    };

    const container = document.createElement('div');
    container.className = 'card-container';

    const content = document.createElement('div');
    content.className = 'card-content';

    // Get default color - using default event color from config
    const defaultColor = config.event_color || `${Constants.COLORS.PRIMARY_TEXT}`;

    // Modified the empty state to not show time icon and use default color
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
              <div class="event-title" style="color: ${defaultColor}">
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
  };

  const html = `
    <div class="card-content">
      ${messages[state]}
    </div>
  `;
  const styleText = Styles.getErrorStyles();

  return { html, styleText };
}
