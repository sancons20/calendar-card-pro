/* eslint-disable import/order */
/**
 * Action handling utilities for Calendar Card Pro
 *
 * Functions for handling user interactions, tap and hold actions,
 * navigation, calling services, etc.
 */

import * as Types from '../config/types';

/**
 * Handle an action based on the provided action configuration
 *
 * @param actionConfig - Action configuration from card config
 * @param hass - Home Assistant instance
 * @param context - Element to dispatch events from
 * @param entityId - Primary entity ID for more-info actions
 * @param expandCallback - Callback to execute when the expand action is triggered
 */
export function handleAction(
  actionConfig: Types.ActionConfig,
  hass: Types.Hass | null,
  context: HTMLElement,
  entityId: string,
  expandCallback?: () => void,
): void {
  if (!hass || !actionConfig) return;

  switch (actionConfig.action) {
    case 'more-info':
      fireMoreInfo(context, entityId);
      break;
    case 'navigate':
      handleNavigation(actionConfig);
      break;
    case 'call-service':
      callService(hass, actionConfig);
      break;
    case 'url':
      openUrl(actionConfig);
      break;
    case 'expand':
      if (expandCallback) expandCallback();
      break;
    case 'none':
    default:
      // Do nothing for 'none' action
      break;
  }
}

/**
 * Fire a more-info event for a specific entity
 *
 * @param element - Element to dispatch the event from
 * @param entityId - Entity ID to show more info for
 */
export function fireMoreInfo(element: HTMLElement, entityId: string): void {
  const event = new CustomEvent<{ entityId: string }>('hass-more-info', {
    bubbles: true,
    composed: true,
    detail: {
      entityId,
    },
  });
  element.dispatchEvent(event);
}

/**
 * Handle navigation to another path in Home Assistant
 *
 * @param actionConfig - Action configuration
 */
export function handleNavigation(actionConfig: Types.ActionConfig): void {
  if (actionConfig.navigation_path) {
    window.history.pushState(null, '', actionConfig.navigation_path);
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
  if (actionConfig.service) {
    const [domain, service] = actionConfig.service.split('.');
    hass.callService(domain, service, actionConfig.service_data || {});
  }
}

/**
 * Open a URL
 *
 * @param actionConfig - Action configuration
 */
export function openUrl(actionConfig: Types.ActionConfig): void {
  if (actionConfig.url_path) {
    window.open(actionConfig.url_path, actionConfig.open_tab || '_blank');
  }
}

/**
 * Set up event listeners for tap and hold actions
 *
 * @param element - Element to attach event listeners to
 * @param tapAction - Action to perform on tap
 * @param holdAction - Action to perform on hold
 * @param hass - Home Assistant instance
 * @param context - Element to dispatch events from
 * @param entityId - Primary entity ID for more-info actions
 * @param expandCallback - Callback to execute when the expand action is triggered
 */
export function setupEventListeners(
  element: HTMLElement,
  tapAction: Types.ActionConfig | undefined,
  holdAction: Types.ActionConfig | undefined,
  hass: Types.Hass | null,
  context: HTMLElement,
  entityId: string,
  expandCallback?: () => void,
): void {
  if (!element) return;

  // Clear old event listeners by cloning and replacing the element
  const oldElement = element;
  const newElement = element.cloneNode(true) as HTMLElement;

  if (oldElement.parentNode) {
    oldElement.parentNode.replaceChild(newElement, oldElement);
  }

  let holdTimer: number;
  let isHold = false;

  const handlePointerDown = (): void => {
    if (!holdAction) return;

    isHold = false;
    holdTimer = window.setTimeout(() => {
      isHold = true;
      if (holdAction) {
        handleAction(holdAction, hass, context, entityId, expandCallback);
      }
    }, 500);
  };

  const handlePointerUp = (): void => {
    clearTimeout(holdTimer);
    if (!isHold && tapAction) {
      handleAction(tapAction, hass, context, entityId, expandCallback);
    }
  };

  const handlePointerCancel = (): void => {
    clearTimeout(holdTimer);
  };

  // Add new listeners
  newElement.addEventListener('pointerdown', handlePointerDown);
  newElement.addEventListener('pointerup', handlePointerUp);
  newElement.addEventListener('pointercancel', handlePointerCancel);

  // Don't return anything since function is void
}

/**
 * Get the primary entity ID from a list of entities
 *
 * @param entities - List of entities
 * @returns First entity ID from the list
 */
export function getPrimaryEntityId(entities: Array<string | Types.EntityConfig>): string {
  if (entities.length === 0) return '';

  const firstEntity = entities[0];
  return typeof firstEntity === 'string' ? firstEntity : firstEntity.entity;
}
