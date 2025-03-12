/* eslint-disable import/order */
/**
 * Interaction core functionality for Calendar Card Pro
 *
 * This module handles the setup of all interaction handlers and
 * manages the interaction lifecycle.
 */

import * as Types from '../config/types';
import * as Logger from '../utils/logger';
import * as Constants from '../config/constants';
import * as Actions from './actions';
import * as Feedback from './feedback';

//-----------------------------------------------------------------------------
// CORE PUBLIC API
//-----------------------------------------------------------------------------

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
  const state: Types.InteractionState = createDefaultState();

  // Set up action handler for mdw:action events (clicks from ripple)
  const handleActionEvent = (_ev: CustomEvent) => {
    if (!hass) return;

    // Only handle click events if hold wasn't triggered
    if (!state.holdTriggered && config.tap_action) {
      Logger.debug('Executing tap action from mdw:action event');
      Actions.handleAction(config.tap_action, hass, container, entityId, toggleCallback);
    }

    // Reset hold state after any action
    state.holdTriggered = false;
  };

  // Add event listener for mdw:action events from ripple
  container.addEventListener('mdw:action', handleActionEvent as EventListener);

  // Attach ripple to container if provided
  if (ripple instanceof HTMLElement && 'attach' in ripple) {
    // Fix: Use a more specific type instead of any
    (ripple as { attach: (element: HTMLElement) => void }).attach(container);
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

          // Create hold indicator
          state.holdIndicator = Feedback.createHoldIndicator(ev, config);
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
      Actions.handleAction(config.hold_action, hass, container, entityId, toggleCallback);
    }

    // Remove hold indicator if it exists
    if (state.holdIndicator) {
      Feedback.removeHoldIndicator(state.holdIndicator);
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
      Feedback.removeHoldIndicator(state.holdIndicator);
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
      Feedback.removeHoldIndicator(state.holdIndicator);
      state.holdIndicator = null;
    }
  };

  // Add support for keyboard interactions (accessibility)
  const handleKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      // Use the tap action for keyboard events
      if (config.tap_action) {
        Actions.handleAction(config.tap_action, hass, container, entityId, toggleCallback);
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
      Feedback.removeHoldIndicator(state.holdIndicator);
    }

    // Detach ripple if provided
    if (ripple instanceof HTMLElement && 'detach' in ripple) {
      // Fix: Use a more specific type instead of any
      (ripple as { detach: () => void }).detach();
    }
  };
}

/**
 * Create a default interaction state object
 */
export function createDefaultState(): Types.InteractionState {
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
