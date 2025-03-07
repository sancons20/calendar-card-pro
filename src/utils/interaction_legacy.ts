/**
 * @deprecated - Legacy interaction code that will be replaced
 * This file contains the previous implementation for reference.
 * New code should use functions from interaction.ts instead.
 */

/* eslint-disable import/order */
/**
 * Interaction module for Calendar Card Pro
 *
 * Implements Material Design-inspired interactions with proper state management
 * and device-appropriate behavior based on Home Assistant Tile Card patterns.
 *
 * This module combines and improves the functionality previously found in actions.ts.
 *
 * Interaction patterns inspired by Home Assistant's Tile Card
 * and Material Design, both licensed under the Apache License 2.0.
 * https://github.com/home-assistant/frontend/blob/dev/LICENSE.md
 */

import * as Types from '../config/types';
import * as Logger from './logger-utils';

/**
 * Get primary entity ID from entities array
 * (Moved from actions.ts)
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
 * Handle action based on configuration
 * (Moved from actions.ts)
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
      Logger.warn(`Unknown action type: ${actionConfig.action}`);
  }
}

/**
 * Enhanced interaction setup with reliable state management
 */
export function setupInteractions(
  element: HTMLElement,
  config: Types.InteractionConfig,
): () => void {
  // Early return if no interactive actions
  if (!hasInteractiveActions(config)) {
    return () => {}; // No-op cleanup function
  }

  // Create state tracker that's isolated per interaction instance
  const state = createInteractionState();

  // Set up persistent styles for ripples and hover effects
  setupGlobalStyles();

  // Apply card styling hooks for hover effects
  if (hasInteractiveActions(config)) {
    applyInteractionStyles(element);
  }

  // Set up primary interaction listeners with proper cleanup
  const removePointerListeners = setupPointerListeners(element, config, state);

  // Return a function that cleans up everything when called
  return () => {
    removePointerListeners();
    cleanupState(state);
    Logger.info('Interaction cleanup performed');
  };
}

/**
 * Create a more robust state object with safety defaults
 * Additional flags and strict initialization for better state tracking
 */
function createInteractionState(): Types.InteractionState {
  return {
    // Pointer tracking
    activePointerId: null,
    pointerStartX: 0,
    pointerStartY: 0,
    pointerStartTime: 0,
    hasMoved: false,

    // Action state - enhanced with more explicit flags
    holdTriggered: false,
    tapPending: false,
    interactionActive: false,
    holdTimer: null,

    // Visual elements
    holdIndicator: null,
    tapRipple: null,

    // Timing with more precise tracking
    lastActionTime: 0,
    lastHoldTime: 0,
    tapDisabled: false,

    // Device detection
    isTouch: 'ontouchstart' in window,
  };
}

/**
 * Set up pointer listeners with improved state management
 * Completely rewritten to ensure proper state handling between events
 */
function setupPointerListeners(
  element: HTMLElement,
  config: Types.InteractionConfig,
  state: Types.InteractionState,
): () => void {
  // Guard against errors with complex event handling
  if (!element || !config || !state) {
    Logger.warn('Invalid parameters for setupPointerListeners');
    return () => {};
  }

  // Only set up listeners if we have actions to handle
  if (!hasInteractiveActions(config)) return () => {};

  // Make sure element can receive pointer events properly
  element.style.userSelect = 'none';
  element.style.cursor = 'pointer';
  element.style.touchAction = 'pan-y';

  // Make sure element has position for proper containing of effects
  if (window.getComputedStyle(element).position === 'static') {
    element.style.position = 'relative';
  }

  // Clear any lingering state
  cleanupState(state);

  // IMPROVED HANDLERS WITH SAFETY CHECKS

  /**
   * Robust pointer down handler with timestamps and safety guards
   */
  const handlePointerDown = (ev: PointerEvent) => {
    // Before beginning a new interaction, clean up any leftover state
    safeCleanupVisualEffects(state);

    // Safety check: Don't track multiple pointers simultaneously
    if (state.activePointerId !== null) {
      Logger.debug('Ignoring pointer down, another pointer already active');
      return;
    }

    // Reset all state flags for a clean start
    state.interactionActive = true;
    state.activePointerId = ev.pointerId;
    state.pointerStartX = ev.clientX;
    state.pointerStartY = ev.clientY;
    state.pointerStartTime = Date.now();
    state.hasMoved = false;
    state.holdTriggered = false;
    state.tapPending = true;
    state.tapDisabled = false;

    // Minimum time between hold actions to prevent accidental triggers
    const timeSinceLastHold = Date.now() - state.lastHoldTime;
    if (timeSinceLastHold < 500) {
      Logger.debug('Hold action prevented - too soon after last hold');
      return;
    }

    // Only set up hold timer if we have a valid hold action
    if (config.holdAction && config.holdAction.action !== 'none') {
      // Clear any existing timer just to be safe
      if (state.holdTimer !== null) {
        clearTimeout(state.holdTimer);
      }

      // Create a new hold timer with proper closure to capture current state
      state.holdTimer = window.setTimeout(() => {
        // Check that interaction is still valid before triggering hold
        if (
          state.activePointerId !== null &&
          !state.hasMoved &&
          state.interactionActive &&
          !state.holdTriggered
        ) {
          Logger.debug('Hold timer triggered');
          handleHoldActionStart(ev, config, state);
        }
      }, 500); // Match Tile Card's 500ms hold time
    }
  };

  /**
   * Improved pointer move handler with proper threshold detection
   */
  const handlePointerMove = (ev: PointerEvent) => {
    // Only track moves for the active pointer
    if (ev.pointerId !== state.activePointerId) return;

    // Calculate movement distance using Pythagorean theorem
    const movementX = ev.clientX - state.pointerStartX;
    const movementY = ev.clientY - state.pointerStartY;
    const movement = Math.sqrt(movementX * movementX + movementY * movementY);

    // Use 16px threshold to match Tile Card's behavior
    const MOVEMENT_THRESHOLD = 16;

    // Only set the moved flag once we cross the threshold
    if (!state.hasMoved && movement > MOVEMENT_THRESHOLD) {
      state.hasMoved = true;
      Logger.debug('Movement threshold exceeded, canceling hold/tap actions');

      // Cancel pending hold timer immediately
      cancelHoldTimer(state);

      // Also cancel any pending tap action
      state.tapPending = false;

      // Clean up any partial hold indicator
      safeCleanupVisualEffects(state);
    }
  };

  /**
   * Completely rewritten pointer up handler with clear action paths
   */
  const handlePointerUp = (ev: PointerEvent) => {
    // Only handle events for our tracked pointer
    if (ev.pointerId !== state.activePointerId) return;

    // Capture the pointer ID before resetting for use in this handler
    const pointerId = state.activePointerId;

    // First clean up the pointer tracking state
    state.activePointerId = null;

    try {
      // Cancel any pending hold timer first
      cancelHoldTimer(state);

      // HOLD ACTION PATH: Complete hold action if it was triggered
      if (state.holdTriggered && !state.hasMoved) {
        Logger.debug('Completing hold action');
        completeHoldAction(ev, config, state);

        // Store timestamp of successful hold action
        state.lastHoldTime = Date.now();

        // Explicitly disable tap to prevent double actions
        state.tapPending = false;
        state.tapDisabled = true;

        // Make sure to return early to avoid tap handling
        return;
      }

      // TAP ACTION PATH: Handle tap if allowed and not moved
      if (state.tapPending && !state.hasMoved && !state.tapDisabled) {
        const now = Date.now();

        // Implement a cooldown period to prevent rapid repeated taps
        if (now - state.lastActionTime > 300) {
          Logger.debug('Triggering tap action');

          // Update timestamp before action to prevent double triggers
          state.lastActionTime = now;

          // Execute the tap action
          handleTapAction(ev, config, state);
        } else {
          Logger.debug('Tap action prevented - too soon after last action');
        }
      }
    } finally {
      // Always reset these flags regardless of execution path
      state.holdTriggered = false;
      state.tapPending = false;
      state.interactionActive = false;

      // After a short delay, clean up visual effects
      setTimeout(() => {
        if (state.activePointerId === null) {
          safeCleanupVisualEffects(state);
        }
      }, 100);
    }
  };

  /**
   * Handle cancellation events with thorough cleanup
   */
  const handlePointerCancel = (ev: PointerEvent) => {
    // Only handle for our tracked pointer
    if (ev.pointerId !== state.activePointerId) return;

    Logger.debug('Pointer action canceled');

    // Reset all state in the correct order
    cancelHoldTimer(state);
    state.activePointerId = null;
    state.holdTriggered = false;
    state.tapPending = false;
    state.interactionActive = false;

    // Clean up visual effects safely
    safeCleanupVisualEffects(state);
  };

  /**
   * Improved click prevention for hold actions
   */
  const handleClick = (ev: MouseEvent) => {
    // Prevent click events immediately following hold actions
    if (state.tapDisabled || state.holdTriggered || Date.now() - state.lastHoldTime < 300) {
      Logger.debug('Click prevented to avoid double action');
      ev.stopPropagation();
      ev.preventDefault();

      // Reset the tap disabled flag after handling
      state.tapDisabled = false;
    }
  };

  // Add event listeners with correct options for each event type
  element.addEventListener('pointerdown', handlePointerDown, { passive: false });
  element.addEventListener('pointermove', handlePointerMove, { passive: true });
  element.addEventListener('pointerup', handlePointerUp, { passive: false });
  element.addEventListener('pointercancel', handlePointerCancel, { passive: true });
  element.addEventListener('pointerleave', handlePointerCancel, { passive: true });
  element.addEventListener('click', handleClick, { capture: true, passive: false });

  // Return a function that properly removes all event listeners
  return () => {
    element.removeEventListener('pointerdown', handlePointerDown);
    element.removeEventListener('pointermove', handlePointerMove);
    element.removeEventListener('pointerup', handlePointerUp);
    element.removeEventListener('pointercancel', handlePointerCancel);
    element.removeEventListener('pointerleave', handlePointerCancel);
    element.removeEventListener('click', handleClick, { capture: true });

    // Also ensure all state is properly cleaned up
    cleanupState(state);
  };
}

/**
 * Safely cancel hold timer if it exists
 * Extracted to a separate function for reuse and clarity
 */
function cancelHoldTimer(state: Types.InteractionState): void {
  if (state.holdTimer !== null) {
    clearTimeout(state.holdTimer);
    state.holdTimer = null;
  }
}

/**
 * Safely clean up all visual effects
 * Handles null checks and proper DOM element removal
 */
function safeCleanupVisualEffects(state: Types.InteractionState): void {
  // Clean up hold indicator
  if (state.holdIndicator) {
    try {
      if (state.holdIndicator.parentNode) {
        state.holdIndicator.parentNode.removeChild(state.holdIndicator);
      }
    } catch (e) {
      // Silently handle DOM errors
    }
    state.holdIndicator = null;
  }

  // Clean up tap ripple
  if (state.tapRipple) {
    try {
      if (state.tapRipple.parentNode) {
        state.tapRipple.parentNode.removeChild(state.tapRipple);
      }
    } catch (e) {
      // Silently handle DOM errors
    }
    state.tapRipple = null;
  }
}

/**
 * Improved Hold Action Start
 * Revised for better visual feedback and state management
 */
function handleHoldActionStart(
  ev: PointerEvent,
  _config: Types.InteractionConfig,
  state: Types.InteractionState,
): void {
  // Already triggered or moved - don't trigger again
  if (state.holdTriggered || state.hasMoved) return;

  // Mark as hold triggered right away
  state.holdTriggered = true;
  state.tapPending = false;

  // Create hold indicator
  const indicator = document.createElement('div');
  indicator.className = 'calendar-interaction-ripple hold-ripple';

  // Position safely
  const safeX = Math.max(0, ev.clientX);
  const safeY = Math.max(0, ev.clientY);

  // Set essential styles directly on element
  indicator.style.position = 'fixed';
  indicator.style.top = `${safeY}px`;
  indicator.style.left = `${safeX}px`;
  indicator.style.borderRadius = '50%';
  indicator.style.pointerEvents = 'none';
  indicator.style.zIndex = '999';
  indicator.style.transform = 'translate(-50%, -50%)';
  indicator.style.backgroundColor = '#03a9f4';

  // Add to body with error handling
  try {
    document.body.appendChild(indicator);

    // Store reference
    state.holdIndicator = indicator;

    // Use requestAnimationFrame for smoother animation
    requestAnimationFrame(() => {
      if (indicator && indicator.parentNode) {
        indicator.classList.add('active');
      }
    });
  } catch (error) {
    Logger.error('Error creating hold indicator:', error);
  }
}

/**
 * Complete hold action - fade indicator and execute action
 * Completely rewritten for reliability
 */
function completeHoldAction(
  ev: PointerEvent,
  config: Types.InteractionConfig,
  state: Types.InteractionState,
): void {
  if (!config.holdAction || config.holdAction.action === 'none') return;

  // Record the time for preventing taps immediately after a hold
  state.lastActionTime = Date.now();
  state.lastHoldTime = Date.now();

  try {
    // Execute the configured action
    const actionContext = config.context;
    handleAction(
      config.holdAction,
      actionContext.hass,
      actionContext.element,
      actionContext.entityId || '',
      actionContext.toggleCallback || (() => {}),
    );

    // Start fade animation
    if (state.holdIndicator && state.holdIndicator.parentNode) {
      state.holdIndicator.classList.add('ripple-fading');

      // Remove after animation
      setTimeout(() => {
        if (state.holdIndicator && state.holdIndicator.parentNode) {
          try {
            document.body.removeChild(state.holdIndicator);
          } catch (error) {
            // Silent fail if already removed
          }
          state.holdIndicator = null;
        }
      }, 150); // Match animation duration
    }
  } catch (error) {
    Logger.error('Error completing hold action:', error);
    safeCleanupVisualEffects(state); // Ensure cleanup even on error
  }

  // Prevent default behaviors to avoid conflicts
  ev.stopPropagation();
  ev.preventDefault();

  // Make sure hold state is reset
  state.holdTriggered = false;
}

/**
 * Enhanced cleanup function with better error handling
 */
function cleanupState(state: Types.InteractionState): void {
  // Cancel timers
  cancelHoldTimer(state);

  // Reset all flags
  state.activePointerId = null;
  state.hasMoved = false;
  state.holdTriggered = false;
  state.tapPending = false;
  state.interactionActive = false;
  state.tapDisabled = false;

  // Clean up visual elements
  safeCleanupVisualEffects(state);
}

/**
 * Create global styles with additional debugging and CSS scoping
 */
function setupGlobalStyles(): void {
  // Remove any existing style element to ensure we're not conflicting
  const existingStyle = document.getElementById('calendar-card-interaction-style');
  if (existingStyle) {
    try {
      existingStyle.parentNode?.removeChild(existingStyle);
      Logger.info('Removed existing interaction styles');
    } catch (e) {
      Logger.error('Failed to remove existing styles:', e);
    }
  }

  // Create a new style element with extremely high specificity
  const styleElem = document.createElement('style');
  styleElem.id = 'calendar-card-interaction-style';

  // Use !important and direct descendant selectors for maximum override power
  styleElem.textContent = `
    /* Add additional animation debugging */
    @keyframes debug-blink {
      0%, 100% { outline: 2px solid rgba(255,0,0,0); }
      50% { outline: 2px solid rgba(255,0,0,0.5); }
    }

    /* Make hover effects extremely specific and important */
    @media (hover: hover) {
      html body .hover-effect-target,
      html body div.card-container.card-interactive,
      html body ha-card.card-interactive,
      html body div.card-interactive ha-card {
        cursor: pointer !important;
        transition: transform 180ms ease-in-out, box-shadow 180ms ease-in-out !important;
        will-change: transform, box-shadow !important;
        position: relative !important;
        overflow: visible !important;
      }
      
      html body .hover-effect-target:hover,
      html body div.card-container.card-interactive:hover,
      html body ha-card.card-interactive:hover,
      html body div.card-interactive ha-card:hover {
        box-shadow: var(--ha-card-box-shadow, 
                     0 2px 2px 0 rgba(0, 0, 0, 0.14), 
                     0 1px 5px 0 rgba(0, 0, 0, 0.12), 
                     0 3px 1px -2px rgba(0, 0, 0, 0.2)) !important;
        transform: translateY(-2px) !important;
        z-index: 1 !important;
      }
    }

    /* Direct inline style version of ripple container */
    .card-ripple-container {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      overflow: hidden !important;
      border-radius: var(--ha-card-border-radius, 4px) !important;
      pointer-events: none !important;
      z-index: 1 !important;
      width: 100% !important;
      height: 100% !important;
    }

    /* Force visiblity of ripples */
    .card-ripple {
      position: absolute !important;
      border-radius: 50% !important;
      background-color: var(--primary-color, currentColor) !important; 
      opacity: 0 !important;
      pointer-events: none !important;
      z-index: 1 !important;
      will-change: transform, opacity !important;
    }
    
    /* Utility class for animations */
    .ripple-animate {
      opacity: 0.15 !important;
      transform: scale(1) !important;
      transition: opacity 300ms linear, transform 300ms cubic-bezier(0.4, 0, 0.2, 1) !important;
    }

    /* Rest of styles omitted for brevity... */
    /* ...existing styles... */
  `;

  // Insert the style element at the end of the head for maximum cascade priority
  document.head.appendChild(styleElem);
  Logger.info('Global interaction styles applied with enhanced visibility');
}

/**
 * Apply interaction-specific styles to the element
 * Fixed to ensure hover effects work by targeting the right DOM elements
 */
function applyInteractionStyles(element: HTMLElement): void {
  Logger.info('Applying interaction styles to element', {
    tagName: element.tagName,
    classes: element.className,
  });

  // Strategy 1: Add interactive class to the element itself
  element.classList.add('card-interactive');

  // HOVER EFFECT FIX: Add ha-card class if missing to ensure hover styles apply
  element.classList.add('hover-effect-target');

  // Set pointer cursor for interactive elements
  element.style.cursor = 'pointer';

  // Strategy 2: Look for ha-card children and apply interactive class to them
  const haCards = element.querySelectorAll('ha-card');
  if (haCards.length) {
    Logger.info('Found ha-card children, applying styles', { count: haCards.length });
    haCards.forEach((card) => {
      card.classList.add('card-interactive');
      card.classList.add('hover-effect-target');
    });
  }

  // Strategy 3: If element or any parent is ha-card or card-container, ensure it has the right classes
  let current: HTMLElement | null = element;
  while (current) {
    if (
      current.classList.contains('card-container') ||
      current.tagName.toLowerCase() === 'ha-card'
    ) {
      Logger.info('Found card parent, applying styles', {
        element: current.tagName,
        classes: current.className,
      });
      current.classList.add('card-interactive');
      current.classList.add('hover-effect-target');
    }
    current = current.parentElement;
  }

  // Prepare the element for ripple effects
  if (window.getComputedStyle(element).position === 'static') {
    element.style.position = 'relative';
  }

  // RIPPLE CONTAINER FIX: Make sure the ripple container exists and is properly positioned
  ensureRippleContainer(element);
}

/**
 * Ensure ripple container exists and is properly set up
 */
function ensureRippleContainer(element: HTMLElement): void {
  // First remove any existing ripple containers to avoid duplicates
  const existingContainers = element.querySelectorAll('.card-ripple-container');
  existingContainers.forEach((container) => {
    try {
      container.parentNode?.removeChild(container);
    } catch (e) {
      // Ignore errors
    }
  });

  // Create a new ripple container
  const rippleContainer = document.createElement('div');
  rippleContainer.className = 'card-ripple-container';

  // Ensure it has the right styles directly applied (backup for CSS)
  rippleContainer.style.position = 'absolute';
  rippleContainer.style.top = '0';
  rippleContainer.style.left = '0';
  rippleContainer.style.right = '0';
  rippleContainer.style.bottom = '0';
  rippleContainer.style.overflow = 'hidden';
  rippleContainer.style.pointerEvents = 'none';
  rippleContainer.style.zIndex = '1';
  rippleContainer.style.borderRadius = 'var(--ha-card-border-radius, 4px)';

  // Make sure it's the first child for proper layering
  if (element.firstChild) {
    element.insertBefore(rippleContainer, element.firstChild);
  } else {
    element.appendChild(rippleContainer);
  }

  Logger.info('Ripple container created and properly positioned');
}

/**
 * Handle tap action with fixed ripple effect implementation
 */
function handleTapAction(
  ev: PointerEvent,
  config: Types.InteractionConfig,
  state: Types.InteractionState,
): void {
  if (!config.tapAction || config.tapAction.action === 'none') return;

  // Find the card container element - use the currentTarget which is what the listener is on
  const target = ev.currentTarget as HTMLElement;

  // Debug log the tap action and target
  Logger.info('Tap action triggered', {
    action: config.tapAction.action,
    target: target?.tagName,
    targetClasses: target?.className,
  });

  // First create ripple for visual feedback, then execute action
  createRippleEffect(ev, target);

  // Update last action time
  state.lastActionTime = Date.now();

  // Execute action immediately
  const actionContext = config.context;
  handleAction(
    config.tapAction,
    actionContext.hass,
    actionContext.element,
    actionContext.entityId || '',
    actionContext.toggleCallback || (() => {}),
  );

  // Prevent default browser actions
  ev.stopPropagation();
  ev.preventDefault();
}

/**
 * Create ripple effect with direct DOM manipulation
 * This version uses direct style changes instead of animations
 */
function createRippleEffect(ev: PointerEvent, element: HTMLElement): void {
  Logger.info('Creating ripple effect', {
    x: ev.clientX,
    y: ev.clientY,
    element: element.tagName,
    elementId: element.id,
    classes: element.className,
  });

  // Get the card dimensions
  const rect = element.getBoundingClientRect();
  Logger.info('Card rect', {
    width: rect.width,
    height: rect.height,
    left: rect.left,
    top: rect.top,
  });

  try {
    // Create container directly on element
    let rippleContainer: HTMLDivElement;
    const existingContainer = element.querySelector('.card-ripple-container') as HTMLDivElement;

    if (existingContainer) {
      // Clear any existing ripples
      while (existingContainer.firstChild) {
        existingContainer.removeChild(existingContainer.firstChild);
      }
      rippleContainer = existingContainer;
      Logger.info('Using existing ripple container');
    } else {
      // Create new container with force rendering styles
      rippleContainer = document.createElement('div');
      rippleContainer.className = 'card-ripple-container';

      // Set critical styles directly (shadowDOM-proof)
      rippleContainer.style.cssText = `
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: ${rect.width}px !important;
        height: ${rect.height}px !important;
        overflow: hidden !important;
        pointer-events: none !important;
        z-index: 1 !important;
        border-radius: var(--ha-card-border-radius, 4px);
      `;

      // Insert as first child for proper z-ordering
      if (element.firstChild) {
        element.insertBefore(rippleContainer, element.firstChild);
      } else {
        element.appendChild(rippleContainer);
      }
      Logger.info('Created new ripple container');
    }

    // Create the ripple with forced visibility
    const ripple = document.createElement('div');
    ripple.className = 'card-ripple';

    // Calculate position and size based on tap location
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    // Make sure ripple is big enough to cover the card diagonally
    const maxDim = Math.max(rect.width, rect.height);
    const rippleSize = maxDim * 2.5; // Extra large for full coverage

    Logger.info('Ripple parameters', { x, y, size: rippleSize });

    // Set critical styles directly on element (shadowDOM-proof)
    ripple.style.cssText = `
      position: absolute !important;
      width: ${rippleSize}px !important;
      height: ${rippleSize}px !important;
      left: ${x - rippleSize / 2}px !important;
      top: ${y - rippleSize / 2}px !important;
      border-radius: 50% !important;
      background-color: var(--primary-color, currentColor) !important;
      opacity: 0 !important;
      transform: scale(0) !important;
      pointer-events: none !important;
      z-index: 1 !important;
      will-change: transform, opacity !important;
      animation: debug-blink 1s infinite; /* Debug animation */
    `;

    // Add ripple to container and force a layout calculation
    rippleContainer.appendChild(ripple);
    ripple.offsetWidth; // Force reflow

    // Apply animation class in next frame
    requestAnimationFrame(() => {
      Logger.info('Applying ripple animation');
      ripple.style.transition =
        'opacity 300ms linear, transform 300ms cubic-bezier(0.4, 0, 0.2, 1) !important';
      ripple.style.transform = 'scale(1) !important';
      ripple.style.opacity = '0.15 !important';

      // Also add class as a backup animation method
      ripple.classList.add('ripple-animate');
    });

    // Remove the ripple after animation
    setTimeout(() => {
      if (ripple.parentNode) {
        Logger.info('Fading out ripple');
        ripple.style.opacity = '0 !important';

        setTimeout(() => {
          try {
            if (ripple.parentNode) {
              ripple.parentNode.removeChild(ripple);
              Logger.info('Removed ripple element');
            }
          } catch (e) {
            Logger.error('Error removing ripple:', e);
          }
        }, 300);
      }
    }, 300);
  } catch (error) {
    Logger.error('Error in createRippleEffect:', error);
  }
}

/**
 * Check if config has any interactive actions
 */
function hasInteractiveActions(config: Types.InteractionConfig): boolean {
  // Apply null/undefined check first and return false
  if (!config || (!config.tapAction && !config.holdAction)) return false;

  return (
    // Use nullish coalescing to ensure we check against 'none' only when action exists
    config.tapAction?.action !== 'none' || config.holdAction?.action !== 'none' || false
  ); // Explicitly return false if all tests fail
}

/**
 * Fire a Home Assistant more-info event
 * (Moved from actions.ts)
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
 * (Moved from actions.ts)
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
 * (Moved from actions.ts)
 *
 * @param hass - Home Assistant instance
 * @param actionConfig - Action configuration
 */
export function callService(hass: Types.Hass, actionConfig: Types.ActionConfig): void {
  if (!actionConfig.service) return;

  const [domain, service] = actionConfig.service.split('.');
  if (!domain || !service) {
    Logger.error(`Invalid service: ${actionConfig.service}`);
    return;
  }

  const serviceData = actionConfig.service_data || {};
  hass.callService(domain, service, serviceData);
}

/**
 * Open a URL
 * (Moved from actions.ts)
 *
 * @param actionConfig - Action configuration
 */
export function openUrl(actionConfig: Types.ActionConfig): void {
  if (!actionConfig.url_path) return;

  window.open(actionConfig.url_path, '_blank');
}

/**
 * Remove ripple element from the DOM with proper cleanup
 */
function cleanupRippleElement(element: HTMLElement | null): void {
  if (element && element.parentNode) {
    document.body.removeChild(element);
  }
}

/**
 * Direct shadow DOM handler for interaction module
 * Creates globally unique style element with highest specificity
 */
function applyGlobalShadowDomStyles(): void {
  // Create main style element if it doesn't exist
  if (!document.getElementById('calendar-card-shadow-styles')) {
    const shadowStyle = document.createElement('style');
    shadowStyle.id = 'calendar-card-shadow-styles';

    // Use extremely high specificity and use custom properties
    shadowStyle.textContent = `
      /* Define custom properties for interactions */
      html {
        --calendar-card-hover-transform: translateY(-2px);
        --calendar-card-hover-shadow: var(--ha-card-box-shadow, 
                                      0 2px 2px 0 rgba(0, 0, 0, 0.14), 
                                      0 1px 5px 0 rgba(0, 0, 0, 0.12), 
                                      0 3px 1px -2px rgba(0, 0, 0, 0.2));
        --calendar-card-ripple-color: var(--primary-color, currentColor);
        --calendar-card-ripple-opacity: 0.15;
      }
      
      /* Boost selector specificity for hover effects */
      html body .hover-effect-target:hover,
      html body div.card-container.card-interactive:hover,
      html body ha-card.card-interactive:hover,
      html body div.card-interactive ha-card:hover,
      html body *[data-interactive="true"]:hover {
        box-shadow: var(--calendar-card-hover-shadow) !important;
        transform: var(--calendar-card-hover-transform) !important;
        z-index: 1 !important;
      }
      
      /* Force extra visibility on ripples */
      html body .card-ripple {
        visibility: visible !important;
        display: block !important;
        opacity: var(--calendar-card-ripple-opacity) !important;
      }
    `;

    // Add to document head
    document.head.appendChild(shadowStyle);
    Logger.info('Applied global shadow DOM interaction styles');
  }
}

/**
 * Initialize the interaction module once on load
 */
(function initializeInteractionModule() {
  // Set up global styles only once
  setupGlobalStyles();

  // Apply shadow DOM penetrating styles
  applyGlobalShadowDomStyles();

  Logger.info('Interaction module initialized');
})();

/**
 * Get Shadow DOM compatible styles for interactions
 * Separate function to get style text that can be inserted directly into shadow DOM
 *
 * @returns {string} CSS styles text for direct inclusion in shadow DOM
 */
export function getShadowStyles(): string {
  return `
    /* Direct Hover Effect Styles */
    @media (hover: hover) {
      .card-container {
        transition: transform 180ms ease-in-out, box-shadow 180ms ease-in-out !important;
        will-change: transform, box-shadow !important;
      }
      
      .card-container:hover {
        box-shadow: var(--ha-card-box-shadow, 
                    0 2px 2px 0 rgba(0, 0, 0, 0.14), 
                    0 1px 5px 0 rgba(0, 0, 0, 0.12), 
                    0 3px 1px -2px rgba(0, 0, 0, 0.2)) !important;
        transform: translateY(-2px) !important;
      }
    }
    
    /* Direct Ripple Styles */
    .card-ripple-container {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      overflow: hidden !important;
      pointer-events: none !important;
      z-index: 1 !important;
    }
    
    .card-ripple {
      position: absolute !important;
      border-radius: 50% !important;
      background-color: var(--primary-color, currentColor) !important;
      opacity: 0;
      pointer-events: none !important;
      transition: opacity 300ms linear, transform 300ms cubic-bezier(0.4, 0, 0.2, 1) !important;
      z-index: 1 !important;
    }
    
    .ripple-animate {
      opacity: 0.15 !important;
      transform: scale(1) !important;
    }
  `;
}

/**
 * Create a style element with interaction styles for shadow DOM
 * @returns {HTMLStyleElement} Style element with interaction styles
 */
export function createShadowStyleElement(): HTMLStyleElement {
  const styleElement = document.createElement('style');
  styleElement.id = 'shadow-interaction-styles';
  styleElement.textContent = getShadowStyles();
  return styleElement;
}

/**
 * Enhanced interaction setup specifically for shadow DOM environments
 */
export function setupShadowDomInteractions(
  element: HTMLElement,
  config: Types.InteractionConfig,
  shadowRoot: ShadowRoot,
): () => void {
  // Standard setup
  const cleanup = setupInteractions(element, config);

  // Add shadow DOM specific styles
  const styleElement = createShadowStyleElement();
  shadowRoot.appendChild(styleElement);

  // Return enhanced cleanup function
  return () => {
    cleanup();
    if (styleElement.parentNode) {
      styleElement.parentNode.removeChild(styleElement);
    }
  };
}
