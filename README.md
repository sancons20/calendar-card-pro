# Calendar Card Pro for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/custom-components/hacs)
[![GitHub Release](https://img.shields.io/github/release/alexpfau/calendar-card-pro.svg)](https://github.com/alexpfau/calendar-card-pro/releases)

A streamlined calendar card that provides an at-a-glance view of your upcoming events. Perfect for wall-mounted displays and Home Assistant dashboards.

<img src="docs/images/preview.png" alt="Calendar Card Pro Preview" width="400">

## About

Calendar Card Pro was inspired by a beautiful [calendar design using button-card and Hass calendar add-on](https://community.home-assistant.io/t/calendar-add-on-some-calendar-designs/385790) shared in the Home Assistant community. While the original design was visually stunning, implementing it with button-card led to performance issues. This motivated me to create a dedicated card focused on doing one thing exceptionally well: displaying your upcoming events beautifully and efficiently.

Built with performance in mind, the card uses WebSocket for real-time updates and smart caching to ensure smooth operation even with multiple calendars.

## Dependencies

This card requires one or more calendar entities in Home Assistant. It works with any calendar integration that creates calendar.* entities, with CalDAV and Google Calendar being the primary tested integrations.

⚠️ **Important**: Make sure you have at least one calendar integration set up in Home Assistant before using this card.

## Features

- 🎨 Multiple calendars with individual styling
- 📊 Smart compact mode with expand/collapse functionality
- 🔄 Real-time updates via WebSocket connection
- ⚡ Optimized performance with smart caching
- 🎯 Progressive loading for smooth rendering
- 📱 Responsive and touch-friendly design
- 🌍 Multi-language support (en/de)
- 📍 Customizable location display
- 🕒 Flexible time format options (12/24 hour)
- 🎨 Extensive styling options

## Installation

### HACS (Recommended)
[![Open your Home Assistant instance and open this repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=alexpfau&repository=calendar-card-pro&category=plugin)

1. Install HACS if you haven't already
2. Add this repository to HACS
3. Install "Calendar Card Pro" from Frontend section
4. Refresh your browser

### Manual Installation
1. Download `calendar-card-pro.js` from [latest release](https://github.com/alexpfau/calendar-card-pro/releases)
2. Copy to your `www` folder
3. Add resource:
```yaml
url: /local/calendar-card-pro.js
type: module
```
4. Refresh your browser

## Usage

1. Add a calendar integration to Home Assistant (CalDav, etc.)
2. Go to your dashboard
3. Click the three dots menu (⋮) and click "Edit Dashboard"
4. Click the "+" button to add a new card
5. Search for "Calendar" or scroll to find "Calendar Card Pro"
6. The card will be automatically configured with any available calendar entity
7. Use the YAML editor to customize the card using the configuration options below

## Configuration

Currently, this card uses YAML configuration. A visual editor may be added in a future release.

### Core Settings
Essential configuration that defines what data to display.

| Name | Type | Default | Description |
|------|------|---------|-------------|
| entities | array | Required | List of calendar entities with optional styling |
| days_to_show | number | 3 | Number of days to display |
| max_events_to_show | number | - | Maximum number of events to show in compact mode |
| show_past_events | boolean | false | Show today's events that have already ended |
| update_interval | number | 43200 | Cache duration in seconds (12 hours) |

### Display Mode & Localization
How content is formatted and displayed.

| Name | Type | Default | Description |
|------|------|---------|-------------|
| language | string | en | Interface language (en/de) |
| time_24h | boolean | true | Use 24-hour time format |
| show_end_time | boolean | true | Show event end times |
| show_month | boolean | true | Show month names |
| show_location | boolean | true | Show event locations |
| location_remove_country | boolean | true | Remove country from location |

### Card Layout
Overall card structure and spacing.

| Name | Type | Default | Description |
|------|------|---------|-------------|
| title | string | - | Card title |
| additional_card_spacing | string | 0px | Additional top/bottom padding for the card |
| row_spacing | string | 5px | Spacing between calendar day rows |
| background_color | string | var(--ha-card-background) | Card background color |

### Visual Separators
Lines and borders that divide content.

| Name | Type | Default | Description |
|------|------|---------|-------------|
| vertical_line_width | string | 2px | Width of vertical separator line |
| vertical_line_color | string | #03a9f4 | Color of vertical separator line |
| horizontal_line_width | string | 0px | Width of horizontal separator line |
| horizontal_line_color | string | var(--secondary-text-color) | Color of horizontal separator line |

### Typography: Sizes
Font size configuration for different elements.

| Name | Type | Default | Description |
|------|------|---------|-------------|
| title_font_size | string | 20px | Card title font size |
| weekday_font_size | string | 14px | Weekday font size |
| day_font_size | string | 26px | Day number font size |
| month_font_size | string | 12px | Month font size |
| event_font_size | string | 14px | Event title font size |
| time_font_size | string | 12px | Event time font size |
| location_font_size | string | 12px | Location text font size |
| time_location_icon_size | string | 16px | Size of time and location icons |

### Typography: Colors
Color configuration for different elements.

| Name | Type | Default | Description |
|------|------|---------|-------------|
| title_color | string | var(--primary-text-color) | Card title text color |
| weekday_color | string | var(--primary-text-color) | Weekday text color |
| day_color | string | var(--primary-text-color) | Day number text color |
| month_color | string | var(--primary-text-color) | Month text color |
| event_color | string | var(--primary-text-color) | Default event title color |
| time_color | string | var(--secondary-text-color) | Event time text color |
| location_color | string | var(--secondary-text-color) | Location text color |

### Actions
User interaction configuration.

| Name | Type | Default | Description |
|------|------|---------|-------------|
| tap_action | object | { action: "more-info" } | Action on tap/click |
| hold_action | object | { action: "none" } | Action on long press |

### Entity Configuration

Each entity in the `entities` array can be either:
- A string (entity ID only)
- An object with the following properties:
  - `entity`: Calendar entity ID (required)
  - `color`: Custom color for events from this calendar (optional)

### Actions

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

### Update Interval

The card primarily relies on real-time updates through Home Assistant's WebSocket connection and dashboard refreshes. The `update_interval` (12 hours) is only used as a fallback cache duration to prevent unnecessary API calls. It is not recommended to set a shorter interval as this could lead to excessive API calls without providing any benefits, since real-time updates are already handled through WebSocket. In normal operation, you'll see updates immediately as they happen in your calendars.

## Example Configurations

### Basic Configuration
```yaml
type: custom:calendar-card-pro
entities:
  - calendar.family
days_to_show: 5
show_location: false
```

### Multiple Calendars with Compact Mode
```yaml
type: custom:calendar-card-pro
title: My Calendars
entities:
  - entity: calendar.family
    color: '#e63946'  # Red for family events
  - entity: calendar.work
    color: '#457b9d'  # Blue for work events
  - entity: calendar.holidays
    color: '#2a9d8f'  # Green for holidays
days_to_show: 7
max_events_to_show: 3  # Show only 3 events initially
tap_action:
  action: expand      # Tap to expand/collapse
show_location: true
time_24h: false
```

### Complete Configuration with All Options
```yaml
type: custom:calendar-card-pro
# Entity Configuration
entities:
  - entity: calendar.family
    color: '#ff0000'
  - entity: calendar.work
    color: '#0000ff'

# General Settings
title: Full Calendar Demo
language: 'en'  # en/de
days_to_show: 7
update_interval: 43200
show_past_events: false

# Card Styling
title_font_size: '24px'
title_color: '#4a4a4a'
additional_card_spacing: '10px'
row_spacing: '8px'

# Separator Lines
vertical_line_width: '3px'
vertical_line_color: '#03a9f4'
horizontal_line_width: '1px'
horizontal_line_color: '#e0e0e0'

# Date Display
weekday_font_size: '14px'
weekday_color: '#666666'
day_font_size: '30px'
day_color: '#333333'
show_month: true
month_font_size: '12px'
month_color: '#666666'

# Event Display
event_font_size: '16px'
event_color: '#222222'
time_24h: false
show_end_time: true
time_font_size: '14px'
time_color: '#666666'
time_location_icon_size: '18px'

# Location Display
show_location: true
location_remove_country: true
location_font_size: '14px'
location_color: '#666666'

# Actions
tap_action:
  action: navigate
  navigation_path: /lovelace/0
hold_action:
  action: more-info
```

## Known Limitations

The following features are currently limited or not fully implemented:

### Event Display
- No support for recurring event indicators
- No support for event categories/tags
- No support for attendee information

### Calendar Support
- Tested primarily with CalDAV and Google Calendar integration
- Other calendar integrations that create *calendar.** entities should work but are not extensively tested

### Configuration
- No visual configuration editor yet (YAML only)

### Language Support
- Currently supports English (en) and German (de)
- Contributions for additional languages are welcome and encouraged
- See CONTRIBUTING.md for guidelines on adding new languages

The card is open source and community-driven. If you need additional features or language support, please consider contributing to the project. Pull requests are welcome! See CONTRIBUTING.md for guidelines on how to contribute.