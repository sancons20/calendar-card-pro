# Calendar Card Pro: Interaction System

This document outlines our implementation plan for the Calendar Card Pro interaction system and captures key technical insights discovered during development.

## Table of Contents

- [Implementation Plan](#implementation-plan)
  - [Phase 1: Study HA Tile Card Implementation](#phase-1-study-ha-tile-card-implementation-1-day)
  - [Phase 2: Incremental Implementation & Migration](#phase-2-incremental-implementation--migration-2-3-days)
  - [Phase 3: Polish & Styling Refinement](#phase-3-polish--styling-refinement-1-2-days)
  - [Phase 4: Consolidation & Cleanup](#phase-4-consolidation--cleanup-1-day)
  - [Testing Methodology](#testing-methodology)
- [Technical Learnings](#technical-learnings)
  - [DOM Structure and Z-Index](#dom-structure-and-z-index)
  - [Ripple Effect Implementation](#ripple-effect-implementation)
  - [Event Handling Patterns](#event-handling-patterns)
  - [Navigation View Resilience](#navigation-view-resilience)
  - [Styling Best Practices](#styling-best-practices)
- [HA Tile Card Reference (v2025.3)](#ha-tile-card-reference-v20253)
  - [Visual Specifications](#visual-specifications)
  - [Interaction Patterns](#interaction-patterns)
  - [Animation Specifications](#animation-specifications)
  - [Element Structure](#element-structure)
  - [Visual Comparison Chart](#visual-comparison-chart)

## Implementation Plan

### Phase 1: Study HA Tile Card Implementation (1 day)

1. **Analyze Native HA Tile Card Behavior**

   - Study the latest HA implementation (2025.3) to match their interaction patterns
   - Document exact ripple color, opacity, timing, and animation curves
   - Note the specific transition from tap effect to hold effect (no progress indicator)

2. **Create Reference Documentation**
   - Document visual specifications for all effects (tap, hold, hover)
   - Create a simple visual comparison chart for consistent reference

### Phase 2: Incremental Implementation & Migration (2-3 days)

Instead of creating a separate implementation and then migrating, we'll use an incremental approach:

1. **Create Base Interaction Module Structure**

   - Set up basic structure in `interaction.ts`
   - Define clear interfaces and exported functions

2. **Migrate One Effect at a Time** (incremental approach)

   - **Step 1**: Move DOM structure creation to `interaction.ts` while keeping event handlers in main file
   - **Step 2**: Build and test ripple effect creation in `interaction.ts` and call from main file
   - **Step 3**: Move action handling to `interaction.ts` and call from main file
   - **Step 4**: Finalize by moving all remaining interaction code to `interaction.ts`

   This allows testing each change independently before proceeding.

3. **Test After Each Migration Step**
   - Build and test in Home Assistant after each discrete change
   - Fix any issues before continuing to next component

### Phase 3: Polish & Styling Refinement (1-2 days)

1. **Match HA Tile Card Styling Precisely**

   - Fine-tune ripple color, opacity, timing to match HA tile card
   - Implement exact tap → hold transition effect (without progress indicator)
   - Ensure hover effects match HA's implementation

2. **Navigation Resilience**
   - Implement proper cleanup and re-attachment on navigation
   - Test across multiple dashboard views

### Phase 4: Consolidation & Cleanup (1 day)

1. **Remove Duplicate Code**

   - Once the migrated code is fully working, remove old implementations
   - Eliminate any temporary scaffolding used during migration

2. **Documentation & Performance Optimization**
   - Add inline documentation explaining interaction patterns
   - Add comments referencing HA's implementation for future maintenance
   - Optimize any performance bottlenecks discovered during testing

### Testing Methodology

For each incremental change:

1. **Build and deploy** the card to your Home Assistant instance
2. **Verify** that the specific functionality works as expected
3. **Compare** with native HA tile card to ensure visual/behavioral consistency
4. If issues occur, we can easily identify the specific change that caused the problem

This approach eliminates the need for a feature flag or toggle switch, as we're never replacing the entire interaction system at once, but rather migrating it piece by piece with testing at each step.

## Technical Learnings

This section documents the key technical insights and solutions discovered during the development of the interaction system.

### DOM Structure and Z-Index

#### The Challenge

Our initial implementation applied background colors directly to the card container, causing ripple effects (implemented as pseudo-elements) to be hidden behind the background. This created an invisible ripple effect on solid-colored backgrounds.

#### The Solution

We created a three-layer DOM structure with explicit z-index stacking:

Key Insights:

- The background must be a separate DOM element, not a background property of a container
- The container element must have background: transparent !important to avoid overlapping the ripple
- All child elements of content must also have transparent backgrounds
- Using isolation: isolate on the container creates a proper stacking context

Effective CSS Structure

```ts
/* Base container with stacking context */
.card-container {
  position: relative;
  background: transparent !important;
  isolation: isolate; /* Creates stacking context */
}

/* Background layer */
.card-bg-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  background-color: var(--ha-card-background);
  border-radius: var(--ha-card-border-radius);
}

/* Ripple container */
.card-ripple-container {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: hidden;
  border-radius: var(--ha-card-border-radius);
}

/* Content layer */
.card-content-layer {
  position: relative;
  z-index: 3;
  background: transparent !important;
}

/* Force transparency for content children */
.card-content-layer > * {
  background-color: transparent !important;
}
```

### Ripple Effect Implementation

#### The Challenge

Our initial pseudo-element ripple implementation (::after) was invisible on solid-color backgrounds and couldn't be properly positioned above the background but below content.

#### The Solution

We switched to a DOM-based approach, dynamically creating ripple elements:

```ts
// Create ripple element
const ripple = document.createElement('div');
ripple.className = 'card-ripple';

// Set size and position
ripple.style.width = ripple.style.height = `${size}px`;
ripple.style.left = `${x}px`;
ripple.style.top = `${y}px`;

// Add to container and animate
rippleContainer.appendChild(ripple);
requestAnimationFrame(() => {
  ripple.style.opacity = '0.35';
  ripple.style.transform = 'translate(-50%, -50%) scale(1)';

  // Clean up after animation
  setTimeout(() => {
    ripple.style.opacity = '0';
    setTimeout(() => ripple.remove(), 300);
  }, 300);
});
```

Key Insights:

- DOM elements provide more control than pseudo-elements for dynamic effects
- Using requestAnimationFrame() ensures smooth animations
- Setting will-change: transform, opacity improves performance
- Higher opacity values (0.35 instead of 0.2) improve visibility on light backgrounds
- Self-removing ripples prevent memory leaks

Effective Ripple Styling

```ts
.card-ripple {
  position: absolute;
  border-radius: 50%;
  background-color: var(--primary-text-color, rgba(0,0,0,0.3));
  opacity: 0;
  transform: scale(0);
  pointer-events: none;
  will-change: transform, opacity;
  transition: opacity 300ms ease-out, transform 300ms ease-out;
}
```

### Event Handling Patterns

#### The Challenge

Our initial implementation had inconsistent behavior with tap/hold actions - sometimes triggering both actions, sometimes not triggering any, and often losing events after navigation changes.

#### The Solution

We implemented a proper pointer event handling system with explicit state tracking:

```ts
// On pointer down
const handlePointerDown = (ev) => {
  // Track state
  touchState.holdTriggered = false;

  // Create visual ripple effect
  createRippleEffect(ev);

  // Set up hold timer
  touchState.holdTimer = setTimeout(() => {
    touchState.holdTriggered = true;
    handleAction(config.hold_action);
  }, 500);

  // Set up global handlers
  window.addEventListener('pointerup', handlePointerUp, { once: true });
  window.addEventListener('pointercancel', handlePointerCancel, { once: true });
};

// On pointer up
const handlePointerUp = () => {
  clearTimeout(touchState.holdTimer);

  // Only trigger tap if hold wasn't triggered
  if (!touchState.holdTriggered && config.tap_action) {
    handleAction(config.tap_action);
  }

  // Reset state
  touchState.holdTriggered = false;
};
```

Key Insights:

- Using global event listeners (on window) captures events even if they end outside the element
- Explicitly tracking hold state prevents duplicate actions
- Using { once: true } with event listeners prevents memory leaks
- Global event listeners must be cleaned up when components are destroyed
- Using timeout for hold detection provides a consistent user experience

### Navigation View Resilience

#### The Challenge

When navigating between Home Assistant views, our event listeners were lost, causing interactions to stop working until the page was refreshed.

#### The Solution

We implemented a navigation detection and re-initialization system:

```ts
// Add listener for navigation events
const navigationListener = () => {
  setTimeout(() => setupInteractions(), 100);
};
window.addEventListener('location-changed', navigationListener);

// Clean up in disconnectedCallback or when component is destroyed
const cleanup = () => {
  window.removeEventListener('location-changed', navigationListener);
};
```

Key Insights:

- Home Assistant uses custom location-changed events for navigation
- A small delay (100ms) is needed after navigation to ensure DOM is ready
- We need to clean up old event listeners before attaching new ones
- The cleanup function must be called when the component is destroyed
- Storing handler functions in element properties allows them to be removed later

### Styling Best Practices

#### The Challenge

Home Assistant's styling system sometimes overrode our custom styles, particularly for backgrounds and z-index values.

#### The Solution

We adopted defensive styling practices:

```ts
/* Force specific styles with !important */
.card-content-layer {
  background: transparent !important;
}

/* Use multiple selectors for increased specificity */
.card-container .card-ripple-container {
  z-index: 2 !important;
}

/* Force hardware acceleration for smoother animations */
.card-container {
  transform: translateZ(0);
  will-change: transform;
}
```

Key Insights:

- Use !important judiciously for critical styles that must not be overridden
- Home Assistant may apply styles to deep elements, so ensure sufficient specificity
- Hardware acceleration improves animation performance
- The shadow DOM provides some style isolation but not complete protection
- Debugging styles with browser devtools is essential to identify overrides
- Setting explicit background: transparent is more reliable than not setting a background

### Color Scheme Refinement

#### The Challenge

Our initial implementation used Home Assistant's `--primary-color` variable for all interaction effects (hover, ripple, hold indicator). While this matches HA's Tile Card pattern, it doesn't align with our card's own accent color scheme, creating a visual disconnect.

#### The Insight

The HA Tile Card uses the **entity's color** for all its interaction effects, with `--primary-color` serving only as a fallback. In our Calendar Card context, the equivalent would be using our card's `vertical_line_color` configuration parameter, which already serves as the card's main accent color.

#### Implementation Approach

1. **Custom CSS Variable** (defined in `styles.ts` with other CSS variables):

   ```css
   :host {
     /* Existing variables */
     --card-line-color-vertical: ${config.vertical_line_color};

     /* New accent color variable leveraging existing vertical line color */
     --card-accent-color: var(--card-line-color-vertical, var(--primary-color, #03a9f4));
   }
   ```

2. **Usage in Effects** (in `interaction.ts`):

   ```css
   /* Ripple effect */
   .card-ripple {
     background-color: var(--card-accent-color);
   }

   /* Hold indicator */
   .card-hold-indicator {
     background-color: var(--card-accent-color);
   }

   /* Hover effect */
   .card-container:hover::before {
     background: var(--card-accent-color);
   }
   ```

**Benefits**:

1. Visual Consistency: Interaction effects now reflect the card's own accent color
2. User Customization: Users who customize vertical_line_color get a fully coordinated experience
3. Design Coherence: Maintains the design approach of HA's Tile Card while adapting to our card's context
4. Maintainability: Using a semantic CSS variable makes future color changes easier

**Implementation Notes**

- The opacity values remain unchanged (0.05 for hover, 0.12 for ripple, 0.28 for hold)
- The fallback chain allows graceful degradation if variables are missing
- This approach preserves dark/light mode compatibility by inheriting from the system variables

## HA Tile Card Reference (v2025.3)

This section documents the interaction patterns and visual specifications of the Home Assistant Tile Card as of version 2025.3, serving as our reference implementation.

### Visual Specifications

#### Color Palette

| Element        | Color                               | CSS Variable/Value                             |
| -------------- | ----------------------------------- | ---------------------------------------------- |
| Hover effect   | Subtle color tint                   | `var(--primary-color)` at exactly 0.05 opacity |
| Ripple effect  | Primary color with specific opacity | `var(--primary-color)` at exactly 0.12 opacity |
| Hold indicator | Primary color with higher opacity   | `var(--primary-color)` at exactly 0.28 opacity |

#### Size & Spacing

| Element                   | Size/Measurement                           | Notes                                                       |
| ------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| Ripple maximum scale      | 2.5× width or height (whichever is larger) | Ensures ripple covers entire card even when clicked at edge |
| Ripple container overflow | Hidden                                     | Contained within card boundaries                            |
| Content padding           | 16px (standard)                            | Default padding for tile cards in v2025.3                   |
| Hold indicator size       | 32px (desktop) / 48px (touch)              | Fixed circle diameter that doesn't scale with animation     |

### Interaction Patterns

#### Tap Interaction

1. **Initial Contact**:

   - Ripple effect begins immediately on pointer down
   - Ripple originates from exact touch/click point
   - Initial radius is 0px

2. **During Press**:

   - Ripple expands outward in a circle
   - Animation is smooth with ease-out timing function
   - No action is triggered during this phase

3. **On Release (Quick Tap)**:
   - If release occurs before hold threshold (500ms):
   - Ripple completes expansion animation
   - Tap action is triggered immediately on pointer up
   - Ripple begins fading out after 100-150ms
   - Complete ripple lifecycle is ~400ms

#### Hold Interaction

1. **Initial Phase (0-500ms)**:

   - Identical to tap interaction start
   - Ripple expands outward from contact point
   - No visual indication of hold timer during this phase

2. **Hold Threshold Reached (at 500ms)**:

   - A **distinct hold indicator** appears (not just a higher-opacity ripple)
   - This is a separate blue circle centered exactly at the contact point
   - The hold indicator has the following properties:
     - Fixed size (not expanding like the ripple)
     - Higher opacity than the ripple (0.28)
     - `var(--primary-color)` (typically blue #03a9f4)
     - Perfect circular shape with border-radius: 50%
     - Appears with a subtle fade-in animation (150ms)
   - The original ripple remains visible underneath/behind the hold indicator
   - **Device-specific sizes**:
     - On touch devices (mobile/tablet): ~48px diameter (larger finger target)
     - On mouse/pointer devices: ~32px diameter (more precise)

3. **During Hold (after 500ms)**:
   - Both the ripple and hold indicator remain visible
   - No further visual changes occur while holding
4. **On Release (After Hold)**:
   - Hold action is triggered on pointer up (not at the 500ms mark)
   - Both the ripple and hold indicator fade out simultaneously (300ms)
   - The hold indicator uses a quick fade-out animation
   - No tap action is triggered after a hold

#### Hover Interaction (Desktop/Mouse Only)

1. **Enter**:

   - A subtle background color tint is applied that matches the card's primary color
   - This color overlay is applied with exactly 0.05 opacity (5%)
   - Transition is smooth (180ms ease-in-out)
   - No elevation/shadow changes
   - No vertical movement (flat design philosophy)

2. **Exit**:

   - Color tint is removed completely
   - Same transition timing as enter (180ms)

3. **Special Cases**:
   - Hover effect is disabled during touch interactions
   - Media query ensures hover only on devices with hover capability: `@media (hover: hover)`

### Animation Specifications

#### Ripple Animation

| Property                    | Value                                 | CSS Implementation                                                                |
| --------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| Duration                    | 300ms                                 | `transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms linear;` |
| Timing function (transform) | Material Design standard curve        | `cubic-bezier(0.4, 0, 0.2, 1)`                                                    |
| Timing function (opacity)   | Linear                                | `linear`                                                                          |
| Initial state               | `transform: scale(0); opacity: 0;`    |                                                                                   |
| End state                   | `transform: scale(1); opacity: 0.12;` |                                                                                   |
| Fade out                    | `opacity: 0;` over 300ms              | Begins after action completes                                                     |

#### Hold Indicator Animation

| Property          | Value                                | CSS Implementation                                                 |
| ----------------- | ------------------------------------ | ------------------------------------------------------------------ |
| Size              | 32px (desktop) / 48px (touch)        | `width: 32px; height: 32px;` (adjusted based on touch detection)   |
| Appearance timing | At exactly 500ms hold threshold      | Triggered by JavaScript timeout                                    |
| Fade-in duration  | 150ms                                | `transition: opacity 150ms ease-in-out, transform 150ms ease-out;` |
| Color             | Primary color (blue)                 | `background-color: var(--primary-color, #03a9f4);`                 |
| Opacity           | Exactly 0.28                         | `opacity: 0.28;`                                                   |
| Position          | Fixed at exact touch/click point     | `position: fixed; top: ${y}px; left: ${x}px;`                      |
| Fade-out          | 300ms ease-out                       | Same timing as ripple fade-out                                     |
| Transform         | Uses translate(-50%, -50%) centering | Centers indicator on exact touch point                             |

### Element Structure

The HA Tile Card in 2025.3 uses a sophisticated structure to enable clean interactions:
Key structural features:

1. Proper layering with z-index:

   - Background layer (z-index: 1)
   - Interaction effects layer (ripples and hold indicator) (z-index: 2)
   - Content layer (z-index: 3)

   Note: While both ripple and hold indicator share the same z-index value (2),
   the hold indicator appears visually above the ripple because:

   - It's created and appended to the DOM after the ripple
   - The hold indicator is appended directly to document.body, while the ripple
     is contained within the card's ripple container

2. Position and overflow handling:

   - All layers positioned absolutely within relative container
   - Ripple container has `overflow: hidden` and matches card border radius
   - Hold indicator is positioned in fixed coordinates relative to viewport
   - Content has `pointer-events: auto` to receive interactions
   - Both ripple and hold indicator use `pointer-events: none` to avoid capturing events

3. DOM structure optimization:

   - Interaction elements (ripples and hold indicator) created dynamically when needed
   - Elements are removed after animations complete
   - Ripples are contained within the card's ripple container
   - Hold indicator is appended directly to document.body for proper positioning
   - Clean separation between visual and interactive elements

### Visual Comparison Chart

| Interaction State    | Layered Structure                                               | Technical Implementation                                                                                                                  |
| -------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Idle state           | Background: `var(--ha-card-background)`<br>Content: transparent | `.card-bg-layer { background: var(--ha-card-background); z-index: 1; }`<br>`.card-content-layer { background: transparent; z-index: 3; }` |
| Hover state          | Same as idle + color tint overlay at z-index: 2                 | `.card-container:hover::before { background: var(--primary-color); opacity: 0.05; z-index: 2; }`                                          |
| Tap start            | Same as idle + ripple element appears at z-index: 2             | `createRipple(){ ... }` creates div with `position: absolute; border-radius: 50%; z-index: 2;`                                            |
| Tap ripple expanding | Ripple grows with animation                                     | `transform: scale(1); opacity: 0.12;` with 300ms animation                                                                                |
| Tap end              | Ripple fades out while maintaining layer structure              | `opacity: 0;` transition over 300ms, then element removal                                                                                 |
| Hold start           | Identical to tap start                                          | Same as tap start                                                                                                                         |
| Hold activated       | Original ripple + distinct blue circle appears at touch point   | Create separate hold indicator div with `width/height: 32px/48px; background: var(--primary-color); opacity: 0.28;`                       |
| Hold end             | Ripple and hold indicator fade out                              | Same as tap end                                                                                                                           |

Note: All states maintain the three-layer structure with z-index ordering (1: background, 2: effects, 3: content). The ripple effects and hover overlay are inserted at z-index 2, keeping content always visible above them and the base background always below them.
