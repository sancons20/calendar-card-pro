# Calendar Card Pro for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/custom-components/hacs)
[![GitHub Release](https://img.shields.io/github/release/YOUR_USERNAME/calendar-card-pro.svg)](https://github.com/YOUR_USERNAME/calendar-card-pro/releases)

A sleek and performant calendar card for Home Assistant that supports multiple calendars with individual styling, real-time updates, and smart caching.

<img src="docs/images/preview.png" alt="Calendar Card Pro Preview" width="400">

## About

Calendar Card Pro was created with a specific vision in mind: to provide a clean, minimalist calendar interface while maintaining high performance and reliability. While there are other excellent calendar cards available (such as [atomic-calendar-revive](https://github.com/totaldebug/atomic-calendar-revive) which served as inspiration for some of our performance optimizations), this card focuses on a simplified aesthetic while incorporating modern web development best practices.

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

### HACS Installation (Recommended)

1. Open HACS in your Home Assistant instance
2. Click on "Frontend" section
3. Click the three dots menu in the top right corner
4. Select "Custom repositories"
5. Add the URL `https://github.com/alexpfau/calendar-card-pro`
6. Select "Lovelace" as the category
7. Click "Add"
8. Find "Calendar Card Pro" in the Frontend section and install it

### Manual Installation

1. Download the `calendar-card-pro.js` file from the latest release
2. Copy it to your `config/www/community/calendar-card-pro/` folder
3. Add the resource in your dashboard:
   ```yaml
   resources:
     - url: /hacsfiles/calendar-card-pro/calendar-card-pro.js
       type: module
   ```

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