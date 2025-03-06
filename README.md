# Calendar Card Pro for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/custom-components/hacs)
[![GitHub Release](https://img.shields.io/github/release/alexpfau/calendar-card-pro.svg)](https://github.com/alexpfau/calendar-card-pro/releases)
[![Downloads](https://img.shields.io/github/downloads/alexpfau/calendar-card-pro/total.svg)](https://github.com/alexpfau/calendar-card-pro/releases)

[![hacs][hacs-validate]][hacs-url] ![Github last commit][git-last-commit-badge] ![git-download-all][git-download-all-badge] ![git-download-latest][git-download-latest-badge]

<img src="docs/images/preview.png" alt="Calendar Card Pro Preview" width="100%" style="max-width: 600px;">

## 📑 Table of Contents

- [🎯 Overview](#overview)
- [📥 Installation](#installation)
- [🛠️ Usage](#usage)
- [📚 Configuration Guide](#configuration-guide)
- [💡 Examples](#examples)
- [🤝 Contributing](#contributing)
- [❗ Known Limitations](#known-limitations)

## 🎯 Overview

### About

Calendar Card Pro was inspired by a beautiful [calendar design using button-card and Hass calendar add-on](https://community.home-assistant.io/t/calendar-add-on-some-calendar-designs/385790) shared in the Home Assistant community. While the original design was visually stunning, implementing it with button-card led to performance issues. This motivated me to create a dedicated card focused on doing one thing exceptionally well: displaying your upcoming events beautifully and efficiently.

Built with performance in mind, the card uses intelligent refresh mechanisms and smart caching to ensure smooth operation even with multiple calendars.

### Features

- 🎨 Multiple calendars with individual styling
- 📊 Smart compact mode with expand/collapse functionality
- 🔄 Smart update system with automatic refresh and state detection
- ⚡ Optimized performance with user-configurable smart caching
- 🎯 Progressive loading for smooth rendering
- 📱 Responsive and touch-friendly design
- 🌍 Multi-language support (en/de)
- 📍 Customizable location display
- 🕒 Flexible time format options (12/24 hour)
- 🎨 Extensive styling options
- 🔍 Modular architecture for better maintainability

### Dependencies

This card requires one or more calendar entities in Home Assistant. It works with any calendar integration that creates calendar.\* entities, with CalDAV and Google Calendar being the primary tested integrations.

⚠️ **Important**: Make sure you have at least one calendar integration set up in Home Assistant before using this card.

## 📥 Installation

### HACS (Recommended)

[![Open your Home Assistant instance and open this repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=alexpfau&repository=calendar-card-pro&category=plugin)

1. Install HACS if you haven't already
2. Add this repository to HACS
3. Install "Calendar Card Pro" from Frontend section
4. Refresh your browser

### Manual Installation

<details>
  <summary>Click to expand manual installation instructions</summary>

1. Download [calendar-card-pro.js](https://github.com/alexpfau/calendar-card-pro/releases/latest)
2. Copy it to the `config/www` folder of your Home Assistant installation
3. In Home Assistant, go to `Configuration->Lovelace Dashboards->Resources` and add resource:

```yaml
url: /local/calendar-card-pro.js
type: module
```

4. Refresh your browser

</details>

## 🛠️ Usage

1. Add a calendar integration to Home Assistant (CalDav, etc.)
2. Go to your dashboard
3. Click the three dots menu (⋮) and click "Edit Dashboard"
4. Click the "+" button to add a new card
5. Search for "Calendar" or scroll to find "Calendar Card Pro"
6. The card will be automatically configured with any available calendar entity
7. Use the YAML editor to customize the card using the configuration options below

## 📚 Configuration Guide

### Variables

| Name                    | Type    | Default                     | Description                                      |
| ----------------------- | ------- | --------------------------- | ------------------------------------------------ |
| entities                | array   | Required                    | List of calendar entities with optional styling  |
| days_to_show            | number  | 3                           | Number of days to display                        |
| max_events_to_show      | number  | -                           | Maximum number of events to show in compact mode |
| show_past_events        | boolean | false                       | Show today's events that have already ended      |
| language                | string  | System                      | Interface language (en/de)                       |
| refresh_interval        | number  | 30                          | Minutes between auto-refresh of events           |
| cache_duration          | number  | 30                          | Cache validity of fetched events in minutes      |
| time_24h                | boolean | true                        | Use 24-hour time format                          |
| show_end_time           | boolean | true                        | Show event end times                             |
| show_month              | boolean | true                        | Show month names                                 |
| show_location           | boolean | true                        | Show event locations                             |
| remove_location_country | boolean | true                        | Remove country from location                     |
| background_color        | string  | var(--ha-card-background)   | Card background color                            |
| row_spacing             | string  | 5px                         | Spacing between calendar day rows                |
| additional_card_spacing | string  | 0px                         | Additional top/bottom padding for the card       |
| vertical_line_width     | string  | 2px                         | Width of vertical separator line                 |
| vertical_line_color     | string  | #03a9f4                     | Color of vertical separator line                 |
| horizontal_line_width   | string  | 0px                         | Width of horizontal separator line               |
| horizontal_line_color   | string  | var(--secondary-text-color) | Color of horizontal separator line               |
| title                   | string  | -                           | Card title                                       |
| title_font_size         | string  | 20px                        | Card title font size                             |
| weekday_font_size       | string  | 14px                        | Weekday font size                                |
| day_font_size           | string  | 26px                        | Day number font size                             |
| month_font_size         | string  | 12px                        | Month font size                                  |
| event_font_size         | string  | 14px                        | Event title font size                            |
| time_font_size          | string  | 12px                        | Event time font size                             |
| location_font_size      | string  | 12px                        | Location text font size                          |
| time_location_icon_size | string  | 16px                        | Size of time and location icons                  |
| title_color             | string  | var(--primary-text-color)   | Card title text color                            |
| weekday_color           | string  | var(--primary-text-color)   | Weekday text color                               |
| day_color               | string  | var(--primary-text-color)   | Day number text color                            |
| month_color             | string  | var(--primary-text-color)   | Month text color                                 |
| event_color             | string  | var(--primary-text-color)   | Default event title color                        |
| time_color              | string  | var(--secondary-text-color) | Event time text color                            |
| location_color          | string  | var(--secondary-text-color) | Location text color                              |
| tap_action              | object  | { action: "expand" }        | Action on tap/click                              |
| hold_action             | object  | { action: "none" }          | Action on long press                             |

### Advanced Features

#### Entity Configuration

The `entities` array accepts either strings (entity IDs) or objects with extended configuration:

- A string (entity ID only)
- An object with the following properties:
  - `entity`: Calendar entity ID (required)
  - `color`: Custom color for event titles from this calendar (optional), overwrites event_color when set

#### Event Display & Compact Mode

##### Default Behavior

By default, the card displays all events for the next 3 days (including today), regardless of the number of events. This means:

- If there are no events in the next 3 days, the card will show an empty state
- If there are many events, all of them will be shown, potentially making the card quite tall
- The card's height adapts dynamically to the content
- By default, events that have ended today are hidden, but you can set `show_past_events: true` to keep displaying them

This flexible height works well for many dashboard layouts but might not be ideal for all use cases, particularly on wall-mounted tablets or dashboards with fixed-height cards.

##### Compact Mode

To better control the card's size, you can enable compact mode by setting the `max_events_to_show` option. This creates a sliding window of events that:

- Shows up to the specified number of events within the configured time range
- Maintains a consistent card height
- Automatically updates as events pass

The card supports toggling between compact and full views by tapping/clicking (default behavior) or through custom tap/hold actions. This provides easy access to all events while maintaining a clean, space-efficient display by default.

#### Actions

Both `tap_action` and `hold_action` support the following options:

- `action`: The type of action
  - `expand`: Toggle between compact and full view (when max_events_to_show is set)
  - `more-info`: Show more information about the entity
  - `navigate`: Navigate to a different view
  - `call-service`: Call a Home Assistant service
  - `url`: Open a URL
- `navigation_path`: Path for navigate action
- `url_path`: URL for url action
- `service`: Service to call (for call-service action)
- `service_data`: Service data (for call-service action)

#### Auto-Refresh and Update Behavior

Calendar Card Pro uses a sophisticated approach to keep calendar data current while minimizing API calls:

- **Automatic Refresh**: The card proactively fetches new data every `refresh_interval` minutes (default: 30) even without user interaction
- **Smart Caching**: Events are stored locally and considered valid for `cache_duration` minutes (default: 30) so repeated views don't trigger unnecessary API calls
- **Reactive Updates**: Besides the timed refresh, events are also updated when:
  - You return to a browser tab after being away for 5+ minutes
  - A calendar entity's state changes in Home Assistant
  - The card configuration changes
  - The Home Assistant connection is restored after being disconnected

This approach ensures your calendar stays current while maintaining excellent performance and responsiveness.

## 💡 Examples

### Basic Configuration

```yaml
type: custom:calendar-card-pro
entities:
  - calendar.family
days_to_show: 3
show_end_time: true
show_location: false
show_month: false
```

### Multiple Calendars with Compact Mode

```yaml
type: custom:calendar-card-pro
title: My Calendars
entities:
  - entity: calendar.family
    color: '#e63946' # Red for family events
  - entity: calendar.work
    color: '#457b9d' # Blue for work events
  - entity: calendar.holidays
    color: '#2a9d8f' # Green for holidays
days_to_show: 7
max_events_to_show: 3 # Always only show 3 events
tap_action:
  action: expand # Tap to expand/collapse
```

### Complete Configuration with All Options

```yaml
type: custom:calendar-card-pro
# Core Settings
entities:
  - entity: calendar.family
    color: '#ff0000'
  - entity: calendar.work
    color: '#0000ff'
days_to_show: 7
max_events_to_show: 5
show_past_events: false

# Display Mode & Localization
language: 'en'
time_24h: true
show_end_time: true
show_month: true
show_location: true
remove_location_country: true

# Card Layout
title: 'Full Calendar Demo'
background_color: 'var(--ha-card-background)'
row_spacing: '5px'
additional_card_spacing: '0px'

# Visual Separators
vertical_line_width: '2px'
vertical_line_color: '#03a9f4'
horizontal_line_width: '0px'
horizontal_line_color: 'var(--secondary-text-color)'

# Typography: Sizes
title_font_size: '20px'
weekday_font_size: '14px'
day_font_size: '26px'
month_font_size: '12px'
event_font_size: '14px'
time_font_size: '12px'
location_font_size: '12px'
time_location_icon_size: '16px'

# Typography: Colors
title_color: 'var(--primary-text-color)'
weekday_color: 'var(--primary-text-color)'
day_color: 'var(--primary-text-color)'
month_color: 'var(--primary-text-color)'
event_color: 'var(--primary-text-color)'
time_color: 'var(--secondary-text-color)'
location_color: 'var(--secondary-text-color)'

# Actions
tap_action:
  action: expand
hold_action:
  action: more-info
```

## 🤝 Contributing

Calendar Card Pro is an open-source project, and contributions are welcome and appreciated!

### Ways to Contribute

- **Code Contributions**: Bug fixes, new features, and improvements
- **Translations**: Help translate to your language
- **Documentation**: Improve or expand the documentation
- **Bug Reports**: Report issues or suggest enhancements
- **Feature Requests**: Suggest new capabilities

### Adding Translations

The card currently supports:

- English (en)
- German (de)

To add a new language:

1. Create a new file in `src/translations/languages/[lang-code].json`
2. Copy the structure from an existing language file
3. Translate all strings to your language
4. Submit a PR with your changes

### Developer Documentation

For those interested in contributing code, we maintain detailed [architecture documentation](./docs/architecture.md) that explains:

- Code organization and module responsibilities
- Data flow and processing
- Performance optimization techniques
- Design principles and patterns

### Getting Started with Development

1. Fork the repository
2. Clone your fork: `git clone https://github.com/[your-username]/calendar-card-pro.git`
3. Install dependencies: `npm install`
4. Make your changes
5. Test locally: `npm run build`
6. Submit a PR with a clear description of your changes

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for more detailed guidelines.

## Acknowledgements

- Original design inspiration from [Calendar Add-on & Calendar Designs](https://community.home-assistant.io/t/calendar-add-on-some-calendar-designs/385790) by Home Assistant community member @GHA_Steph
- Interaction patterns inspired by Home Assistant's [Tile Card](https://github.com/home-assistant/frontend/blob/dev/src/panels/lovelace/cards/hui-tile-card.ts), which is licensed under the [Apache License 2.0](https://github.com/home-assistant/frontend/blob/dev/LICENSE.md)
- Material Design ripple interactions, originally by Google, used under the [Apache License 2.0](https://github.com/material-components/material-components-web/blob/master/LICENSE)

## ❗ Known Limitations

The following features are currently limited or not fully implemented:

### Event Display

- No support for recurring event indicators
- No support for event categories/tags
- No support for attendee information

### Configuration

- No visual configuration editor yet (YAML only)

## 🚀 Future Enhancements

1. **UI Editor**: Expanding editor.ts to provide a visual configuration interface
2. **Additional Languages**: Expanding language support
3. **Custom Event Filters**: Allow users to filter events based on properties
4. **Performance Optimizations**: Further optimizations for large calendars, including:
   - DOM virtualization for cards with many events to reduce memory usage
   - More efficient data structures for faster filtering and sorting
   - Even more configurable caching strategies to minimize API requests
   - Render time optimizations for initial load
   - Memory usage improvements for long-running instances

<!--Badges-->

# TO BE UPDATED

[hacs-validate]: https://github.com/ngocjohn/vehicle-status-card/actions/workflows/validate.yaml/badge.svg
[hacs-url]: https://github.com/ngocjohn/vehicle-status-card/actions/workflows/validate.yaml
[git-last-commit-badge]: https://img.shields.io/github/last-commit/ngocjohn/vehicle-status-card
[git-download-all-badge]: https://img.shields.io/github/downloads/ngocjohn/vehicle-status-card/total?style=flat&logo=homeassistantcommunitystore&logoSize=auto&label=Downloads&color=%2318BCF2
[git-download-latest-badge]: https://img.shields.io/github/downloads/ngocjohn/vehicle-status-card/latest/total?style=flat&logo=homeassistantcommunitystore&logoSize=auto

```

```
