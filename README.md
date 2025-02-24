# Calendar Card Pro for Home Assistant

A minimalist yet powerful calendar card for Home Assistant focused on clean design and efficient performance.

## About

Calendar Card Pro was created with a specific vision in mind: to provide a clean, minimalist calendar interface while maintaining high performance and reliability. While there are other excellent calendar cards available (such as [atomic-calendar-revive](https://github.com/totaldebug/atomic-calendar-revive) which served as inspiration for some of our performance optimizations), this card focuses on a simplified aesthetic while incorporating modern web development best practices.

## Features
- 🔄 Real-time updates through Home Assistant WebSocket
- 📊 Smart caching with fallback mechanism
- 🎨 Highly customizable styling for all elements
- 🌍 Multi-language support (en/de)
- 🔄 Event caching support for better performance
- 📱 Responsive design
- 🖱️ Touch and mouse interaction handling
- ⚙️ Configurable display options:
  - Past events visibility
  - Multi-day event formatting
  - Location display with country removal
  - Time format (12/24 hour)
  - Custom fonts and colors
  - Adjustable spacing and borders

## Configuration Options

| Name | Type | Default | Description |
|------|------|---------|-------------|
| entity | string | Required | Calendar entity ID |
| update_interval | number | 43200 | Safety fallback interval in seconds. Only used if real-time updates fail. Default: 12 hours |

## Update Mechanism

Calendar Card Pro uses a two-tier update system for optimal performance and reliability:

1. **Primary: Real-time Updates**
   - Updates are pushed instantly from Home Assistant when calendar state changes
   - No polling required
   - Zero delay for new/modified events

2. **Secondary: Safety Fallback**
   - `update_interval` controls the cache validity duration (default: 12 hours)
   - Only triggers API calls if:
     - WebSocket connection is temporarily lost
     - Calendar updates weren't pushed by Home Assistant
     - Cache has expired
     - Force refresh is requested

This dual approach ensures:
- Immediate updates in normal operation
- Reliable fallback if real-time updates fail
- Minimal API calls for better performance
- Automatic recovery from connection issues

[Rest of README to be completed...]
