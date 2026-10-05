import { computed, inject, Injectable, Signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { NAV_CONFIG, NavMenuItem } from '../config/nav.config';

/**
 * Menu service for centralized navigation logic.
 *
 * Purpose: Provide reactive, permission-filtered menu items for both top-bar and admin sidebar.
 * - canShow(): Check if user has required permissions for a menu item
 * - filterMenuByGroup(): Get filtered menu items for specific group (e.g., ADMIN_CATALOG)
 * - buildPrimeNGMenu(): Convert NavMenuItem[] to PrimeNG MenuItem[] for Menubar
 *
 * Permission Logic (matches top-bar exactly):
 * - If requiredPermissions is undefined/empty -> always visible
 * - If requiredPermissions is string[] -> user needs ANY permission (OR logic via hasAnyPermission)
 *
 * Reactive Behavior:
 * - All computed signals depend on auth.whoamiSnapshot()
 * - Menu auto-updates when token/permissions change
 * - No manual subscription needed
 *
 * Usage:
 * ```typescript
 * const menuService = inject(MenuService);
 *
 * // In component
 * catalogItems = menuService.filterMenuByGroup('ADMIN_CATALOG');
 * canShow = menuService.canShow(item);
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class MenuService {
  private auth = inject(AuthService);

  /**
   * Check if a menu item should be visible based on user permissions.
   *
   * Logic (matches top-bar exactly):
   * - No requiredPermissions -> always visible
   * - requiredPermissions: string[] -> user needs ANY permission (hasAnyPermission)
   *
   * @param item - Menu item to check
   * @returns true if user has required permissions, false otherwise
   *
   * @example
   * ```typescript
   * const item = { label: 'Locations', requiredPermissions: ['catalog.view'] };
   * if (menuService.canShow(item)) {
   *   // render item
   * }
   * ```
   */
  canShow(item: NavMenuItem): boolean {
    // Items with no permission requirement are always visible
    if (!item.requiredPermissions || item.requiredPermissions.length === 0) {
      return true;
    }

    // OR logic: user needs ANY of the specified permissions
    return this.auth.hasAnyPermission(item.requiredPermissions);
  }

  /**
   * Get filtered menu items for a specific group, sorted by order.
   * Reactive: auto-updates when auth state changes.
   *
   * @param group - Menu group to filter (e.g., 'ADMIN_CATALOG', 'ADMIN_ACCESS')
   * @returns Signal of filtered and sorted menu items
   *
   * @example
   * ```typescript
   * // In component
   * catalogItems = menuService.filterMenuByGroup('ADMIN_CATALOG');
   *
   * // In template
   * @for (item of catalogItems(); track item.id) {
   *   <a [routerLink]="item.route">{{ item.label }}</a>
   * }
   * ```
   */
  filterMenuByGroup(group: NavMenuItem['group']): Signal<NavMenuItem[]> {
    return computed(() => {
      // Force dependency on auth state for reactivity
      const snapshot = {
        username: this.auth.username() || '',
        permissions: this.auth.permissions(),
      };
      void snapshot; // trigger recomputation on auth change

      const groupItems = NAV_CONFIG.filter((item) => item.group === group);
      const filtered = groupItems.filter((item) => this.canShow(item));

      // Debug logging in dev mode
      this.logMenuFiltering(group, groupItems, filtered, snapshot);

      return filtered.sort((a, b) => a.order - b.order);
    });
  }

  /**
   * Check if a menu group should be visible (at least one child is visible).
   * Used for collapsible sections in admin sidebar.
   *
   * @param group - Menu group to check
   * @returns Signal indicating if group has any visible items
   *
   * @example
   * ```typescript
   * // Show catalog section only if user can see at least one catalog item
   * shouldShowCatalogSection = menuService.hasVisibleItemsInGroup('ADMIN_CATALOG');
   * ```
   */
  hasVisibleItemsInGroup(group: NavMenuItem['group']): Signal<boolean> {
    return computed(() => {
      const snapshot = {
        username: this.auth.username() || '',
        permissions: this.auth.permissions(),
      };
      void snapshot;

      return NAV_CONFIG.some(
        (item) => item.group === group && this.canShow(item),
      );
    });
  }

  /**
   * Get ALL top-bar menu groups (TOPBAR_ADMIN, SCHEDULE, REPORTS) as PrimeNG-compatible structure.
   * This is used by app-layout to build the Menubar.
   *
   * Filtering logic (matches original top-bar exactly):
   * - Check parent permission first (if parent fails, entire group hidden)
   * - Recursively filter children based on their own permissions
   * - Remove separators if they become leading/trailing after filtering
   *
   * @returns Signal of PrimeNG MenuItem[] for top-bar Menubar
   *
   * @example
   * ```typescript
   * // In app-layout.component.ts
   * menuItems = this.menuService.getTopBarMenu();
   *
   * // In template
   * <p-menubar [model]="menuItems()" />
   * ```
   */
  getTopBarMenu(): Signal<any[]> {
    return computed(() => {
      const snapshot = {
        username: this.auth.username() || '',
        permissions: this.auth.permissions(),
      };
      void snapshot;

      // Get root-level menu items (TOPBAR_ADMIN, SCHEDULE, REPORTS)
      const rootItems = NAV_CONFIG.filter(
        (item) =>
          item.group === 'TOPBAR_ADMIN' ||
          item.group === 'SCHEDULE' ||
          item.group === 'REPORTS',
      );

      const filtered = this.filterMenuRecursive(rootItems);

      // Debug logging in dev mode
      this.logTopBarFiltering(rootItems, filtered, snapshot);

      return filtered;
    });
  }

  /**
   * Recursively filter menu items based on permissions.
   * Matches original top-bar logic exactly:
   * - Check parent permission first
   * - Filter children recursively
   * - Remove empty parents (no children after filtering and no own route)
   * - Clean up orphaned separators
   *
   * @param items - Menu items to filter
   * @returns Filtered menu items in PrimeNG format
   */
  private filterMenuRecursive(items: NavMenuItem[]): any[] {
    return items
      .map((item) => {
        // Check parent permission first
        if (!this.canShow(item)) {
          return null;
        }

        // Recursively filter children
        let filteredChildren = item.children
          ? this.filterMenuRecursive(item.children)
          : undefined;

        // Clean up separators and group headers after filtering
        if (filteredChildren) {
          // Remove leading separators
          while (
            filteredChildren.length > 0 &&
            (filteredChildren[0].separator || filteredChildren[0].disabled)
          ) {
            filteredChildren.shift();
          }

          // Remove trailing separators
          while (
            filteredChildren.length > 0 &&
            (filteredChildren[filteredChildren.length - 1].separator ||
              filteredChildren[filteredChildren.length - 1].disabled)
          ) {
            filteredChildren.pop();
          }

          // Remove consecutive separators
          filteredChildren = filteredChildren.filter((child, idx, arr) => {
            if (!child.separator) return true;
            return idx === 0 || !arr[idx - 1].separator;
          });
        }

        // Leaf item (no children)
        if (!item.children) {
          return this.toPrimeNGMenuItem(item);
        }

        // Parent with valid children after filtering
        if (filteredChildren && filteredChildren.length > 0) {
          return {
            ...this.toPrimeNGMenuItem(item),
            items: filteredChildren,
          };
        }

        // Parent with no valid children and no own route -> hide
        if (!item.route) {
          return null;
        }

        // Parent has route and passed permission check -> keep as leaf
        return {
          ...this.toPrimeNGMenuItem(item),
          items: undefined,
        };
      })
      .filter(Boolean);
  }

  /**
   * Convert NavMenuItem to PrimeNG MenuItem format.
   *
   * @param item - NavMenuItem to convert
   * @returns PrimeNG-compatible MenuItem object
   */
  private toPrimeNGMenuItem(item: NavMenuItem): any {
    // Separator
    if (item.separator) {
      return { separator: true };
    }

    // Group header (disabled label)
    if (item.isGroupHeader) {
      return {
        label: item.label,
        disabled: true,
        styleClass: 'menu-group',
      };
    }

    // Regular item
    return {
      id: item.id,
      label: item.label,
      icon: item.icon,
      routerLink: item.route,
      routerLinkActiveOptions: { exact: true },
      // styleClass will be added dynamically by app-layout for active state
    };
  }

  /**
   * Debug utility: Log filtered menu for troubleshooting.
   * Only logs in development mode.
   *
   * @param group - Optional group to filter logs
   */
  debugMenu(group?: NavMenuItem['group']): void {
    if (typeof window === 'undefined') return;
    // @ts-ignore
    if (window['ngDevMode'] === false) return;

    const snapshot = {
      username: this.auth.username() || '',
      permissions: this.auth.permissions(),
    };
    console.debug('[MenuService] Debug menu visibility', {
      user: snapshot?.username,
      permissions: snapshot?.permissions || [],
      group: group || 'ALL',
    });

    const itemsToCheck = group
      ? NAV_CONFIG.filter((item) => item.group === group)
      : NAV_CONFIG;

    itemsToCheck.forEach((item) => {
      const visible = this.canShow(item);
      console.debug(`[MenuService] ${visible ? '✅' : '❌'} ${item.label}`, {
        id: item.id,
        requiredPermissions: item.requiredPermissions,
        visible,
      });
    });
  }

  /**
   * Internal: Log menu filtering for a specific group (dev mode only).
   */
  private logMenuFiltering(
    group: NavMenuItem['group'],
    allItems: NavMenuItem[],
    filteredItems: NavMenuItem[],
    snapshot: any,
  ): void {
    if (typeof window === 'undefined') return;
    // @ts-ignore
    if (window['ngDevMode'] === false) return;

    const hiddenItems = allItems.filter(
      (item) => !filteredItems.find((f) => f.id === item.id),
    );

    if (hiddenItems.length > 0) {
      console.debug(`[MenuService] ${group} group filtered`, {
        user: snapshot?.username,
        permissions: snapshot?.permissions || [],
        visible: filteredItems.map((i) => i.label),
        hidden: hiddenItems.map((i) => ({
          label: i.label,
          requiredPermissions: i.requiredPermissions,
          reason: i.requiredPermissions
            ? `Missing permissions: ${i.requiredPermissions.join(', ')}`
            : 'Unknown',
        })),
      });
    }
  }

  /**
   * Internal: Log top-bar menu filtering (dev mode only).
   */
  private logTopBarFiltering(
    allItems: NavMenuItem[],
    filteredItems: any[],
    snapshot: any,
  ): void {
    if (typeof window === 'undefined') return;
    // @ts-ignore
    if (window['ngDevMode'] === false) return;

    console.debug('[MenuService] Top-bar menu built', {
      user: snapshot?.username,
      permissions: snapshot?.permissions || [],
      totalGroups: allItems.length,
      visibleGroups: filteredItems.length,
      groups: filteredItems.map((g) => ({
        label: g.label,
        childCount: g.items?.length || 0,
      })),
    });
  }
}
