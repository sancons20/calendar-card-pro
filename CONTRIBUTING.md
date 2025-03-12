# Contributing to Calendar Card Pro

Thank you for your interest in contributing to Calendar Card Pro! This document outlines the process for contributing to the project, including code changes, translations, and bug reports.

## Understanding the Codebase

Before contributing code, we strongly recommend reviewing our [architecture documentation](./docs/architecture.md), which explains:

- Module organization and responsibilities
- Data flow and event handling
- Performance optimization techniques
- Design principles and patterns

## Development Environment Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/[your-username]/calendar-card-pro.git`
3. Install dependencies: `npm install`
4. Start development mode: `npm run dev`
5. The compiled card will be available in `dist/calendar-card-pro.js`
6. For testing in Home Assistant, follow the [testing instructions](#testing-in-home-assistant)

## Testing in Home Assistant

To test your changes in a real Home Assistant environment:

1. Copy `dist/calendar-card-pro.js` to your Home Assistant's `www/community/calendar-card-pro-dev/` folder
2. Add the resource to Home Assistant:
   ```yaml
   url: /local/community/calendar-card-pro-dev/calendar-card-pro.js
   type: module
   ```
3. Add the card to your dashboard using type: `custom:calendar-card-pro-dev`
4. Test with various calendar types and configurations
5. Verify performance with both small and large event sets

## Adding New Translations

Calendar Card Pro supports multiple languages through JSON translation files. Here's how to add a new language:

### Method 1: Contributing a Language File to the Repository

1. Create a new JSON file in `src/translations/languages/` named with the language code (e.g., `fr.json` for French)
2. Copy the structure from an existing translation file like `en.json`
3. Translate all values while keeping the keys the same
4. Import and register the file in `src/translations/localize.ts`
5. Submit a pull request

Example language file structure:

```json
{
  "daysOfWeek": ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
  "fullDaysOfWeek": ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
  "months": ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"],
  "allDay": "toute la journée",
  "multiDay": "jusqu'au",
  "at": "à",
  "noEvents": "Aucun événement à venir",
  "loading": "Chargement des événements...",
  "error": "Erreur: Entité de calendrier introuvable ou mal configurée"
}
```

### Method 2: Testing Translations During Development

For quickly testing a language without modifying the source code, you can use the dynamic translation registration API:

1. Create a script file in Home Assistant (e.g., `/config/www/calendar-translation-dev.js`):

```javascript
// Development helper for testing new translations
window.addEventListener('load', () => {
  setTimeout(() => {
    if (window.CalendarCardProLocalize) {
      // Register test translation
      window.CalendarCardProLocalize.addTranslations('test', {
        daysOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        fullDaysOfWeek: [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ],
        months: [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ],
        allDay: 'TEST all-day',
        multiDay: 'TEST until',
        at: 'TEST at',
        noEvents: 'TEST No upcoming events',
        loading: 'TEST Loading calendar events...',
        error: 'TEST Error: Calendar entity not found or improperly configured',
      });
      console.log('Test language registered for Calendar Card Pro!');
    }
  }, 2000);
});
```

2. Add this script as a resource in Home Assistant
3. Set `language: 'test'` in your card configuration to test the translation

> Note: This method is primarily intended for development and testing. For permanent language additions, please contribute directly to the repository via pull request.

## Code Style and Quality Standards

- Follow TypeScript best practices and maintain strict typing
- Use the established module structure - place new code in the appropriate module
- Follow the existing patterns for similar functionality
- Document all public functions with JSDoc comments
- Run linting before submitting: `npm run lint --fix`
- Keep bundle size in mind - avoid large dependencies

## Pull Request Process

1. Create a feature branch from your fork (`feature/my-new-feature`)
2. Make your changes following our code style guidelines
3. Ensure all linting passes (`npm run lint`)
4. Build and test your changes (`npm run build`)
5. Submit a PR against the `main` branch
6. Respond to any feedback during code review

## Bug Reports

When filing a bug report, please include:

1. A clear description of the issue
2. Steps to reproduce the problem
3. Expected behavior
4. Actual behavior
5. Version of Calendar Card Pro and Home Assistant
6. Browser and OS information
7. Screenshots if applicable

Thank you for contributing to Calendar Card Pro!
