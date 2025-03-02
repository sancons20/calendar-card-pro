/* eslint-disable import/order */
/**
 * Action handling utilities for Calendar Card Pro
 *
 * Provides functions for handling user interactions like tap/click and hold actions.
 */

import * as Types from '../config/types';

/**
 * Handle action based on configuration
 *
 * @param actionConfig - Action configuration
 * @param hass - Home Assistant instance
 * @param element - DOM element generating the action
 * @param entityId - Primary entity ID
 * @param toggleExpanded - Function to toggle expanded state
 */
export function handleAction(
  actionConfig: Types.ActionConfig,
  hass: Types.Hass | null,
  element: Element,
  entityId: string,
  toggleExpanded: () => void,
): void {
  if (!actionConfig || !actionConfig.action || actionConfig.action === 'none') {
    return;
  }

  switch (actionConfig.action) {
    case 'more-info':
      fireMoreInfo(element, entityId);
      break;
    case 'navigate':
      handleNavigation(actionConfig);
      break;
    case 'call-service':
      if (hass) {
        callService(hass, actionConfig);
      }
      break;
    case 'url':
      openUrl(actionConfig);
      break;
    case 'expand':
      toggleExpanded();
      break;
    default:
      console.warn(`Unknown action type: ${actionConfig.action}`);
  }
}

/**
 * Get primary entity ID from entities array
 *
 * @param entities - Calendar entities
 * @returns First entity ID
 */
export function getPrimaryEntityId(
  entities: Array<string | { entity: string; color?: string }>,
): string {
  const firstEntity = entities[0];
  return typeof firstEntity === 'string' ? firstEntity : firstEntity.entity;
}

/**
 * Set up event listeners for tap and hold actions
 *
 * @param cardContainer - Card container element
 * @param tapAction - Tap action configuration
 * @param holdAction - Hold action configuration
 * @param hass - Home Assistant instance
 * @param element - DOM element generating the action
 * @param entityId - Primary entity ID
 * @param toggleExpanded - Function to toggle expanded state
 */
export function setupEventListeners(
  cardContainer: HTMLDivElement,
  tapAction: Types.ActionConfig,
  holdAction: Types.ActionConfig,
  hass: Types.Hass | null,
  element: Element,
  entityId: string,
  toggleExpanded: () => void,
): void {
  // Clear existing event listeners (helps prevent memory leaks)
  const clone = cardContainer.cloneNode(true) as HTMLDivElement;
  cardContainer.replaceWith(clone);

  // Handle tap/click action
  if (tapAction && tapAction.action !== 'none') {
    clone.addEventListener('click', () => {
      handleAction(tapAction, hass, element, entityId, toggleExpanded);
    });
    clone.style.cursor = 'pointer';
  }

  // Handle hold action
  if (holdAction && holdAction.action !== 'none') {
    let holdTimer: number | null = null;
    let holdTriggered = false;

    clone.addEventListener(
      'touchstart',
      (ev) => {
        // Record touch start position
        const touch = ev.touches[0];
        const touchStartY = touch.clientY;
        const touchStartX = touch.clientX;

        // Start hold timer
        holdTimer = window.setTimeout(() => {
          // If too much movement, don't trigger hold
          // Here we check against a small threshold of 10px
          const movement = Math.hypot(touchStartX - touch.clientX, touchStartY - touch.clientY);

          if (movement < 10) {
            holdTriggered = true;
            handleAction(holdAction, hass, element, entityId, toggleExpanded);
          }
        }, 500); // 500ms hold time
      },
      { passive: true },
    );

    clone.addEventListener(
      'touchend',
      () => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
        holdTriggered = false;
      },
      { passive: true },
    );

    clone.addEventListener(
      'touchmove',
      () => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
      },
      { passive: true },
    );

    // Long mouse press handling for desktop
    clone.addEventListener('mousedown', () => {
      holdTimer = window.setTimeout(() => {
        holdTriggered = true;
        handleAction(holdAction, hass, element, entityId, toggleExpanded);
      }, 500); // 500ms hold time
    });

    clone.addEventListener('mouseup', (ev) => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }

      // If hold was triggered, prevent the click (tap) event
      if (holdTriggered) {
        ev.stopPropagation();
        holdTriggered = false;
      }
    });

    clone.addEventListener('mouseleave', () => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      holdTriggered = false;
    });

    // Prevent text selection during hold
    clone.style.userSelect = 'none';
  }
}

/**
 * Fire a Home Assistant more-info event
 *
 * @param element - DOM element generating the event
 * @param entityId - Entity ID to show info about
 */
export function fireMoreInfo(element: Element, entityId: string): void {
  // Create a new custom event
  const event = new CustomEvent('hass-more-info', {
    detail: { entityId },
    bubbles: true,
    composed: true,
    cancelable: false,
  });

  element.dispatchEvent(event);
}

/**
 * Handle navigation action
 *
 * @param actionConfig - Action configuration
 */
export function handleNavigation(actionConfig: Types.ActionConfig): void {
  if (actionConfig.navigation_path) {
    // The key part that was missing: directly modify browser history
    window.history.pushState(null, '', actionConfig.navigation_path);

    // Then dispatch a simple event (without details)
    window.dispatchEvent(new Event('location-changed'));
  }
}

/**
 * Call a Home Assistant service
 *
 * @param hass - Home Assistant instance
 * @param actionConfig - Action configuration
 */
export function callService(hass: Types.Hass, actionConfig: Types.ActionConfig): void {
  if (!actionConfig.service) return;

  const [domain, service] = actionConfig.service.split('.');
  if (!domain || !service) {
    console.error(`Invalid service: ${actionConfig.service}`);
    return;
  }

  const serviceData = actionConfig.service_data || {};
  hass.callService(domain, service, serviceData);
}

/**
 * Open a URL
 *
 * @param actionConfig - Action configuration
 */
export function openUrl(actionConfig: Types.ActionConfig): void {
  if (!actionConfig.url_path) return;

  window.open(actionConfig.url_path, '_blank');
}
