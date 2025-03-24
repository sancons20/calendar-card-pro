<a name="top"></a>

# Calendar Card Pro for Home Assistant

[![hacs][hacs-img]][hacs-url] [![GitHub Release][github-release-img]][github-release-url] [![Downloads][github-downloads-img]][github-release-url]

<img src="https://raw.githubusercontent.com/alexpfau/calendar-card-pro/main/.github/img/header.png" alt="Calendar Card Pro Preview" width="100%">

## ☕ Support This Project

If you find **Calendar Card Pro** useful, consider supporting its development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/alexpfau)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor%20on%20GitHub-30363d?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/alexpfau)

<p>&nbsp;</p>

## Table of Contents

- [🆕 What's New in v2](#-whats-new-in-v2)
- [1️⃣ Overview](#1️⃣-overview)
- [2️⃣ Installation](#2️⃣-installation)
- [3️⃣ Usage](#3️⃣-usage)
- [4️⃣ Configuration Guide](#4️⃣-configuration-guide)
- [5️⃣ Examples](#5️⃣-examples)
- [6️⃣ Contributing & Roadmap](#6️⃣-contributing--roadmap)

<p>&nbsp;</p>

---

## 🆕 What's New in v2

Calendar Card Pro v2 brings major enhancements to make your calendar experience even better:

### 🎉 New Features

#### Custom Styling Per Calendar

Transform your calendar with rich visual customization:

- **Accent Colors**: Assign unique colors to the vertical line for each calendar entity
- **Background Colors**: Enable semi-transparent backgrounds matching the accent color
- **Smart Rounded Corners**: Events use rounded corners derived from your theme's card radius
- **Visual Hierarchy**: Instantly identify events from different calendars at a glance

<img src="https://raw.githubusercontent.com/alexpfau/calendar-card-pro/main/.github/img/example_3_custom_styling.png" alt="Custom Styling" width="600"><br>

```yaml
entities:
  - entity: calendar.family
    accent_color: '#ff6c92' # Line and background color
  - entity: calendar.work
    accent_color: '#1e88e5'
  - entity: calendar.personal
    accent_color: '#43a047'
event_background_opacity: 15 # Enable semi-transparent backgrounds (0-100 scale)
vertical_line_width: 5px # Slightly increase vertical line width
event_spacing: 6px # Adjust vertical spacing between calendar events
```

#### Calendar Labels

Add emoji or text before event titles to identify which calendar they belong to:

```yaml
entities:
  - entity: calendar.work
    label: '💼' # Work events
  - entity: calendar.family
    label: '👪' # Family events
```

#### Advanced Display Controls

Choose what information to show, per calendar:

```yaml
# Global settings
show_time: true # Generally show time, if not configured otherwise
show_location: true # Generally show location, if not configured otherwise
show_single_allday_time: false # Hides time row from all single-day all-day events

# Per-calendar settings
entities:
  - entity: calendar.work
  - entity: calendar.holidays
    show_time: false # Hide time for all events in holiday calendar
  - entity: calendar.birthdays
    show_time: false
    show_location: false # Hide both time and location for birthdays
```

#### Custom Start Date

View calendars from any date, not just today:

```yaml
start_date: '2025-07-01' # Start your calendar from July 1st
```

#### Flexible Date Alignment

Control the vertical alignment of your date column:

```yaml
date_vertical_alignment: top # Align dates to top (default: middle)
```

#### Empty Day Display

Show placeholder for days with no events:

```yaml
show_empty_days: true # Display all days in range, even without events
```

This makes it easier to see where a new day starts, especially with many events.

#### Enhanced Past Event Display

When using `show_past_events: true`, past events are now visually distinct:

- Past events appear with reduced opacity (60%)
- Easy visual distinction between past and upcoming events

#### Fixed Height with Scrolling

Control card height with automatic scrolling:

```yaml
max_height: '300px' # Card will scroll when content exceeds this height
```

#### Smarter Caching

Reduce API calls with navigation-aware caching:

```yaml
refresh_on_navigate: false # Keep cache when navigating between views
```

By default, your calendar refreshes on page reloads and when navigating dashboard views. You can now change this behavior to preserve your calendar data when you switch between dashboard views by setting this option to `false`.

### 🛠 Breaking Changes

V2 includes a few breaking changes to be aware of:

1. **Parameter Renaming**:

   - `row_spacing` is now `day_spacing` (for clarity)

2. **Split Parameters**:

   - `time_location_icon_size` has been split into:
     ```yaml
     time_icon_size: '14px'
     location_icon_size: '14px'
     ```

3. **Card DOM Structure**: The card's internal DOM structure has been updated for better compatibility, which may affect existing card-mod customizations.

### 🚀 Major Refactoring

#### Enhanced Performance

- **Complete Rewrite**: Entirely new rendering engine for better performance
- **Smart Caching**: Intelligent caching reduces API calls and improves load times
- **Progressive Rendering**: Efficiently renders events in small batches to maintain responsiveness
- **Stable DOM Structure**: Consistent structure for better compatibility with other components

#### Improved Theme & Card-Mod Compatibility

The card now properly integrates with Home Assistant themes and card-mod styling:

- **Native Theme Support**: Properly integrates with all Home Assistant themes
- **Standard Card Structure**: Uses standard ha-card structure making card-mod work exactly like other cards

**Examples:**

- **Custom title styling with card-mod:**

```yaml
type: custom:calendar-card-pro
title: Family Schedule
card_mod:
  style: |
ha-card .header-container h1.card-header {
      width: 100%;
      text-align: center;
      font-weight: bold;
      border-bottom: 1px solid var(--primary-color);
      float: none !important; /* Override the default float:left */
    }
```

- **Highlight today's events with card-mod:**

```yaml
type: custom:calendar-card-pro
card_mod:
  style: |
    /* Make today's events stand out */
    .day-table.today .event-title {
      font-size: 16px !important;     /* Larger text */
      font-weight: bold !important;   /* Bold text */
      color: var(--accent-color) !important; /* Use theme accent color */
    }

    /* Add subtle left border pulse animation */
    .day-table.today .event {
      border-left-width: 4px !important;
      transition: border-left-color 1s ease-in-out;
      animation: todayPulse 3s infinite alternate;
    }

    @keyframes todayPulse {
      from { border-left-color: var(--accent-color); }
      to { border-left-color: var(--primary-color); }
    }
```

- **Remove card borders:**

```yaml
card_mod:
  style: |
    ha-card {
      border-radius: 0;
      border: none;
    }
```

<p align="right"><a href="#top">⬆️ back to top</a></p>

---

## 🆕 What's New in v2.1

Calendar Card Pro v2.1 introduces a powerful new feature to give you even more control over your calendars.

### 🎉 New Features

#### Per-Calendar Event Limits

Control how many events are shown from each calendar independently:

```yaml
entities:
  - entity: calendar.family
    # Show all events from family calendar (no limit)
  - entity: calendar.work
    max_events_to_show: 2
    # Only show 2 most important work events
  - entity: calendar.holidays
    max_events_to_show: 1
    # Just show the next upcoming holiday
```

This feature provides several benefits:

- **Prioritize important calendars**: Give more space to your most important calendars
- **Prevent one calendar from overwhelming the view**: Ideal for busy calendars like school schedules
- **Control information density**: Show all family events but only the next work meeting

##### How It Works

- **Entity limits are applied first**: Each calendar is limited to its specific `max_events_to_show` value
- **Global limit is applied second**: The card-level `max_events_to_show` still controls the total number of events
- **Chronological order is maintained**: Events are still displayed in date/time order

##### Behavior in Different Modes

- **In normal (collapsed) view**: Both entity limits and global limit apply
- **In expanded view**: Entity limits still apply, but the global limit is removed

##### Example Configuration

```yaml
type: custom:calendar-card-pro
title: 'My Calendars'
entities:
  - entity: calendar.family
    accent_color: '#ff6c92'
    # Show all events from family calendar (no limit)
  - entity: calendar.school
    accent_color: '#1e88e5'
    max_events_to_show: 1
    # Only show 1 event from school calendar
  - entity: calendar.work
    accent_color: '#43a047'
    max_events_to_show: 2
    # Show at most 2 events from work calendar
max_events_to_show: 5
# Show at most 5 events total in collapsed view
tap_action:
  action: expand
# Tap to see more events (respecting per-calendar limits)
```

<p align="right"><a href="#top">⬆️ back to top</a></p>

---

<p>&nbsp;</p>

## 1️⃣ Overview

### 🔍 About

**Calendar Card Pro** was inspired by a beautiful [calendar design using button-card and Hass calendar add-on](https://community.home-assistant.io/t/calendar-add-on-some-calendar-designs/385790) shared in the Home Assistant community. While the original design was visually stunning, implementing it with **button-card** and **card-mod** led to **performance issues**.

This motivated me to create a **dedicated calendar card** that excels in one thing: **displaying upcoming events beautifully and efficiently**.

Built with **performance in mind**, the card leverages **intelligent refresh mechanisms** and **smart caching** to ensure a **smooth experience**, even when multiple calendars are in use.

### ✨ Features

- 🎨 **Sleek & Minimalist Design** – Clean, modern, and visually appealing layout.
- ✅ **Multi-Calendar Support** – Display multiple calendars with unique styling.
- 📅 **Compact & Expandable Views** – Adaptive views to suit different dashboard needs.
- 🔧 **Highly Customizable** – Fine-tune layout, colors, event details, and behavior.
- ⚡ **Optimized Performance** – Smart caching, progressive rendering, and minimal API calls.
- 💡 **Deep Home Assistant Integration** – Theme-aware with native ripple effects.
- 🌍 **Multi-Language Support** – [Available in 24 languages](#-adding-translations), community contributions welcome!
- 🧩 **Modular & Extensible** – Designed for future enhancements and easy customization.

### 🔗 Dependencies

**Calendar Card Pro** requires at least **one calendar entity** in Home Assistant. It is compatible with any integration that generates `calendar.*` entities, with **CalDAV** and **Google Calendar** being the primary tested integrations.

⚠️ **Important:** Ensure you have at least **one calendar integration set up** in Home Assistant before using this card.

<p align="right"><a href="#top">⬆️ back to top</a></p>

## 2️⃣ Installation

### 📦 HACS Installation (Recommended)

The easiest way to install **Calendar Card Pro** is via **[HACS (Home Assistant Community Store)](https://hacs.xyz/)**.

[![Open in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=alexpfau&repository=calendar-card-pro&category=plugin)

#### Steps:

1. Ensure **[HACS](https://hacs.xyz/docs/setup/download)** is installed in Home Assistant.
2. Go to **HACS → Frontend → Custom Repositories**.
3. Add this repository: `https://github.com/alexpfau/calendar-card-pro` as type `Dashboard`
4. Install **Calendar Card Pro** from HACS.
5. **Clear your browser cache** and reload Home Assistant.

### 📂 Manual Installation

<details>
<summary>📖 Click to expand manual installation instructions</summary>

#### Steps:

1. **Download** the latest release:  
   👉 [calendar-card-pro.js](https://github.com/alexpfau/calendar-card-pro/releases/latest)

2. **Move the file** to your Home Assistant `www` folder:  
   /config/www/

3. **Navigate to:**
   Home Assistant → Settings → Dashboards → Resources → Add Resource

4. **Add the resource** to your Lovelace Dashboard:

   ```yaml
   url: /local/calendar-card-pro.js
   type: module
   ```

5. **Clear cache & refresh** your browser to apply changes.

</details>

<p align="right"><a href="#top">⬆️ back to top</a></p>

## 3️⃣ Usage

Once **Calendar Card Pro** is installed, follow these steps to add and configure it in your Home Assistant dashboard.

### 📌 Adding the Card to Your Dashboard

1. **Ensure a Calendar Integration is Set Up**  
   Calendar Card Pro requires at least one `calendar.*` entity in Home Assistant (e.g., **Google Calendar, CalDAV**).
2. **Open Your Dashboard for Editing**

   - Navigate to **Home Assistant → Dashboard**
   - Click the three-dot menu (⋮) → **Edit Dashboard**

3. **Add Calendar Card Pro**

   - Click the ➕ **Add Card** button
   - Search for `"Calendar"` or scroll to find `"Calendar Card Pro"`
   - Select the card to add it to your dashboard

4. **Initial Setup & Configuration**
   - By default, the card will **automatically detect available calendars** and select the first one.
   - Use the **YAML mode** for advanced customization.

### ⚙️ Customizing the Card

Calendar Card Pro offers a range of **customization options** to match your needs.

- **Control which events are displayed**

  - Set `days_to_show` to define how many days are visible.
  - Use `max_events_to_show` to limit the number of events in compact mode.

- **Customize colors, fonts, and layout**

  - Apply different colors per calendar using the `color` option.
  - Adjust font sizes for event details, dates, and other elements.
  - Modify separators and spacing for a personalized look.

- **Modify tap/hold actions**
  - Set `tap_action` and `hold_action` to `expand`, `navigate`, or other HA-supported actions.

##### YAML Configuration (Example)

```yaml
type: custom:calendar-card-pro
title: 'Upcoming Events'
entities:
  - entity: calendar.family
    color: '#e63946' # Custom color for family events
  - entity: calendar.work
    color: '#457b9d' # Custom color for work events
days_to_show: 5
max_events_to_show: 5
show_location: true
```

### 🚀 Next Steps

- Explore the [📚 Configuration Guide](#4️⃣-configuration-guide) for a **detailed list of options**.
- Check out the [💡 Examples](#5️⃣-examples) section for **pre-configured setups**.
- Get involved! Check out the [Contributing & Roadmap](#6️⃣-contributing--roadmap) section to learn **how to contribute** and see **upcoming features**.

<p align="right"><a href="#top">⬆️ back to top</a></p>

## 4️⃣ Configuration Guide

### ⚙️ Variables

| Variable                 | Type    | Default                           | Description                                                                        |
| ------------------------ | ------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| **Core Settings**        |         |                                   |                                                                                    |
| entities                 | array   | Required                          | List of calendar entities with optional styling (see Entity Configuration below)   |
| start_date               | string  | `''` (today)                      | 🆕 **NEW!** Custom start date in YYYY-MM-DD format (e.g., '2025-07-01')            |
| days_to_show             | number  | `3`                               | Number of days to display                                                          |
| max_events_to_show       | number  | -                                 | Maximum number of events to show in compact mode                                   |
| show_empty_days          | boolean | `false`                           | 🆕 **NEW!** Whether to show days with no events (with "No events" message)         |
| language                 | string  | `System`, fallback `en`           | Interface language (auto-detects from HA)                                          |
| **Header**               |         |                                   |                                                                                    |
| title                    | string  | -                                 | Card title                                                                         |
| title_font_size          | string  | `--calendar-card-font-size-title` | Card title font size                                                               |
| title_color              | string  | `--calendar-card-color-title`     | Card title font color                                                              |
| **Layout and Spacing**   |         |                                   |                                                                                    |
| background_color         | string  | `--ha-card-background`            | Card background color                                                              |
| day_spacing              | string  | `5px`                             | 🆕 **NEW!** Spacing between different calendar day rows (replaces row_spacing)     |
| event_spacing            | string  | `4px`                             | 🆕 **NEW!** Vertical padding within each event                                     |
| additional_card_spacing  | string  | `0px`                             | Additional top/bottom padding for the card                                         |
| max_height               | string  | `none`                            | 🆕 **NEW!** Maximum height of the card with scrolling for overflow (e.g., '300px') |
| vertical_line_width      | string  | `2px`                             | Vertical line separator width                                                      |
| vertical_line_color      | string  | `#03a9f4`                         | Vertical line separator color                                                      |
| horizontal_line_width    | string  | `0px`                             | Horizontal line width between days                                                 |
| horizontal_line_color    | string  | `--secondary-text-color`          | Horizontal line color between days                                                 |
| **Date Column**          |         |                                   |                                                                                    |
| date_vertical_alignment  | string  | `middle`                          | 🆕 **NEW!** Vertical alignment of date column (`top`, `middle`, or `bottom`)       |
| weekday_font_size        | string  | `14px`                            | Weekday name font size                                                             |
| weekday_color            | string  | `--primary-text-color`            | Weekday name font color                                                            |
| day_font_size            | string  | `26px`                            | Day numbers font size                                                              |
| day_color                | string  | `--primary-text-color`            | Day numbers font color                                                             |
| show_month               | boolean | `true`                            | Whether to show month names                                                        |
| month_font_size          | string  | `12px`                            | Month name font size                                                               |
| month_color              | string  | `--primary-text-color`            | Month name font color                                                              |
| **Event Column**         |         |                                   |                                                                                    |
| show_past_events         | boolean | `false`                           | Whether to show today's events that have already ended                             |
| event_background_opacity | number  | `0`                               | 🆕 **NEW!** Background opacity (0-100) for events using entity accent color        |
| event_font_size          | string  | `14px`                            | Event title font size                                                              |
| event_color              | string  | `--primary-text-color`            | Event title font color                                                             |
| show_time                | boolean | `true`                            | Whether to show event times                                                        |
| show_single_allday_time  | boolean | `true`                            | 🆕 **NEW!** Whether to show time display for all-day single-day events             |
| time_24h                 | boolean | `true`                            | Whether to use 24-hour time format                                                 |
| show_end_time            | boolean | `true`                            | Whether to show event end times                                                    |
| time_icon_size           | string  | `14px`                            | 🆕 **NEW!** Clock icon size (replaces time_location_icon_size)                     |
| time_font_size           | string  | `12px`                            | Event time font size                                                               |
| time_color               | string  | `--secondary-text-color`          | Event time font color                                                              |
| show_location            | boolean | `true`                            | Whether to show event locations                                                    |
| remove_location_country  | boolean | `true`                            | Whether to remove country names from locations                                     |
| location_icon_size       | string  | `14px`                            | 🆕 **NEW!** Location icon size (replaces time_location_icon_size)                  |
| location_font_size       | string  | `12px`                            | Event location font size                                                           |
| location_color           | string  | `--secondary-text-color`          | Event location font color                                                          |
| **Actions**              |         |                                   |                                                                                    |
| tap_action               | object  | `none`                            | Action when tapping the card                                                       |
| hold_action              | object  | `none`                            | Action when holding the card                                                       |
| **Cache and Refresh**    |         |                                   |                                                                                    |
| refresh_interval         | number  | `30`                              | Time in minutes between data refreshes                                             |
| refresh_on_navigate      | boolean | `true`                            | 🆕 **NEW!** Whether to force refresh data when navigating between dashboard views  |

### 🗂️ Entity Configuration

The `entities` array accepts either:

1. **A simple entity ID** (default styling applies)
2. **An advanced object configuration** (custom styling per entity)

#### Available Properties for Entity Configuration Objects:

| Property           | Type    | Description                                                                                                           |
| ------------------ | ------- | --------------------------------------------------------------------------------------------------------------------- |
| entity             | string  | **Required.** The calendar entity ID                                                                                  |
| label              | string  | 🆕 **NEW!** Optional label displayed before event titles from this calendar, for instance a calendar name or an emoji |
| color              | string  | Custom color for event titles from this calendar                                                                      |
| accent_color       | string  | 🆕 **NEW!** Custom color for the vertical line and event background (when event_background_opacity is >0)             |
| show_time          | boolean | 🆕 **NEW!** Whether to show event times for this calendar (overrides global show_time setting)                        |
| show_location      | boolean | 🆕 **NEW!** Whether to show event locations for this calendar (overrides global show_location setting)                |
| max_events_to_show | number  | 🆕 **NEW v2.1!** Maximum number of events to show from this calendar (works with global max_events_to_show)           |

#### Example:

```yaml
entities:
  - calendar.family # Simple entity ID (default styling)
  - entity: calendar.work
    label: '💻'
    color: '#1e90ff'
    accent_color: '#ff6347'
  - entity: calendar.holidays
    show_time: false # Hide times for holiday events
  - entity: calendar.birthdays
    show_time: false
    show_location: false # Hide both time and location for birthdays
```

This allows granular control over how information is displayed for different types of calendars.

### 🎨 Event Styling Options

**Calendar Card Pro** offers advanced styling options that allow you to create a visually distinct representation of your different calendars:

#### Calendar Labels

The `label` property in entity configuration allows you to add a visual identifier before event titles from a specific calendar. This can be:

- **Text**: A short identifying word (e.g., "Work:", "Personal:")
- **Emoji**: A relevant emoji (e.g., "🏢", "🏠", "🎓")
- **Icon**: A custom identifier that matches the calendar's purpose

Labels help distinguish events at a glance without relying solely on color, improving accessibility. They appear before the event title with proper spacing.

#### Accent Colors and Backgrounds

Each calendar entity can have a custom accent color that controls:

1. **Vertical Line**: The colored line at the left of each event row
2. **Background (Optional)**: A semi-transparent background for the event

To enable colored backgrounds:

- Set an `accent_color` for your calendar entities
- Adjust the global `event_background_opacity` (0-100) to control transparency

```yaml
# Example: Different calendars with distinct styling
entities:
  - entity: calendar.work
    color: '#ffffff'
    accent_color: '#1e88e5'
    label: '💻'
  - entity: calendar.family
    color: '#ffffff'
    accent_color: '#e53935'
    label: '🧑‍🧑‍🧒‍🧒'
  - entity: calendar.personal
    color: '#ffffff'
    accent_color: '#43a047'
    label: '🎉'

# Enable subtle backgrounds for all calendars
event_background_opacity: 15
```

This approach creates a clean, color-coded visual system with both accent lines and subtle background colors to distinguish your calendars.

### 🏗️ Event Display & Compact Mode

#### Default Behavior

By default, **Calendar Card Pro** displays all events for the next **3 days** (including today). This means:

- If there are **no events** in the next 3 days, the card will show an **empty state**.
- If there are **many events**, all will be displayed, making the card **taller**.
- The **card height adapts dynamically** based on content.
- By default, **past events from today are hidden**, but you can set `show_past_events: true` to display them.

#### Compact Mode

To control **Calendar Card Pro's size**, enable **compact mode** by setting `max_events_to_show`. This:

- Limits the number of events displayed at once.
- Maintains a **consistent card height**.
- Dynamically updates as new events appear.

You can **toggle between compact and full views** by configuring `tap_action` or `hold_action`.

### 🎛️ Actions

Both `tap_action` and `hold_action` support the following options:

| Action Type      | Description                                                               |
| ---------------- | ------------------------------------------------------------------------- |
| **expand**       | Toggles between compact and full view (when `max_events_to_show` is set). |
| **more-info**    | Opens the **More Info** dialog in Home Assistant.                         |
| **navigate**     | Navigates to a different **dashboard view**.                              |
| **call-service** | Calls a **Home Assistant service**.                                       |
| **url**          | Opens an **external URL**.                                                |

**Additional Parameters:**

- `navigation_path`: Path for **navigate** action.
- `url_path`: URL for **url** action.
- `service`: Home Assistant service for **call-service** action.
- `service_data`: Service payload for **call-service** action.

##### Example: Expand View on Tap

```yaml
tap_action:
  action: expand
```

##### Example: Navigate to Calendar Dashboard

```yaml
tap_action:
  action: navigate
  navigation_path: /lovelace/calendar
```

### 🏗️ Material Design Interaction

**Calendar Card Pro** integrates Home Assistant’s **native interaction patterns** for a seamless experience:

- **Ripple Effect** – Provides **visual feedback** on hover and touch.
- **Hold Actions** – Displays a **visual indicator** when the hold threshold is reached.
- **Keyboard Navigation** – Fully supports **Enter/Space** for activation.
- **Haptic Feedback** – Aligns with Home Assistant’s **design language**.

### 🔄 Smart Cache System

**Calendar Card Pro** efficiently handles API calls and refreshes:

- **Minimized API Polling** – Fetches new data **only when necessary**.
- **Automatic Refresh** – Updates **every `refresh_interval` minutes** (default: `30`).
- **Smart Caching** – Stores events locally with cache lifetime equal to the refresh interval.
- **Navigation-Aware Caching** – By default, always refresh when returning to a view. Set `refresh_on_navigate: false` to preserves the cache when navigating between dashboard views to reduce API calls.
- **Rate-Limited Refresh** – When manually refreshing the page, new data is fetched only if at least 5 seconds have passed since the last update, preventing excessive API calls.
- **Reactive Updates** – Events update when:
  - A **calendar entity changes**.
  - **Home Assistant reconnects** after a disconnection.
  - The **dashboard becomes active again**.

### ⚡ Progressive Rendering

To maintain performance, **Calendar Card Pro** progressively renders events:

- **Renders events in small batches** to prevent UI lag.
- **Prevents browser freezing** with optimized rendering.
- **Ensures smooth interactions** even for large event lists.

<p align="right"><a href="#top">⬆️ back to top</a></p>

## 5️⃣ Examples

This section provides different **configuration setups** to help you get started with **Calendar Card Pro**.

### 📅 Basic Configuration

A simple setup displaying events from a **single calendar**. Automatically **adapts to themes** and **dark/light mode**.

**With Home Assistant default theme** (light mode):  
<img src="https://raw.githubusercontent.com/alexpfau/calendar-card-pro/main/.github/img/example_1_basic_native.png" alt="Basic Configuration" width="600">

**Using my favorite [iOS Theme](https://github.com/basnijholt/lovelace-ios-themes)** (ios-dark-mode-blue-red-alternative):  
<img src="https://raw.githubusercontent.com/alexpfau/calendar-card-pro/main/.github/img/example_1_basic_ios.png" alt="Basic Configuration" width="600">

```yaml
type: custom:calendar-card-pro
entities:
  - calendar.family
days_to_show: 3
show_location: false
show_month: false
```

### 🗂️ Multiple Calendars with Compact Mode

This setup includes **multiple calendars**, each with a **custom color**. The **compact mode** ensures that only a limited number of events are shown at once. Screenshots again showing **my favorite [iOS Theme](https://github.com/basnijholt/lovelace-ios-themes)** (ios-dark-mode-blue-red-alternative).

**Compact view**:  
<img src="https://raw.githubusercontent.com/alexpfau/calendar-card-pro/main/.github/img/example_2_advanced_compact.png" alt="Advanced Configuration" width="600">

**After tap ➡️ expanded view**:  
<img src="https://raw.githubusercontent.com/alexpfau/calendar-card-pro/main/.github/img/example_2_advanced_expanded.png" alt="Advanced Configuration" width="600">

```yaml
type: custom:calendar-card-pro
title: Upcoming events
entities:
  - entity: calendar.family
    color: '#ff6c92' # Red for family events
  - entity: calendar.work
    color: '#86ebda' # Blue for work events
  - entity: calendar.personal
    color: '#c2ffb3' # Green for personal events
days_to_show: 7
max_events_to_show: 3 # Always only show 3 events
tap_action:
  action: expand # Tap to expand/collapse
```

### 🎨 Complete Configuration with All Options

A fully **customized** configuration demonstrating **all available options**, including **styling, layout, and interactions**. Though you could **go all out**—and I didn’t—and create a **completely different look** if you wanted. Screenshot using the beautiful **[Bubble Theme](https://github.com/Clooos/Bubble)**.

<img src="https://raw.githubusercontent.com/alexpfau/calendar-card-pro/main/.github/img/example_4_complete.png" alt="Complete Configuration" width="600"><br>

```yaml
type: custom:calendar-card-pro

# Core Settings
entities:
  - entity: calendar.family
    color: '#ffdaea'
  - entity: calendar.work
    color: '#b3ffd9'
start_date: '2025-07-01'
days_to_show: 10
max_events_to_show: 10
language: en

# Header
title: 📅 Full Calendar Demo
title_font_size: 26px
title_color: '#baf1ff'

# Layout and Spacing
background_color: '#eeeeee50'
row_spacing: 10px
additional_card_spacing: 0px
vertical_line_width: 0px
vertical_line_color: '#baf1ff'
horizontal_line_width: 2px
horizontal_line_color: '#baf1ff80'

# Date Column
date_vertical_alignment: middle
weekday_font_size: 14px
weekday_color: '#baf1ff'
day_font_size: 32px
day_color: '#baf1ff'
show_month: true
month_font_size: 12px
month_color: '#baf1ff'

# Event Column
show_past_events: false
event_font_size: 14px
event_color: '#baf1ff'
time_24h: true
show_end_time: true
time_font_size: 12px
time_color: '#baf1ff'
time_icon_size: 14px
show_location: true
remove_location_country: true
location_font_size: 12px
location_color: '#baf1ff'
location_icon_size: 14px

# Actions
tap_action:
  action: expand
hold_action:
  action: navigate
  navigation_path: calendar

# Cache and Refresh
refresh_interval: 15 # Auto-refresh events every 15 minutes
```

<p align="right"><a href="#top">⬆️ back to top</a></p>

## 6️⃣ Contributing & Roadmap

### 🚀 How to Contribute

Want to improve **Calendar Card Pro**? I welcome contributions of all kinds—whether it’s **fixing bugs, improving performance, or adding new features**!

#### Getting Started

1. **Fork this repo** and clone it locally.
2. **Install dependencies**:
   ```sh
   npm install
   ```
3. **Start development**:
   ```sh
   npm run dev
   ```
4. **Open a Pull Request** with your changes.

💡 For detailed contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).

### 📅 Roadmap & Planned Features

I am continuously working on improving **Calendar Card Pro**. Here’s what’s planned for upcoming releases:

- **Enhanced Event Details** – Support for event descriptions, recurring event indicators, and more.
- **Visual Configuration Editor** – Configure all options through an intuitive UI without writing YAML.
- **Expanded Language Support** – Adding more languages (looking for community translations).

💡 Got a feature request? **Open a GitHub Issue** or start a **discussion**!

### 📖 Developer Documentation

For those interested in contributing code, I maintain detailed **[architecture documentation](./docs/architecture.md)** that explains:

- **Code Organization** – Structure and module responsibilities.
- **Data Flow & Processing** – How events are fetched, stored, and displayed.
- **Performance Optimization** – Techniques for fast rendering and caching.
- **Design Principles** – Best practices for UI consistency and accessibility.

### 🌍 Adding Translations

**Calendar Card Pro** currently supports:

- **Czech** (`cs`)
- **Danish** (`da`)
- **Dutch** (`nl`)
- **English** (`en`)
- **Finnish** (`fi`)
- **French** (`fr`)
- **German** (`de`)
- **Greek** (`el`)
- **Hebrew** (`he`)
- **Hungarian** (`hu`)
- **Icelandic** (`is`)
- **Italian** (`it`)
- **Norwegian Bokmål** (`nb`)
- **Norwegian Nynorsk** (`nn`)
- **Polish** (`pl`)
- **Portuguese** (`pt`)
- **Russian** (`ru`)
- **Slovenian** (`sl`)
- **Spanish** (`es`)
- **Swedish** (`sv`)
- **Ukrainian** (`uk`)
- **Vietnamese** (`vi`)
- **Chinese (Simplified)** (`zh-cn`)
- **Chinese (Traditional)** (`zh-tw`)

To add a new language:

1. **Create a new file** in `src/translations/languages/[lang-code].json`
2. **Update the localize file** in `src/translations/localize.ts`
3. **Translate all strings** to your language.ations/localize.ts`
4. **Submit a Pull Request** with your changes.
5. **Submit a Pull Request** with your changes.

### 🏆 Acknowledgements

- **Original design inspiration** from [Calendar Add-on & Calendar Designs](https://community.home-assistant.io/t/calendar-add-on-some-calendar-designs/385790) by **[@kdw2060](https://github.com/kdw2060)**.
- **Interaction patterns** inspired by Home Assistant’s [Tile Card](https://github.com/home-assistant/frontend/blob/dev/src/panels/lovelace/cards/hui-tile-card.ts), which is licensed under the [Apache License 2.0](https://github.com/home-assistant/frontend/blob/dev/LICENSE.md).
- **Material Design ripple interactions**, originally by Google, used under the [Apache License 2.0](https://github.com/material-components/material-components-web/blob/master/LICENSE).

 <!--Badges-->

[hacs-img]: https://img.shields.io/badge/HACS-Custom-orange.svg
[hacs-url]: https://github.com/alexpfau/calendar-card-pro/actions/workflows/hacs-validate.yml
[github-release-img]: https://img.shields.io/github/release/alexpfau/calendar-card-pro.svg
[github-downloads-img]: https://img.shields.io/github/downloads/alexpfau/calendar-card-pro/total.svg
[github-release-url]: https://github.com/alexpfau/calendar-card-pro/releases
