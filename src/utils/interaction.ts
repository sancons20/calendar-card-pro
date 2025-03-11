/* eslint-disable import/order */
/**
 * Interaction module for Calendar Card Pro
 *
 * Handles all user interactions including:
 * - Tap/click actions
 * - Hold/long-press actions
 * - Visual feedback (ripples, hold indicators)
 * - Action execution
 */

import * as Types from '../config/types';
import * as Logger from './logger-utils';
import * as Constants from '../config/constants';

//-----------------------------------------------------------------------------
// CORE PUBLIC API
//-----------------------------------------------------------------------------

/**
 * Interaction state for tracking pointer events and visual feedback
 */
export interface InteractionState {
  // Pointer tracking
  activePointerId: number | null;

  // Action state
  holdTriggered: boolean;
  holdTimer: number | null;
  pendingHoldAction: boolean;

  // Visual elements
  holdIndicator: HTMLElement | null;
  lastPointerEvent: PointerEvent | null;

  // Timing
  lastActionTime: number;
}

/**
 * Set up interaction handlers for a card element
 *
 * @param config - Card configuration
 * @param container - Card container element
 * @param hass - Home Assistant interface
 * @param entityId - Optional entity ID for actions
 * @param toggleCallback - Optional callback for toggle action
 * @param ripple - Optional ripple element for visual feedback
 * @returns Cleanup function to remove event listeners
 */
export function setupInteractions(
  config: Types.Config,
  container: HTMLElement,
  hass: Types.Hass | null,
  entityId: string | undefined,
  toggleCallback?: () => void,
  ripple?: HTMLElement,
): () => void {
  // Create interaction state
  const state: InteractionState = createDefaultState();

  // Set up action handler for mdw:action events (clicks from ripple)
  const handleActionEvent = (_ev: CustomEvent) => {
    if (!hass) return;

    // Only handle click events if hold wasn't triggered
    if (!state.holdTriggered && config.tap_action) {
      Logger.debug('Executing tap action from mdw:action event');
      handleAction(config.tap_action, hass, container, entityId, toggleCallback);
    }

    // Reset hold state after any action
    state.holdTriggered = false;
  };

  // Add event listener for mdw:action events from ripple
  container.addEventListener('mdw:action', handleActionEvent as EventListener);

  // Attach ripple to container if provided
  if (ripple instanceof HTMLElement && 'attach' in ripple) {
    (ripple as any).attach(container);
  }

  // Handle pointer down - start hold timer
  const handlePointerDown = (ev: PointerEvent) => {
    // Track this pointer
    state.activePointerId = ev.pointerId;
    state.holdTriggered = false;
    state.lastPointerEvent = ev;

    // Only set up hold timer if hold action is configured
    if (config.hold_action?.action !== 'none') {
      // Clear any existing timer
      if (state.holdTimer) {
        clearTimeout(state.holdTimer);
      }

      // Start hold timer
      state.holdTimer = window.setTimeout(() => {
        if (state.activePointerId === ev.pointerId) {
          Logger.debug('Hold threshold reached');
          state.holdTriggered = true;

          // Create hold indicatorconfig);
          state.holdIndicator = createHoldIndicator(ev, config);
        }
      }, Constants.TIMING.HOLD_THRESHOLD);
    }
  };

  // Handle pointer up - check if hold was triggered
  const handlePointerUp = (ev: PointerEvent) => {
    // Only process if this is the tracked pointer
    if (state.activePointerId !== ev.pointerId) return;

    // Clear hold timer
    if (state.holdTimer) {
      clearTimeout(state.holdTimer);
      state.holdTimer = null;
    }

    // Reset pointer tracking
    state.activePointerId = null;

    // If hold was triggered, handle hold action
    if (state.holdTriggered && config.hold_action) {
      Logger.debug('Executing hold action on pointer up');
      handleAction(config.hold_action, hass, container, entityId, toggleCallback);
    }

    // Remove hold indicator if it exists
    if (state.holdIndicator) {
      removeHoldIndicator(state.holdIndicator);
      state.holdIndicator = null;
    }
  };

  // Handle pointer cancel
  const handlePointerCancel = () => {
    // Clear hold timer
    if (state.holdTimer) {
      clearTimeout(state.holdTimer);
      state.holdTimer = null;
    }

    // Reset tracking state
    state.activePointerId = null;
    state.holdTriggered = false;

    // Remove hold indicator if it exists
    if (state.holdIndicator) {
      removeHoldIndicator(state.holdIndicator);
      state.holdIndicator = null;
    }
  };

  // Handle pointer leave - clean up hold state when pointer leaves the card
  const handlePointerLeave = () => {
    // Clear hold timer
    if (state.holdTimer) {
      clearTimeout(state.holdTimer);
      state.holdTimer = null;
    }

    // Reset tracking state
    state.activePointerId = null;
    state.holdTriggered = false;

    // Remove hold indicator if it exists
    if (state.holdIndicator) {
      Logger.debug('Removing hold indicator on pointer leave');
      removeHoldIndicator(state.holdIndicator);
      state.holdIndicator = null;
    }
  };

  // Add support for keyboard interactions (accessibility)
  const handleKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      // Use the tap action for keyboard events
      if (config.tap_action) {
        handleAction(config.tap_action, hass, container, entityId, toggleCallback);
      }
    }
  };

  // Add all event listeners
  container.addEventListener('mdw:action', handleActionEvent as EventListener);
  container.addEventListener('keydown', handleKeyDown);
  container.addEventListener('pointerdown', handlePointerDown);
  container.addEventListener('pointerup', handlePointerUp);
  container.addEventListener('pointercancel', handlePointerCancel);
  container.addEventListener('pointerleave', handlePointerLeave);

  // Return cleanup function
  return () => {
    container.removeEventListener('mdw:action', handleActionEvent as EventListener);
    container.removeEventListener('keydown', handleKeyDown);
    container.removeEventListener('pointerdown', handlePointerDown);
    container.removeEventListener('pointerup', handlePointerUp);
    container.removeEventListener('pointercancel', handlePointerCancel);
    container.removeEventListener('pointerleave', handlePointerLeave);

    // Clear any active timers
    if (state.holdTimer) {
      clearTimeout(state.holdTimer);
    }

    // Clean up hold indicator if it exists
    if (state.holdIndicator) {
      removeHoldIndicator(state.holdIndicator);
    }

    // Detach ripple if provided
    if (ripple instanceof HTMLElement && 'detach' in ripple) {
      (ripple as any).detach();
    }
  };
}

/**
 * Handle an action based on its configuration
 *
 * @param actionConfig - Action configuration object
 * @param hass - Home Assistant interface
 * @param element - Element that triggered the action
 * @param entityId - Optional entity ID for the action
 * @param toggleCallback - Optional callback for toggle action
 */
export function handleAction(
  actionConfig: Types.ActionConfig,
  hass: Types.Hass | null,
  element: Element,
  entityId?: string,
  toggleCallback?: () => void,
): void {
  if (!actionConfig || !hass) return;

  const ctx: Types.ActionContext = {
    element,
    hass,
    entityId,
    toggleCallback,
  };

  // Execute different types of actions based on the configuration
  switch (actionConfig.action) {
    case 'more-info':
      fireMoreInfo(entityId, ctx);
      break;

    case 'navigate':
      if (actionConfig.navigation_path) {
        navigate(actionConfig.navigation_path, ctx);
      }
      break;

    case 'url':
      if (actionConfig.url_path) {
        openUrl(actionConfig.url_path, ctx);
      }
      break;

    case 'toggle':
      if (toggleCallback) {
        toggleCallback();
      }
      break;

    case 'expand': // Add this case to handle the expand action
      if (toggleCallback) {
        toggleCallback();
      }
      break;

    case 'call-service': {
      if (!actionConfig.service) return;

      const [domain, service] = actionConfig.service.split('.', 2);
      if (!domain || !service) return;

      hass.callService(domain, service, actionConfig.service_data || {});
      break;
    }

    case 'fire-dom-event': {
      fireDomEvent(element, ctx);
      break;
    }

    case 'none':
    default:
      // Do nothing for 'none' action
      break;
  }
}

/**
 * Create a default interaction state object
 */
export function createDefaultState(): InteractionState {
  return {
    activePointerId: null,
    holdTriggered: false,
    holdTimer: null,
    pendingHoldAction: false,
    holdIndicator: null,
    lastPointerEvent: null,
    lastActionTime: 0,
  };
}

/**
 * Extract primary entity ID from configured entities
 *
 * @param entities - Entity configuration array
 * @returns The primary entity ID or undefined if not available
 */
export function getPrimaryEntityId(
  entities: Array<string | Types.EntityConfig>,
): string | undefined {
  if (!entities || !entities.length) return undefined;

  const firstEntity = entities[0];
  return typeof firstEntity === 'string' ? firstEntity : firstEntity.entity;
}

//-----------------------------------------------------------------------------
// VISUAL FEEDBACK FUNCTIONS
//-----------------------------------------------------------------------------

/**
 * Create a visual hold indicator at pointer position
 *
 * @param event - Pointer event that triggered the hold
 * @param config - Card configuration to use for styling
 * @returns The created hold indicator element
 */
export function createHoldIndicator(event: PointerEvent, config: Types.Config): HTMLElement {
  // Create hold indicator
  const holdIndicator = document.createElement('div');

  // Configure the visual appearance
  holdIndicator.style.position = 'absolute';
  holdIndicator.style.pointerEvents = 'none';
  holdIndicator.style.borderRadius = '50%';
  holdIndicator.style.backgroundColor = config.vertical_line_color;
  holdIndicator.style.opacity = `${Constants.UI.HOLD_INDICATOR_OPACITY}`;
  holdIndicator.style.transform = 'translate(-50%, -50%) scale(0)';
  holdIndicator.style.transition = `transform ${Constants.TIMING.HOLD_INDICATOR_TRANSITION}ms ease-out`;

  // Set position based on pointer event
  holdIndicator.style.left = event.pageX + 'px';
  holdIndicator.style.top = event.pageY + 'px';

  // Choose size based on interaction type (touch vs mouse)
  const isTouchEvent = event.pointerType === 'touch';
  const size = isTouchEvent
    ? Constants.UI.HOLD_INDICATOR.TOUCH_SIZE
    : Constants.UI.HOLD_INDICATOR.POINTER_SIZE;

  holdIndicator.style.width = `${size}px`;
  holdIndicator.style.height = `${size}px`;

  // Add to body
  document.body.appendChild(holdIndicator);

  // Trigger animation
  setTimeout(() => {
    holdIndicator.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);

  Logger.debug('Created hold indicator');
  return holdIndicator;
}

/**
 * Remove a hold indicator with animation
 *
 * @param indicator - Hold indicator element to remove
 */
export function removeHoldIndicator(indicator: HTMLElement): void {
  // Fade out animation
  indicator.style.opacity = '0';
  indicator.style.transition = `opacity ${Constants.TIMING.HOLD_INDICATOR_FADEOUT}ms ease-out`;

  // Remove after animation completes
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
      Logger.debug('Removed hold indicator');
    }
  }, Constants.TIMING.HOLD_INDICATOR_FADEOUT);
}

/**
 * Clean up all hold indicators in the document
 * Safety mechanism to prevent orphaned indicators
 */
export function cleanupAllHoldIndicators(): void {
  const holdIndicators = document.querySelectorAll('div[style*="pointer-events: none"]');
  if (holdIndicators.length > 0) {
    Logger.debug(`Cleaning up ${holdIndicators.length} orphaned hold indicators`);
    holdIndicators.forEach((indicator) => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    });
  }
}

//-----------------------------------------------------------------------------
// PRIVATE ACTION HANDLERS
//-----------------------------------------------------------------------------

/**
 * Fire more-info event for an entity
 *
 * @param entityId - Entity ID to show more info for
 * @param ctx - Action context
 */
function fireMoreInfo(entityId: string | undefined, ctx: Types.ActionContext): void {
  if (!entityId) return;

  // Create and dispatch a Home Assistant more-info event
  const event = new CustomEvent('hass-more-info', {
    bubbles: true,
    composed: true,
    detail: { entityId },
  });

  ctx.element.dispatchEvent(event);
  Logger.debug(`Fired more-info event for ${entityId}`);
}

/**
 * Navigate to a path in Home Assistant
 *
 * @param path - Navigation path
 * @param ctx - Action context
 */
function navigate(path: string, ctx: Types.ActionContext): void {
  // Create and dispatch a location-changed event
  const event = new CustomEvent('location-changed', {
    bubbles: true,
    composed: true,
    detail: { replace: false },
  });

  // Use window.history for navigation
  if (window.history) {
    window.history.pushState(null, '', path);
  }

  // Dispatch the event to notify HA of the navigation
  ctx.element.dispatchEvent(event);
  Logger.debug(`Navigated to ${path}`);
}

/**
 * Open a URL in a new tab or the current window
 *
 * @param path - URL to open
 * @param ctx - Action context
 */
function openUrl(path: string, _ctx: Types.ActionContext): void {
  window.open(path, '_blank');
  Logger.debug(`Opened URL ${path}`);
}

/**
 * Fire a DOM event for custom handlers
 *
 * @param element - Element to fire the event from
 * @param ctx - Action context
 */
function fireDomEvent(element: Element, _ctx: Types.ActionContext): void {
  const event = new Event('calendar-card-action', {
    bubbles: true,
    composed: true,
  });

  element.dispatchEvent(event);
  Logger.debug('Fired DOM event calendar-card-action');
}
