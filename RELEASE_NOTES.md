## Version 2.4.0

### 🎨 UI & Styling Enhancements

- **Today's Date Styling**: Added dedicated color options for today's date in the calendar
  - `today_weekday_color`: Customize the color of today's weekday name
  - `today_day_color`: Customize the color of today's day number
  - `today_month_color`: Customize the color of today's month name
- **Event Progress Bars**: Added progress bar display for currently running events
  - Enable with `show_progress_bar: true`
  - Customize with `progress_bar_color`, `progress_bar_height`, `progress_bar_width`
- **Weekend Styling**: Added dedicated color options for weekends
  - `weekend_weekday_color`, `weekend_day_color`, `weekend_month_color`
- **Week Number Display**: Added ISO and simple week number displays
  - Enable with `show_week_numbers: 'iso'` or `'simple'`
  - Style with `week_number_font_size`, `week_number_color`, `week_number_background_color`
- **Visual Separators**: Added horizontal separator lines between days, weeks, and months
  - Configure with `day_separator_width`, `week_separator_width`, `month_separator_width`
  - Style with `day_separator_color`, `week_separator_color`, `month_separator_color`
- **Today Indicator**: Added customizable dot/icon to mark the current day
  - Set with `today_indicator: true` (simple dot), `'pulse'`, `'glow'`, MDI icon, emoji, or image path
  - Position with `today_indicator_position` in format "x% y%"

### ⚡️ Performance & Functionality

- **Enhanced Event Display**: Added countdown strings for upcoming events
  - Enable with `show_countdown: true`
- **Improved Empty Day Display**: Added option to customize "No events" text color
  - Use `empty_day_color` to style the message
- **Better Date Handling**: Improved multi-day event formatting and "Ends Tomorrow" indicators
  - More natural language for displaying multi-day event durations
- **Dynamic Start Date**: Added support for relative date expressions
  - `start_date: "today+7"` - Show events starting 7 days in future
  - `start_date: "today-2"` - Show events starting 2 days ago

### 👨‍💻 Code Improvements & Fixes

- **Rendering Optimization**: Improved progressive rendering for smoother experience with many events
- **Styling Consistency**: Refactored CSS variables for more consistent theming
- **Bug Fixes**:
  - Fixed calendar entity detection issues in some Home Assistant configurations
  - Fixed incorrect date display on certain timezones
  - Fixed multi-day event splitting logic

## Version 2.3.0

### 🎨 UI & Styling Enhancements

- **Weekend Styling**: Added dedicated color options for weekends
  - `weekend_weekday_color`, `weekend_day_color`, `weekend_month_color`
- **Week Number Display**: Added ISO and simple week number displays
  - Enable with `show_week_numbers: 'iso'` or `'simple'`
  - Style with `week_number_font_size`, `week_number_color`, `week_number_background_color`
- **Visual Separators**: Added horizontal separator lines between days, weeks, and months
  - Configure with `day_separator_width`, `week_separator_width`, `month_separator_width`
  - Style with `day_separator_color`, `week_separator_color`, `month_separator_color`
- **Today Indicator**: Added customizable dot/icon to mark the current day
  - Set with `today_indicator: true` (simple dot), `'pulse'`, `'glow'`, MDI icon, emoji, or image path
  - Position with `today_indicator_position` in format "x% y%"

### ⚡️ Performance & Functionality

- **Enhanced Event Display**: Added countdown strings for upcoming events
  - Enable with `show_countdown: true`
- **Improved Empty Day Display**: Added option to customize "No events" text color
  - Use `empty_day_color` to style the message
- **Better Date Handling**: Improved multi-day event formatting and "Ends Tomorrow" indicators
  - More natural language for displaying multi-day event durations
- **Dynamic Start Date**: Added support for relative date expressions
  - `start_date: "today+7"` - Show events starting 7 days in future
  - `start_date: "today-2"` - Show events starting 2 days ago

### 👨‍💻 Code Improvements & Fixes

- **Rendering Optimization**: Improved progressive rendering for smoother experience with many events
- **Styling Consistency**: Refactored CSS variables for more consistent theming
- **Bug Fixes**:
  - Fixed calendar entity detection issues in some Home Assistant configurations
  - Fixed incorrect date display on certain timezones
  - Fixed multi-day event splitting logic