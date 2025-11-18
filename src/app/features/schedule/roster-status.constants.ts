/**
 * Roster status constants
 * These match the backend string values stored in the database
 */
export const ROSTER_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  LOCKED: 'LOCKED',
} as const;

/**
 * Type for roster status values
 */
export type RosterStatus = (typeof ROSTER_STATUS)[keyof typeof ROSTER_STATUS];
