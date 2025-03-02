/* eslint-disable import/order */
/**
 * Editor component for Calendar Card Pro
 *
 * This module will contain:
 * - CalendarCardProEditor class
 * - Editor registration
 * - Configuration UI (future implementation)
 * - Schema definition for editor fields
 * - UI rendering methods
 */

import type * as Types from '../config/types';

/**
 * Editor component for configuring the Calendar Card Pro
 *
 * Currently a placeholder that will be implemented in a future version
 * with a full configuration UI. The component will be registered and
 * used by Home Assistant's card editor system.
 *
 * @export - Makes the component available for import in the main file
 */
export class CalendarCardProEditor extends HTMLElement {
  /**
   * Sets the configuration for the editor
   * Currently a placeholder for future implementation
   *
   * @param {Readonly<Partial<Types.Config>>} _config - Card configuration
   */
  public setConfig(_config: Readonly<Partial<Types.Config>>): void {
    // Will be implemented later when we build the UI editor
  }
}

// The registration will be handled in the main file until the editor is fully implemented

export {};
