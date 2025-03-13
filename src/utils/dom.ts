/* eslint-disable import/order */
/**
 * DOM utility functions for Calendar Card Pro
 *
 * This module contains functions for DOM element creation and manipulation.
 */

import * as Logger from './logger';

//-----------------------------------------------------------------------------
// BASIC DOM CREATION FUNCTIONS
//-----------------------------------------------------------------------------

/**
 * Create DOM element with attributes
 *
 * @param tag - HTML tag name
 * @param attributes - Object with HTML attributes
 * @param children - Array of child nodes
 * @returns Created HTML element
 */
export function createElement(
  tag: string,
  attributes: Record<string, string> = {},
  children: Array<Node | string> = [],
): HTMLElement {
  const element = document.createElement(tag);

  // Add attributes
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  // Add children
  children.forEach((child) => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  });

  return element;
}

/**
 * Create a style element with the provided CSS content
 *
 * @param cssContent - CSS text content to include in the style element
 * @returns New style element containing the provided CSS
 */
export function createStyleElement(cssContent: string): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = cssContent;
  return style;
}

/**
 * Set inner HTML safely with basic sanitization
 * Removes potentially harmful content like scripts and event handlers
 *
 * @param element - Element to set innerHTML on
 * @param htmlContent - HTML content to sanitize and set
 */
export function setInnerHTML(element: HTMLElement, htmlContent: string): void {
  // Basic sanitization to prevent XSS
  const sanitized = htmlContent
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/onerror|onclick|onload|onmouseover|onmouseout/gi, '');

  element.innerHTML = sanitized;
}

//-----------------------------------------------------------------------------
// SHADOW DOM OPERATIONS
//-----------------------------------------------------------------------------

/**
 * Clear all child nodes from a shadow root
 * Removes all children from the provided shadow root
 *
 * @param shadowRoot - Shadow DOM root to clear
 */
export function clearShadowRoot(shadowRoot: ShadowRoot): void {
  while (shadowRoot.firstChild) {
    shadowRoot.removeChild(shadowRoot.firstChild);
  }
}

/**
 * Update shadow DOM with card structure
 *
 * @param shadowRoot - Shadow DOM root
 * @param container - Card container element
 * @param style - Style element
 */
export function updateCardInShadowDOM(
  shadowRoot: ShadowRoot,
  container: HTMLElement,
  style: HTMLStyleElement,
): void {
  // Clear the shadow DOM before adding new content
  clearShadowRoot(shadowRoot);

  // Add styles and container to shadow DOM
  shadowRoot.appendChild(style);
  shadowRoot.appendChild(container);

  Logger.debug('Updated shadow DOM with card container');
}

//-----------------------------------------------------------------------------
// CARD-SPECIFIC CONSTRUCTION
//-----------------------------------------------------------------------------

/**
 * Create card structure with proper container, ripple and content elements
 *
 * @param config - Card configuration
 * @param contentContainer - Content container with calendar content
 * @returns Object containing container, ripple and content elements
 */
export function createCardStructure(contentContainer: HTMLElement): {
  container: HTMLElement;
  ripple: HTMLElement;
  content: HTMLElement;
} {
  // Create container with proper structure
  const container = document.createElement('div');
  container.className = 'card-container';
  container.setAttribute('role', 'button');
  container.setAttribute('tabindex', '0');

  // Create ripple element for visual feedback
  const ripple = document.createElement('calendar-ripple');

  // Create content container
  const content = document.createElement('div');
  content.className = 'card-content';

  // Move content from the render container to the content element
  if (contentContainer instanceof HTMLElement) {
    while (contentContainer.firstChild) {
      content.appendChild(contentContainer.firstChild);
    }
  }

  // Add the ripple first, then content to create proper layering
  container.appendChild(ripple);
  container.appendChild(content);

  Logger.debug('Created card container structure');
  return { container, ripple, content };
}
