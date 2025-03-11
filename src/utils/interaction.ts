/* eslint-disable import/order */
/**
 * Interaction module for Calendar Card Pro
 *
 * Implements Material Design-inspired interactions with proper state management
 * and device-appropriate behavior based on Home Assistant Tile Card patterns.
 *
 * Interaction patterns inspired by Home Assistant's Tile Card
 * and Material Design, both licensed under the Apache License 2.0.
 * https://github.com/home-assistant/frontend/blob/dev/LICENSE.md
 */

import * as Types from '../config/types';
import * as Logger from './logger-utils';
import * as Constants from '../config/constants';

/**
 * Global registry for all active hold indicators
 * Used to ensure cleanup of any orphaned indicators
 */
const globalHoldIndicatorRegistry = new Set<HTMLElement>();

/**
 * Setup window blur event handler to clean up any orphaned indicators
 * This ensures indicators are removed even if normal cleanup fails
 */
window.addEventListener('blur', () => {
  // Clean up all registered indicators when window loses focus
  cleanupAllHoldIndicators();
});

/**
 * Clean up all registered hold indicators
 * This is a safety mechanism to prevent orphaned indicators
 */
export function cleanupAllHoldIndicators(): void {
  if (globalHoldIndicatorRegistry.size > 0) {
    Logger.debug(`Cleaning up ${globalHoldIndicatorRegistry.size} orphaned hold indicators`);

    // Remove all indicators
    globalHoldIndicatorRegistry.forEach((indicator) => {
      removeHoldIndicator(indicator);
    });

    // Clear the registry
    globalHoldIndicatorRegistry.clear();
  }
}

/**
 * Extract primary entity ID from entities configuration
 */
export function getPrimaryEntityId(
  entities: Array<string | { entity: string; color?: string }>,
): string {
  const firstEntity = entities[0];
  return typeof firstEntity === 'string' ? firstEntity : firstEntity.entity;
}

/**
 * Handle action based on configuration
 * Full implementation following HA Tile Card patterns
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
  // Validate input to prevent errors
  if (!actionConfig || !actionConfig.action || actionConfig.action === 'none') {
    Logger.debug('No action or action set to none - ignoring');
    return;
  }

  Logger.debug(`Executing action: ${actionConfig.action}`);

  // Specific, typed actions with proper error handling
  try {
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
        } else {
          Logger.warn('Cannot call service - hass object not available');
        }
        break;

      case 'url':
        openUrl(actionConfig);
        break;

      case 'expand':
        toggleExpanded();
        break;

      default:
        Logger.warn(`Unknown action type: ${actionConfig.action}`);
    }
  } catch (error) {
    // Ensure errors in actions don't crash the card
    Logger.error(`Error executing action ${actionConfig.action}:`, error);
  }
}

/**
 * Fire a Home Assistant more-info event
 * Full implementation following HA patterns
 *
 * @param element - DOM element generating the event
 * @param entityId - Entity ID to show info about
 */
export function fireMoreInfo(element: Element, entityId: string): void {
  if (!entityId) {
    Logger.warn('Cannot show more-info - no entity ID provided');
    return;
  }

  Logger.debug(`Firing more-info for entity: ${entityId}`);

  try {
    // Create a new custom event with proper bubbling
    const event = new CustomEvent('hass-more-info', {
      detail: { entityId },
      bubbles: true,
      composed: true, // Important for crossing shadow DOM boundaries
      cancelable: false,
    });

    element.dispatchEvent(event);
  } catch (error) {
    Logger.error('Error firing more-info event:', error);
  }
}

/**
 * Handle navigation action with improved error handling
 *
 * @param actionConfig - Action configuration
 */
export function handleNavigation(actionConfig: Types.ActionConfig): void {
  if (!actionConfig.navigation_path) {
    Logger.warn('Cannot navigate - no navigation path provided');
    return;
  }

  Logger.info(`Navigating to: ${actionConfig.navigation_path}`);

  try {
    // Navigate using history API
    window.history.pushState(null, '', actionConfig.navigation_path);

    // Dispatch event for Home Assistant to detect navigation
    const locationChangedEvent = new Event('location-changed', {
      bubbles: true,
      cancelable: false,
    });
    window.dispatchEvent(locationChangedEvent);
  } catch (error) {
    Logger.error('Error during navigation:', error);
  }
}

/**
 * Call a Home Assistant service with improved validation and error handling
 *
 * @param hass - Home Assistant instance
 * @param actionConfig - Action configuration
 */
export function callService(hass: Types.Hass, actionConfig: Types.ActionConfig): void {
  if (!actionConfig.service) {
    Logger.warn('Cannot call service - no service specified');
    return;
  }

  const serviceParts = actionConfig.service.split('.');
  if (serviceParts.length !== 2) {
    Logger.error(`Invalid service format: ${actionConfig.service} - must be domain.service`);
    return;
  }

  const [domain, service] = serviceParts;
  const serviceData = actionConfig.service_data || {};

  Logger.info(`Calling service ${domain}.${service}`, serviceData);

  try {
    hass.callService(domain, service, serviceData);
  } catch (error) {
    Logger.error(`Error calling service ${domain}.${service}:`, error);
  }
}

/**
 * Open a URL with security validation
 *
 * @param actionConfig - Action configuration
 */
export function openUrl(actionConfig: Types.ActionConfig): void {
  if (!actionConfig.url_path) {
    Logger.warn('Cannot open URL - no URL path provided');
    return;
  }

  Logger.info(`Opening URL: ${actionConfig.url_path}`);

  try {
    // Security check - must be http/https URL or relative path
    let url = actionConfig.url_path;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
      Logger.warn(`Potentially unsafe URL: ${url} - adding https://`);
      url = 'https://' + url;
    }

    // Open URL in new tab with security best practices
    const newTab = window.open(url, '_blank');
    if (newTab) {
      newTab.opener = null; // Remove reference to opener for security
    }
  } catch (error) {
    Logger.error('Error opening URL:', error);
  }
}

/**
 * Create hold indicator that appears after hold threshold (500ms)
 * Uses exact specifications from HA Tile Card
 * Enhanced with smoother animation and transition from ripple effect
 *
 * @param event - Pointer event that triggered the hold
 * @returns The created hold indicator element
 */
export function createHoldIndicator(event: PointerEvent): HTMLElement {
  Logger.debug('Creating hold indicator', {
    x: event.clientX,
    y: event.clientY,
  });

  // Create hold indicator element with correct class
  const indicator = document.createElement('div');

  // Determine if this is a touch device for proper sizing
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  const size = isTouchDevice ? 100 : 50;

  // Apply ALL styles inline with !important flags to prevent any overrides
  indicator.style.cssText = `
    position: fixed !important;
    width: ${size}px !important; 
    height: ${size}px !important;
    left: ${event.clientX}px !important;
    top: ${event.clientY}px !important;
    border-radius: 50% !important;
    background-color: var(--card-accent-color, var(--primary-color, #03a9f4)) !important;
    opacity: 0 !important;
    transform: translate(-50%, -50%) scale(0) !important;
    transform-origin: center center !important;
    pointer-events: none !important;
    will-change: transform, opacity !important;
    transition: transform 200ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms cubic-bezier(0.2, 0, 0, 1) !important;
    z-index: 999999 !important;
    backface-visibility: hidden !important;
  `;

  // Add to document body
  document.body.appendChild(indicator);

  // Register the indicator in our global registry
  globalHoldIndicatorRegistry.add(indicator);

  // Force a reflow to ensure the initial state is rendered
  indicator.offsetWidth; // eslint-disable-line no-unused-expressions

  // Animate to full size
  requestAnimationFrame(() => {
    indicator.style.opacity = '0.20';
    indicator.style.transform = 'translate(-50%, -50%) scale(1)';
  });

  return indicator;
}

/**
 * Remove hold indicator with proper animation
 * Enhanced with smoother exit animation and registry cleanup
 *
 * @param indicator - Hold indicator element to remove
 */
export function removeHoldIndicator(indicator: HTMLElement): void {
  if (!indicator || !indicator.parentNode) return;

  // Start fade-out animation
  indicator.style.opacity = '0';
  indicator.style.transform = 'translate(-50%, -50%) scale(0.9)';

  // Remove from registry
  globalHoldIndicatorRegistry.delete(indicator);

  // Remove from DOM after animation completes
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }, 300); // Matches HA specs for fade-out duration
}

/**
 * Interface for interaction state
 * Ensures consistent state management across interaction lifecycle
 */
export interface InteractionState {
  holdTimer: number | null;
  holdTriggered: boolean;
  holdIndicator: HTMLElement | null;
  activePointerId: number | null;
  lastActionTime: number;
  pendingHoldAction: boolean;
  lastPointerEvent: PointerEvent | null;
}

/**
 * Setup interactions with component-managed state
 * This version uses the component's state object directly for better lifecycle integration
 */
export function setupComponentIntegratedInteractions(
  element: HTMLElement,
  config: Types.Config,
  hass: Types.Hass | null,
  entityId: string,
  toggleExpanded: () => void,
  componentState: InteractionState, // Note: state is passed directly from component
): () => void {
  Logger.debug('Setting up component-integrated interactions');

  // Clean up any existing timers in component state
  if (componentState.holdTimer !== null) {
    clearTimeout(componentState.holdTimer);
    componentState.holdTimer = null;
  }

  // Find ripple element - critical for operation
  const rippleElement = element.querySelector('calendar-ripple') as HTMLElement;
  if (!rippleElement) {
    Logger.warn('Cannot set up interactions - missing ripple element');
    return () => {};
  }

  // Reset component state for this interaction setup
  componentState.holdTriggered = false;
  componentState.pendingHoldAction = false;
  componentState.activePointerId = null;

  // Create pointer down handler that works with component's state
  const handlePointerDown = (ev: PointerEvent) => {
    // Store pointer ID in component state
    componentState.activePointerId = ev.pointerId;
    componentState.holdTriggered = false;
    componentState.pendingHoldAction = false;

    // Store this event for hold indicator positioning
    componentState.lastPointerEvent = ev;

    // Set up hold timer using component state
    if (config.hold_action && config.hold_action.action !== 'none') {
      // Clear any existing timer
      if (componentState.holdTimer !== null) {
        clearTimeout(componentState.holdTimer);
      }

      // Set up new timer in component state
      componentState.holdTimer = window.setTimeout(() => {
        if (componentState.activePointerId === ev.pointerId) {
          Logger.debug('Hold threshold reached');

          // Mark hold triggered in component state but DON'T execute yet
          componentState.holdTriggered = true;
          componentState.pendingHoldAction = true;

          // Create hold indicator
          componentState.holdIndicator = createHoldIndicator(ev);
        }
      }, 500);
    }

    // Set up movement tracking
    let hasMoved = false;
    const startX = ev.clientX;
    const startY = ev.clientY;

    // Pointer move handler to detect significant movement
    const handlePointerMove = (moveEv: PointerEvent) => {
      // Only track for this pointer
      if (componentState.activePointerId !== ev.pointerId) return;

      // Calculate movement distance
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If moved more than threshold, cancel hold
      if (distance > 10) {
        hasMoved = true;
        // Cancel hold timer
        if (componentState.holdTimer !== null) {
          clearTimeout(componentState.holdTimer);
          componentState.holdTimer = null;
        }
        componentState.pendingHoldAction = false;
      }
    };

    // Pointer up handler - CRITICAL for proper action execution
    const handlePointerUp = (_upEv: PointerEvent) => {
      // Use underscore to mark as intentionally unused
      // Clean up move listener
      window.removeEventListener('pointermove', handlePointerMove);

      // Only process if this is our tracked pointer
      if (componentState.activePointerId !== ev.pointerId) return;

      // Clear hold timer
      if (componentState.holdTimer !== null) {
        clearTimeout(componentState.holdTimer);
        componentState.holdTimer = null;
      }

      // Reset active pointer tracking
      componentState.activePointerId = null;

      // Execute proper action based on component state
      if (componentState.pendingHoldAction && !hasMoved) {
        // Execute hold action ONLY on pointer up
        Logger.debug('Executing hold action on pointer up');

        if (config.hold_action && config.hold_action.action !== 'none') {
          handleAction(config.hold_action, hass, element, entityId, toggleExpanded);
          componentState.lastActionTime = Date.now();
        }

        componentState.pendingHoldAction = false;
      }
      // Only execute tap if hold not triggered and no significant movement
      else if (!componentState.holdTriggered && !hasMoved) {
        if (config.tap_action && config.tap_action.action !== 'none') {
          Logger.debug('Executing tap action');
          handleAction(config.tap_action, hass, element, entityId, toggleExpanded);
          componentState.lastActionTime = Date.now();
        }
      }

      // Remove hold indicator if it exists
      if (componentState.holdIndicator) {
        removeHoldIndicator(componentState.holdIndicator);
        componentState.holdIndicator = null;
      }

      // Reset hold state
      componentState.holdTriggered = false;
      componentState.pendingHoldAction = false;

      // No need to remove ripple effects as our new calendar-ripple handles this
    };

    // Define handlePointerCancel function
    const handlePointerCancel = () => {
      // Clean up move listener
      window.removeEventListener('pointermove', handlePointerMove);

      // Clear hold timer
      if (componentState.holdTimer !== null) {
        clearTimeout(componentState.holdTimer);
        componentState.holdTimer = null;
      }

      // Reset tracking state
      componentState.activePointerId = null;
      componentState.holdTriggered = false;
      componentState.pendingHoldAction = false;

      // Clean up hold indicator if it exists
      if (componentState.holdIndicator && componentState.holdIndicator.parentNode) {
        removeHoldIndicator(componentState.holdIndicator);
        componentState.holdIndicator = null;
      }

      // No need to remove ripple effects as our new calendar-ripple handles this
    };

    // Add global event listeners with appropriate options
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerCancel, { once: true });
  };

  // Add event listener to the element
  element.addEventListener('pointerdown', handlePointerDown);

  // Return cleanup function
  return () => {
    element.removeEventListener('pointerdown', handlePointerDown);

    // Clean up hold indicator if needed
    if (componentState.holdIndicator && componentState.holdIndicator.parentNode) {
      componentState.holdIndicator.parentNode.removeChild(componentState.holdIndicator);
      componentState.holdIndicator = null;
    }

    Logger.debug('Component-integrated interaction cleanup complete');
  };
}
