# Contributing to Calendar Card Pro

Thank you for your interest in contributing to Calendar Card Pro! This project welcomes contributions from the community, particularly in the following areas:

## Adding New Languages

1. Fork the repository
2. In `calendar-card-pro.js`, locate the `TRANSLATIONS` object
3. Add your language following this template:
   ```javascript
   'language_code': {
     daysOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
     fullDaysOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
     months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
     allDay: 'all-day',
     multiDay: 'until',
     at: 'at'
   }
   ```
4. Update documentation to include the new language code
5. Submit a pull request

## Code Contributions

### Development Setup
1. Fork and clone the repository
2. Create a development environment in Home Assistant
3. Link the development version to your HA installation
4. Make your changes
5. Test thoroughly with different calendar configurations

### Pull Request Guidelines
- Focus on a single feature or bug fix per PR
- Maintain existing code style and formatting
- Add comments for new functions and complex logic
- Update documentation if needed
- Test your changes with multiple browsers and devices

### Testing
Before submitting a PR, please test:
- Different calendar configurations
- Multiple calendars
- Various time zones
- Different location formats
- Both 12/24h time formats
- Light and dark themes

## Feature Requests

When requesting new features:
1. Check existing issues to avoid duplicates
2. Describe your use case clearly
3. Consider contributing the feature yourself
4. Be open to discussion about implementation details

## Bug Reports

When reporting bugs:
1. Describe the expected vs actual behavior
2. Include your configuration
3. Add steps to reproduce
4. Mention your HA version and browser
5. Include any relevant error messages

## Code Style

- Use consistent indentation (2 spaces)
- Follow existing naming conventions
- Keep functions focused and well-documented
- Use TypeScript-style JSDoc comments
- Maintain the existing architecture

## Questions?

Feel free to open an issue for:
- Implementation guidance
- Architecture questions
- Best practices discussions

Thank you for helping improve Calendar Card Pro!
