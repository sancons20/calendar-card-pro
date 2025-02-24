# Calendar Card Pro for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/custom-components/hacs)
[![GitHub Release](https://img.shields.io/github/release/alexpfau/calendar-card-pro.svg)](https://github.com/alexpfau/calendar-card-pro/releases)

A sleek and performant calendar card for Home Assistant that supports multiple calendars with individual styling, real-time updates, and smart caching.

<img src="docs/images/preview.png" alt="Calendar Card Pro Preview" width="400">

## About

Calendar Card Pro was inspired by a beautiful [calendar design using Hass calendar add-on and button-card](https://community.home-assistant.io/t/calendar-add-on-some-calendar-designs/385790) shared in the Home Assistant community. While I loved the clean aesthetic of that design, I found that implementing it with button-card and card-mod led to performance issues. This motivated me to create a dedicated custom card that would:

- Maintain the sleek, minimalist design I admired
- Optimize performance through native implementation
- Provide extensive customization options
- Work directly with Home Assistant's calendar integrations like CalDAV
- Remove dependencies on external add-ons

The result is Calendar Card Pro - a performant, customizable calendar card focused on doing one thing well: displaying your calendar events beautifully.

## Dependencies

This card requires one or more calendar entities in Home Assistant. While it should work with any calendar integration, I tested and recommend using the [CalDAV integration](https://www.home-assistant.io/integrations/caldav/) for the best experience. 

⚠️ **Important**: Make sure you have at least one calendar integration set up in Home Assistant before using this card. Follow the [CalDAV setup instructions](https://www.home-assistant.io/integrations/caldav/) in the official Home Assistant documentation to get started.

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

[![Open your Home Assistant instance and open this repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=alexpfau&repository=calendar-card-pro&category=plugin)

1. Install HACS if you don't have it already (see [HACS installation guide](https://hacs.xyz/docs/installation/prerequisites))
2. Add this repository as a custom repository in HACS:
   - Open HACS in your Home Assistant instance
   - Go to the three dots menu in the top right corner
   - Select "Custom repositories"
   - Add `https://github.com/alexpfau/calendar-card-pro` as URL
   - Select "Lovelace" as category
3. Click Install
4. Refresh your browser

### Option 2: Manual Installation

1. Download `calendar-card-pro.js` from the [latest release](https://github.com/alexpfau/calendar-card-pro/releases)
2. Upload the downloaded file to your Home Assistant instance using one of these methods:
   - Upload via Samba share to `/config/www/`
   - Upload via SFTP to `/config/www/`
   - Upload via File Editor: Create folder `/config/www/` if it doesn't exist, then upload the file
3. Add the resource reference:
   [![Open your Home Assistant instance and show your dashboard resources.](https://my.home-assistant.io/badges/lovelace_resources.svg)](https://my.home-assistant.io/redirect/lovelace_resources/)
   ```yaml
   url: /local/calendar-card-pro.js
   type: module
   ```
4. Refresh your browser

## Usage

1. Add a calendar integration to Home Assistant (Google Calendar, CalDav, etc.)
2. Go to your dashboard
3. Click the three dots menu (⋮) and click "Edit Dashboard"
4. Click the "+" button to add a new card
5. Search for "Calendar" or scroll to find "Calendar Card Pro"
6. The card will be automatically configured with any available calendar entities
7. Use the YAML editor to customize the card using the configuration options below

**Preview:** The card will show a live preview in the card picker if you have calendar entities configured. If not, it will display instructions to add a calendar integration.

**Configuration:** Currently, this card uses YAML configuration. A visual editor will be added in a future release.

## Configuration Options

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| entities | array | Yes | - | List of calendar entities with optional styling |
| title | string | No | '' | Card title |
| title_font_size | string | No | '20px' | Title font size |
| title_color | string | No | 'var(--primary-text-color)' | Title text color |
| language | string | No | 'en' | Interface language (en/de) |
| days_to_show | number | No | 3 | Number of days to display |
| update_interval | number | No | 43200 | Cache duration in seconds (12 hours) |
| show_past_events | boolean | No | false | Show events that have already ended |
| vertical_line_width | string | No | '2px' | Width of vertical separator line |
| vertical_line_color | string | No | '#03a9f4' | Color of vertical separator line |
| horizontal_line_width | string | No | '0px' | Width of horizontal separator line |
| horizontal_line_color | string | No | 'var(--secondary-text-color)' | Color of horizontal separator line |
| additional_card_spacing | string | No | '0px' | Additional padding for the card |
| row_spacing | string | No | '5px' | Spacing between event rows |
| weekday_font_size | string | No | '14px' | Weekday font size |
| weekday_color | string | No | 'var(--primary-text-color)' | Weekday text color |
| day_font_size | string | No | '26px' | Day number font size |
| day_color | string | No | 'var(--primary-text-color)' | Day number text color |
| show_month | boolean | No | true | Show month names |
| month_font_size | string | No | '12px' | Month font size |
| month_color | string | No | 'var(--primary-text-color)' | Month text color |
| event_font_size | string | No | '14px' | Event title font size |
| event_color | string | No | 'var(--primary-text-color)' | Default event title color |
| show_end_time | boolean | No | true | Show event end times |
| time_location_icon_size | string | No | '16px' | Size of time and location icons |
| time_24h | boolean | No | true | Use 24-hour time format |
| time_font_size | string | No | '12px' | Event time font size |
| time_color | string | No | 'var(--secondary-text-color)' | Event time text color |
| show_location | boolean | No | true | Show event locations |
| location_remove_country | boolean | No | true | Remove country from location |
| location_font_size | string | No | '12px' | Location text font size |
| location_color | string | No | 'var(--secondary-text-color)' | Location text color |

### Entity Configuration

Each entity in the `entities` array can be either:
- A string (entity ID only)
- An object with the following properties:
  - `entity`: Calendar entity ID (required)
  - `color`: Custom color for events from this calendar (optional)

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
```