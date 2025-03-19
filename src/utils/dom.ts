/* eslint-disable import/order */
/**
 * DOM utility functions for Calendar Card Pro
 *
 * This module contains functions for DOM element creation and manipulation.
 * Many of these functions are now obsolete with the LitElement implementation
 * but are maintained for backward compatibility.
 */

import * as Logger from './logger';

//-----------------------------------------------------------------------------
// BASIC DOM CREATION FUNCTIONS
//-----------------------------------------------------------------------------

/**
 * @deprecated This function is obsolete with the LitElement implementation.
 * Use lit-html templates instead of manual DOM creation.
 *
 * Create DOM element with attributes
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
 * @deprecated This function is obsolete with the LitElement implementation.
 * Use LitElement's static styles property instead.
 *
 * Create a style element with the provided CSS content
 */
export function createStyleElement(cssContent: string): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = cssContent;
  return style;
}

/**
 * @deprecated This function is obsolete with the LitElement implementation.
 * Use lit-html's unsafeHTML directive if needed for sanitized content.
 *
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
 * @deprecated This function is obsolete with the LitElement implementation.
 * LitElement manages the shadow DOM rendering automatically.
 *
 * Clear all child nodes from a shadow root
 */
export function clearShadowRoot(shadowRoot: ShadowRoot): void {
  while (shadowRoot.firstChild) {
    shadowRoot.removeChild(shadowRoot.firstChild);
  }
}

/**
 * @deprecated This function is obsolete with the LitElement implementation.
 * LitElement manages the shadow DOM rendering automatically.
 *
 * Update shadow DOM with card structure
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
 * @deprecated This function is obsolete with the LitElement implementation.
 * Use ha-card element in lit-html templates instead.
 *
 * Create card structure with proper container, ripple and content elements
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
