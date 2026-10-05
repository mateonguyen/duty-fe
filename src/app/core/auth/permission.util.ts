/**
 * Role-based & Permission-based utility functions for UI access control.
 *
 * Purpose: Provide pure functions for checking user roles/permissions
 * without directly depending on Angular services, making them easier to test
 * and reuse across components.
 *
 * Usage:
 * ```typescript
 * import { hasRole, hasAnyRole, hasPermission } from './permission.util';
 *
 * if (hasRole(currentUser, 'Admin')) {
 *   // Admin-only logic
 * }
 *
 * if (hasAnyRole(currentUser, ['Manager', 'Leader'])) {
 *   // Manager or Leader logic
 * }
 * ```
 */

/**
 * Current user interface for permission checks.
 * Compatible with AuthService signals.
 */
export interface CurrentUser {
  username: string | null;
  roles?: string[];
  permissions?: string[];
  isAuthenticated: boolean;
}

/**
 * Check if user has a specific role.
 *
 * @param user - Current user object with roles array
 * @param role - Single role code to check (e.g., 'Admin', 'Manager')
 * @returns true if user has the role, false otherwise
 *
 * @example
 * ```typescript
 * const user = { username: 'john', roles: ['Admin', 'Manager'], isAuthenticated: true };
 * hasRole(user, 'Admin'); // true
 * hasRole(user, 'Viewer'); // false
 * ```
 */
export function hasRole(user: CurrentUser | null, role: string): boolean {
  if (!user || !user.isAuthenticated) return false;
  if (!user.roles || user.roles.length === 0) return false;
  if (!role || role.trim() === '') return false;

  return user.roles.includes(role);
}

/**
 * Check if user has ANY of the specified roles.
 * Returns true if at least one role matches.
 *
 * @param user - Current user object with roles array
 * @param roles - Array of role codes to check (OR logic)
 * @returns true if user has at least one of the roles
 *
 * @example
 * ```typescript
 * const user = { username: 'john', roles: ['Manager'], isAuthenticated: true };
 * hasAnyRole(user, ['Admin', 'Manager']); // true (has Manager)
 * hasAnyRole(user, ['Admin', 'Viewer']); // false
 * hasAnyRole(user, []); // false (empty roles)
 * ```
 */
export function hasAnyRole(user: CurrentUser | null, roles: string[]): boolean {
  if (!user || !user.isAuthenticated) return false;
  if (!user.roles || user.roles.length === 0) return false;
  if (!roles || roles.length === 0) return false;

  return roles.some((role) => user.roles!.includes(role));
}

/**
 * Check if user has ALL of the specified roles.
 * Returns true only if user has every role in the list.
 *
 * @param user - Current user object with roles array
 * @param roles - Array of role codes to check (AND logic)
 * @returns true if user has all of the roles
 *
 * @example
 * ```typescript
 * const user = { username: 'john', roles: ['Admin', 'Manager'], isAuthenticated: true };
 * hasAllRoles(user, ['Admin', 'Manager']); // true
 * hasAllRoles(user, ['Admin', 'Viewer']); // false (missing Viewer)
 * ```
 */
export function hasAllRoles(
  user: CurrentUser | null,
  roles: string[]
): boolean {
  if (!user || !user.isAuthenticated) return false;
  if (!user.roles || user.roles.length === 0) return false;
  if (!roles || roles.length === 0) return false;

  return roles.every((role) => user.roles!.includes(role));
}

/**
 * Check if user has a specific permission.
 *
 * @param user - Current user object with permissions array
 * @param permission - Single permission code to check (e.g., 'Roster.Publish')
 * @returns true if user has the permission
 *
 * @example
 * ```typescript
 * const user = {
 *   username: 'john',
 *   permissions: ['Roster.View', 'Roster.Edit'],
 *   isAuthenticated: true
 * };
 * hasPermission(user, 'Roster.Edit'); // true
 * ```
 */
export function hasPermission(
  user: CurrentUser | null,
  permission: string
): boolean {
  if (!user || !user.isAuthenticated) return false;
  if (!user.permissions || user.permissions.length === 0) return false;
  if (!permission || permission.trim() === '') return false;

  return user.permissions.includes(permission);
}

/**
 * Check if user has ANY of the specified permissions.
 *
 * @param user - Current user object with permissions array
 * @param permissions - Array of permission codes to check (OR logic)
 * @returns true if user has at least one permission
 *
 * @example
 * ```typescript
 * const user = {
 *   username: 'john',
 *   permissions: ['Roster.View'],
 *   isAuthenticated: true
 * };
 * hasAnyPermission(user, ['Roster.Edit', 'Roster.View']); // true
 * ```
 */
export function hasAnyPermission(
  user: CurrentUser | null,
  permissions: string[]
): boolean {
  if (!user || !user.isAuthenticated) return false;
  if (!user.permissions || user.permissions.length === 0) return false;
  if (!permissions || permissions.length === 0) return false;

  return permissions.some((perm) => user.permissions!.includes(perm));
}

/**
 * Create a CurrentUser object from AuthService signals.
 * Helper function to convert AuthService state to CurrentUser interface.
 *
 * @param auth - AuthService instance
 * @returns CurrentUser object
 *
 * @example
 * ```typescript
 * const auth = inject(AuthService);
 * const currentUser = getCurrentUser(auth);
 *
 * if (hasRole(currentUser, 'Admin')) {
 *   // Admin logic
 * }
 * ```
 */
export function getCurrentUser(auth: {
  username: () => string | null;
  myRoles: () => string[];
  myPermissions: () => string[];
  isAuthenticated: () => boolean;
}): CurrentUser {
  return {
    username: auth.username(),
    roles: auth.myRoles(),
    permissions: auth.myPermissions(),
    isAuthenticated: auth.isAuthenticated(),
  };
}
