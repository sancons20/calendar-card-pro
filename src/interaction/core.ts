/* eslint-disable import/order */
/**
 * Interaction core functionality for Calendar Card Pro
 *
 * This module handles the setup of all interaction handlers and
 * manages the interaction lifecycle.
 */

import * as Types from '../config/types';

//-----------------------------------------------------------------------------
// CORE PUBLIC API
//-----------------------------------------------------------------------------

/**
 * Extract primary entity ID from configured entities
 *
 * @param entities - Entity configuration array
 * @returns The primary entity ID or undefined if not available
 */
export function getPrimaryEntityId(
  entities: Array<string | Types.EntityConfig>,
): string | undefined {
  if (!entities || !entities.length) return undefined;

  const firstEntity = entities[0];
  return typeof firstEntity === 'string' ? firstEntity : firstEntity.entity;
}
