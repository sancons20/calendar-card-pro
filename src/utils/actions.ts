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
  // Clear existing event listeners
  const clone = cardContainer.cloneNode(true) as HTMLDivElement;
  cardContainer.replaceWith(clone);

  // Variables to track pointer state
  let holdTimer: number | null = null;
  let holdTriggered = false;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let activePointerId: number | null = null;
  let hasMoved = false;

  // Handle hold action
  if (holdAction && holdAction.action !== 'none') {
    // Start on pointer down
    clone.addEventListener('pointerdown', (ev) => {
      if (activePointerId !== null) return; // Already processing a pointer
      activePointerId = ev.pointerId;
      hasMoved = false;

      // Record start position
      pointerStartX = ev.clientX;
      pointerStartY = ev.clientY;

      // Start hold timer
      holdTimer = window.setTimeout(() => {
        if (!hasMoved) {
          holdTriggered = true;
          handleAction(holdAction, hass, element, entityId, toggleExpanded);
        }
      }, 500);
    });

    // Monitor movement to differentiate between hold and swipe
    clone.addEventListener('pointermove', (ev) => {
      if (ev.pointerId !== activePointerId) return;

      // Check if moved too far from start position (10px threshold)
      const movement = Math.hypot(ev.clientX - pointerStartX, ev.clientY - pointerStartY);

      // Mark as moved if we exceed threshold - this will prevent hold action
      if (movement > 10) {
        hasMoved = true;

        // Cancel the hold timer if it's still active
        if (holdTimer !== null) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
      }
    });

    // Clean up on pointer up/cancel
    const endPointerAction = (ev: PointerEvent) => {
      if (ev.pointerId !== activePointerId) return;

      // Clear the hold timer
      if (holdTimer !== null) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }

      // Reset pointer ID
      activePointerId = null;

      // If hold was triggered, prevent tap action
      // but DON'T prevent default here - this allows scrolling to work
      if (holdTriggered) {
        // Instead of preventDefault, just use a longer timeout
        // so other handlers don't immediately override our action
        setTimeout(() => {
          holdTriggered = false;
        }, 500); // Use a longer delay of 500ms
      }
    };

    clone.addEventListener('pointerup', endPointerAction);
    clone.addEventListener('pointercancel', endPointerAction);
    clone.addEventListener('pointerleave', endPointerAction);

    // Prevent text selection during hold but allow scrolling
    clone.style.userSelect = 'none';
    // IMPORTANT: Allow pan-y for vertical scrolling
    clone.style.touchAction = 'pan-y';
  }

  // Handle tap/click action
  if (tapAction && tapAction.action !== 'none') {
    clone.addEventListener('click', () => {
      // Only process click if hold wasn't triggered and no significant movement
      if (!holdTriggered && !hasMoved) {
        handleAction(tapAction, hass, element, entityId, toggleExpanded);
      }
    });
    clone.style.cursor = 'pointer';
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
