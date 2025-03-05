This document provides a high-level overview of the Calendar Card Pro architecture, explaining how different modules work together to create a performant and maintainable calendar card for Home Assistant.

## Directory Structure

```
src/
├── calendar-card-pro.ts          # Main entry point with class
├── config/                       # Configuration-related code
│   ├── config.ts                 # DEFAULT_CONFIG and config helpers
│   └── types.ts                  # Type definitions
├── translations/                 # Localization code
│   ├── localize.ts               # Translation functions and logic
│   └── languages/                # Individual language files
│       ├── en.json               # English translations
│       └── de.json               # German translations
├── utils/                        # Utility functions
│   ├── event-utils.ts            # Event processing, caching & formatting
│   ├── format-utils.ts           # Date & location formatting
│   ├── dom-utils.ts              # DOM creation and manipulation
│   ├── error-utils.ts            # Error handling and logging
│   ├── actions.ts                # Tap/hold action handling
│   ├── state-utils.ts            # Component state management
│   └── helpers.ts                # Generic utilities (debounce, memoize)
└── rendering/                    # UI rendering code
    ├── render.ts                 # HTML generation & rendering logic
    ├── styles.ts                 # Card styling
    └── editor.ts                 # Card editor component (placeholder)
```

## Module Responsibilities

### Main Component (`calendar-card-pro.ts`)

- **Primary Role**: Serves as the entry point and orchestrator for the card
- **Responsibilities**:
  - Web component lifecycle (constructor, disconnectedCallback)
  - State management and Home Assistant integration
  - Coordinating interactions between modules
  - Registering the custom elements with the browser

### Configuration (`config/`)

- **Primary Role**: Manage configuration defaults and processing
- **Key Files**:
  - `config.ts`: Default configuration and config-related helper functions
  - `types.ts`: TypeScript interfaces for all components, including configurable cache duration

### Translations (`translations/`)

- **Primary Role**: Provide internationalization capabilities
- **Key Files**:
  - `localize.ts`: Core translation functions and registration
  - `languages/*.json`: Individual language translation files

### Utilities (`utils/`)

- **Primary Role**: Provide reusable functionality across the card
- **Key Files**:
  - `event-utils.ts`: Calendar event fetching, processing, caching with orchestration functionality
  - `format-utils.ts`: Formatting dates, times, and locations
  - `dom-utils.ts`: DOM element creation and manipulation utilities
  - `logger-utils.ts`: Standardized error handling and logging
  - `actions.ts`: Handling user interactions (tap/hold)
  - `state-utils.ts`: Component lifecycle management including visibility tracking and timers
  - `helpers.ts`: Generic utilities with performance tracker for monitoring

### Rendering (`rendering/`)

- **Primary Role**: Generate HTML, CSS, and handle DOM manipulation
- **Key Files**:
  - `render.ts`: HTML generation and progressive rendering
  - `styles.ts`: CSS generation based on configuration
  - `editor.ts`: Card editor component (will be expanded later)

## Module Interaction Flow

```mermaid
graph TD
    Main[Calendar Card Pro Main] --> Config[Config Module]
    Main --> Events[Event Processing]
    Main --> Render[Rendering]
    Main --> State[State Management]
    Main --> Actions[User Interactions]

    %% Config relationships
    Config --> Types[Type Definitions]

    %% Event processing relationships
    Events --> Cache[LocalStorage Cache]
    Events --> API[Home Assistant API]
    Events --> Format[Event Formatting]

    %% Rendering relationships
    Render --> DOM[DOM Operations]
    Render --> Styles[CSS Generation]
    Render --> I18n[Translations]

    %% State relationships
    State --> Lifecycle[Lifecycle Mgmt]
    State --> Refresh[Refresh Timer]
    State --> Visibility[Page Visibility]

    %% Feature relationships
    Main --> Performance[Performance Tracking]

    %% Design notes
    classDef core fill:#f9f,stroke:#333,stroke-width:2px
    classDef util fill:#bbf,stroke:#333,stroke-width:1px

    class Main,Events,Render,State,Actions core
    class Config,Cache,API,DOM,Styles,I18n,Performance util
```

## Event Processing and Refresh Mechanism

Calendar Card Pro uses a multi-layered approach to keep calendar data fresh while maintaining performance:

1. **Local Storage Caching**:

   - Events are cached in browser localStorage with user-configurable duration (default: 30 minutes)
   - Provides immediate rendering without API calls when available
   - Reduces load on Home Assistant and improves rendering speed

2. **Automatic Refreshing**:

   - Regular updates based on user-configured `refresh_interval` (default: 30 minutes)
   - Updates events in the background without disturbing the user experience
   - Uses dedicated refresh timer controller for lifecycle management

3. **State-Based Updates**:

   - Calendar entity state changes trigger immediate updates
   - Ensures new events are shown promptly when calendars are updated

4. **Page Visibility Detection**:
   - Uses dedicated visibility handler with cleanup mechanism
   - Refreshes data when users return to a tab after being away for more than 5 minutes
   - Ensures the calendar always shows recent data without excessive API calls

This approach balances fresh data with performance considerations, avoiding unnecessary API calls while keeping the display current.

## Processing Flow

1. **Initialization Flow**:

   - Main component initializes
   - `State Utils` set up initial component state
   - Establishes connection to Home Assistant

2. **Event Processing Flow**:

   - `hass` setter detects entity changes
   - `updateEvents()` calls `Event Utils` to fetch and process data
   - Events are cached and formatted for display

3. **Rendering Flow**:

   - `renderCard()` coordinates rendering process
   - `Event Utils` organize events by day
   - `Render` module generates HTML with `DOM Utils`
   - Uses progressive rendering for performance
   - `Styles` module applies CSS based on configuration

4. **Interaction Flow**:
   - User interactions trigger action handlers
   - UI is updated based on actions

## Key Design Principles

1. **Separation of Concerns**:

   - Each module has a well-defined responsibility
   - Minimal coupling between components for better testability

2. **Performance Optimization**:

   - Aggressive caching of events and rendered output
   - Progressive rendering to avoid blocking the main thread
   - Memoization of expensive calculations
   - Performance tracker for consistent monitoring
   - Configurable cache duration for fine-tuned performance control

3. **Type Safety**:

   - TypeScript interfaces for all data structures
   - Strong typing within and between modules

4. **Modularity**:

   - Self-contained modules that can be independently tested
   - Clean interfaces between modules

5. **State Management**:
   - One-way data flow from Home Assistant to UI
   - Explicit state updates in response to events

## Advanced Features

### Progressive Rendering

To maintain responsiveness even with large calendars, rendering is done progressively:

1. Events are sorted and grouped by day
2. Days are rendered in chunks
3. Rendering is paused between chunks to allow other UI operations
4. Performance metrics are collected to identify bottlenecks

### Caching Strategy

Multiple caching mechanisms are used:

1. **Local Storage Cache**: Persists between sessions
2. **In-Memory Cache**: For frequently accessed computed values
3. **Memoization**: For expensive utility functions

### Internationalization

The architecture supports multiple languages through:

1. Dictionary-based translations in JSON format
2. Runtime language switching
3. Formatting helpers that adapt to the selected language

## Maintenance Guidelines

When modifying code:

1. Keep modules focused on their core responsibilities
2. Update types in types.ts when changing data structures
3. Maintain backward compatibility when possible
4. Add performance monitoring for new features
5. Test with both small and large calendars
6. Ensure all features work with and without entity history
7. Respect user-configured cache and refresh settings

By understanding this architecture, you'll be able to maintain, extend, and contribute to the Calendar Card Pro project more effectively.
