/**
 * DOM manipulation utilities for Calendar Card Pro
 *
 * Provides utility functions for creating and manipulating DOM elements.
 */

/**
 * Create an HTML element with optional class name and text content
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  textContent?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
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
 * Clear all child nodes from a shadow root
 */
export function clearShadowRoot(shadowRoot: ShadowRoot): void {
  while (shadowRoot.firstChild) {
    shadowRoot.removeChild(shadowRoot.firstChild);
  }
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
