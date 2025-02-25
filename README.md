# Calendar Card Pro for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/custom-components/hacs)
[![GitHub Release](https://img.shields.io/github/release/alexpfau/calendar-card-pro.svg)](https://github.com/alexpfau/calendar-card-pro/releases)

A sleek and performant calendar card for Home Assistant that supports multiple calendars with individual styling, real-time updates, and smart caching.

<img src="docs/images/preview.png" alt="Calendar Card Pro Preview" width="400">

## About

Calendar Card Pro was inspired by a beautiful [calendar design using button-card and Hass calendar add-on](https://community.home-assistant.io/t/calendar-add-on-some-calendar-designs/385790) shared in the Home Assistant community. While I loved the clean aesthetic of that design, I found that implementing it with button-card and card-mod led to performance issues. This motivated me to create a dedicated custom card that would:

- Maintain the sleek, minimalist design I admired
- Optimize performance through native implementation
- Provide extensive customization options
- Work directly with Home Assistant's calendar integrations like CalDAV
- Remove dependencies on external add-ons

The result is Calendar Card Pro - a performant, customizable calendar card focused on doing one thing well: displaying your calendar events beautifully.

# To-Do: Incorporate the main purpose of this card in the section above => Goal is to provide a quick overview/glance of upcoming events in the calendar, ideal for use on a dashboard like on a smart home wall tablet.

## Dependencies

This card requires one or more calendar entities in Home Assistant. While it should work with any calendar integration that creates *calendar.** entities in Home Assistant, I tested it only with CalDAV as well as Google Calendar integration. For the best experience, follow the [CalDAV setup instructions](https://www.home-assistant.io/integrations/caldav/) in the official Home Assistant documentation to get started.

⚠️ **Important**: Make sure you have at least one calendar integration set up in Home Assistant before using this card.

## Features

- 🎨 Support for multiple calendars with individual color styling
- 🔄 Real-time updates through Home Assistant WebSocket
- 📱 Responsive and touch-friendly design
- 🌍 Multi-language support (en/de)
- ⚡ Optimized performance with smart caching
- 🎯 Progressive loading for smooth rendering
- 📍 Customizable location display
- 🕒 Flexible time format options (12/24 hour)
- 🎨 Highly customizable styling

## Installation

 ### Option 1: HACS (Recommended)

1. Install HACS if you don't have it already (see [HACS installation guide](https://hacs.xyz/docs/installation/prerequisites))
2. Add this repository as a custom repository in HACS:

    [![Open your Home Assistant instance and open this repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=alexpfau&repository=calendar-card-pro&category=plugin)
3. Search for "Calendar Card Pro" in the Frontend section of HACS
4. Install it and refresh your browser

### Option 2: Manual Installation

1. Download `calendar-card-pro.js` from the [latest release](https://github.com/alexpfau/calendar-card-pro/releases)
2. Copy the file to the `www` folder in your Home Assistant config directory
3. Add the resource reference:
   ```yaml
   url: /local/calendar-card-pro.js
   type: module
   ```
      [![Open your Home Assistant instance and show your dashboard resources.](https://my.home-assistant.io/badges/lovelace_resources.svg)](https://my.home-assistant.io/redirect/lovelace_resources/)
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

The following variables are available:

# TODO: Get rid of 'Required' column, update order of variables, maybe group into sections?!

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| entities | array | Yes | Required | List of calendar entities with optional styling |
| title | string | No | - | Card title |
| title_font_size | string | No | 20px | Card title font size |
| title_color | string | No | --primary-text-color | Card title text color |
| language | string | No | en | Interface language (en/de) |
| days_to_show | number | No | 3 | Number of days to display |
| update_interval | number | No | 43200 | Cache duration in seconds (12 hours) |
| show_past_events | boolean | No | false | Show today's events that have already ended |
| vertical_line_width | string | No | 2px | Width of vertical separator line |
| vertical_line_color | string | No | #03a9f4 | Color of vertical separator line |
| horizontal_line_width | string | No | 0px | Width of horizontal separator line |
| horizontal_line_color | string | No | --secondary-text-color | Color of horizontal separator line |
| additional_card_spacing | string | No | 0px | Additional top/bottom padding for the card |
| row_spacing | string | No | 5px | Spacing between calendar day rows |
| weekday_font_size | string | No | 14px | Weekday font size |
| weekday_color | string | No | --primary-text-color | Weekday text color |
| day_font_size | string | No | 26px | Day number font size |
| day_color | string | No | --primary-text-color | Day number text color |
| show_month | boolean | No | true | Show month names |
| month_font_size | string | No | 12px | Month font size |
| month_color | string | No | --primary-text-color | Month text color |
| event_font_size | string | No | 14px | Event title font size |
| event_color | string | No | --primary-text-color | Default event title color |
| show_end_time | boolean | No | true | Show event end times |
| time_location_icon_size | string | No | 16px | Size of time and location icons |
| time_24h | boolean | No | true | Use 24-hour time format |
| time_font_size | string | No | 12px | Event time font size |
| time_color | string | No | --secondary-text-color | Event time text color |
| show_location | boolean | No | true | Show event locations |
| location_remove_country | boolean | No | true | Remove country from location |
| location_font_size | string | No | 12px | Location text font size |
| location_color | string | No | --secondary-text-color | Location text color |
| tap_action | object | No | none | Action on tap/click (see Actions below) |
| hold_action | object | No | none | Action on long press (see Actions below) |

### Entity Configuration

Each entity in the `entities` array can be either:
- A string (entity ID only)
- An object with the following properties:
  - `entity`: Calendar entity ID (required)
  - `color`: Custom color for events from this calendar (optional)

### Actions

# TODO: Convert this section from a flat list into an array of options, or refer to standard HA documentation for available options in case they my card does 100% support all standard HA actions

Both `tap_action` and `hold_action` support the following options:
- `action`: The type of action (more-info, navigate, call-service, url)
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

### Multiple Calendars with Custom Colors
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
show_location: true
time_24h: false
tap_action:
  action: navigate
  navigation_path: /lovelace/0
hold_action:
  action: more-info
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

### Layout
-  List view only, no day/week/month view

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