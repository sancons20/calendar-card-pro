/* eslint-disable import/order */
/**
 * DOM utility functions for Calendar Card Pro
 *
 * This module contains functions for DOM element creation and manipulation.
 */

import * as Logger from './logger-utils';

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
 * Create a text node with the given content
 *
 * @param content - Text content
 * @returns Text node with the given content
 */
export function createTextNode(content: string): Text {
  return document.createTextNode(content);
}

/**
 * Create a style element with the provided CSS content
 */
export function createStyleElement(cssContent: string): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = cssContent;
  return style;
}

/**
 * Set inner HTML safely with basic sanitization
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

  // Move content from the render container to our content element
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
