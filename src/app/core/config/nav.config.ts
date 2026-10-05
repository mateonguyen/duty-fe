/**
 * Centralized navigation menu configuration for both top-bar and admin sidebar.
 *
 * Purpose: Single source of truth for menu structure and permissions.
 * - Top-bar (app-layout) uses this config to build PrimeNG Menubar
 * - Admin sidebar (admin-layout) uses this config to render permission-filtered items
 *
 * Permission Logic:
 * - requiredPermissions: string[] -> user must have ANY of these permissions (OR logic via hasAnyPermission)
 * - If item has no requiredPermissions -> always visible
 * - Nested items inherit NO implicit permissions from parent; each item checks independently
 *
 * Usage:
 * ```typescript
 * import { NAV_CONFIG, MenuItem } from './nav.config';
 *
 * const catalogItems = NAV_CONFIG.filter(item => item.group === 'ADMIN_CATALOG');
 * ```
 */

export interface NavMenuItem {
  /** Unique identifier for this menu item */
  id: string;

  /** Display label (Vietnamese) */
  label: string;

  /** Router path (e.g., '/admin/catalog/duty-locations') */
  route?: string;

  /** PrimeNG icon class (e.g., 'pi pi-map-marker') */
  icon?: string;

  /**
   * Group classification:
   * - ADMIN_CATALOG: 'Danh mục' group in admin sidebar
   * - ADMIN_ACCESS: 'Quản trị' group in admin sidebar (roles, users, config)
   * - SCHEDULE: 'Lịch trực' menu in top-bar
   * - REPORTS: 'Báo cáo' menu in top-bar
   * - TOPBAR_ADMIN: 'Quản trị' dropdown in top-bar (combines catalog + access)
   */
  group:
    | 'ADMIN_CATALOG'
    | 'ADMIN_ACCESS'
    | 'SCHEDULE'
    | 'REPORTS'
    | 'TOPBAR_ADMIN';

  /**
   * Display order within group (lower = higher priority).
   * Used for sorting items in sidebar rendering.
   */
  order: number;

  /**
   * Required permissions for visibility (OR logic).
   * If array is provided, user needs ANY ONE of these permissions.
   * If undefined/empty, item is always visible to authenticated users.
   *
   * Examples:
   * - ['catalog.view'] -> user needs catalog.view
   * - ['user.manage', 'role.assign'] -> user needs user.manage OR role.assign
   */
  requiredPermissions?: string[];

  /**
   * Child items for nested menus (e.g., top-bar dropdowns).
   * Each child has its own permission checks; no inheritance.
   */
  children?: NavMenuItem[];

  /**
   * Whether this is a separator (visual divider in menus).
   * Separators have no label/route/permissions.
   */
  separator?: boolean;

  /**
   * Whether this is a disabled group header (e.g., "DANH MỤC" label).
   * Group headers are not clickable but provide visual structure.
   */
  isGroupHeader?: boolean;
}

/**
 * Global navigation menu configuration.
 * All menu items for top-bar and admin sidebar.
 *
 * Notes:
 * - Top-bar uses TOPBAR_ADMIN group (combines catalog + access into single 'Quản trị' dropdown)
 * - Admin sidebar uses ADMIN_CATALOG and ADMIN_ACCESS groups (separate sections)
 * - SCHEDULE and REPORTS groups are top-bar only (not shown in admin sidebar)
 * - requiredPermissions use OR logic: ['catalog.view', 'catalog.edit'] means user needs ANY of these
 * - Group headers (isGroupHeader: true) and separators (separator: true) are preserved from original top-bar design
 */
export const NAV_CONFIG: NavMenuItem[] = [
  {
    id: 'sidebar-access-roles', label: 'Vai trò và quyền',
    route: '/admin/access/roles', icon: 'pi pi-key', group: 'ADMIN_ACCESS',
    order: 2, requiredPermissions: ['user.manage'],
  },
  {
    id: 'sidebar-directory-sync', label: 'Tổ chức và cán bộ',
    route: '/admin/directory/personnel', icon: 'pi pi-sitemap', group: 'ADMIN_ACCESS',
    order: 4, requiredPermissions: ['system.config', 'role.assign'],
  },
  // ================== TOP-BAR: Quản trị dropdown ==================
  {
    id: 'topbar-admin-root',
    label: 'Quản trị',
    icon: 'pi pi-cog',
    group: 'TOPBAR_ADMIN',
    order: 1,
    // Top-level permission: show if user has ANY catalog or admin permission
    requiredPermissions: [
      'catalog.view',
      'catalog.create',
      'catalog.edit',
      'catalog.delete',
      'user.manage',
      'role.assign',
      'system.config',
    ],
    children: [
      // ---- Catalog group header ----
      {
        id: 'topbar-catalog-header',
        label: 'Danh mục',
        group: 'TOPBAR_ADMIN',
        order: 1,
        isGroupHeader: true,
      },
      {
        id: 'topbar-catalog-locations',
        label: 'Địa điểm trực',
        route: '/admin/catalog/duty-locations',
        icon: 'pi pi-map-marker',
        group: 'TOPBAR_ADMIN',
        order: 2,
        requiredPermissions: ['catalog.view'],
      },
      {
        id: 'topbar-catalog-shifts',
        label: 'Ca trực',
        route: '/admin/catalog/shifts',
        icon: 'pi pi-clock',
        group: 'TOPBAR_ADMIN',
        order: 3,
        requiredPermissions: ['catalog.view'],
      },
      // ---- Separator ----
      {
        id: 'topbar-separator-1',
        label: '',
        group: 'TOPBAR_ADMIN',
        order: 5,
        separator: true,
      },
      // ---- Access group header ----
      {
        id: 'topbar-access-header',
        label: 'Quản trị',
        group: 'TOPBAR_ADMIN',
        order: 6,
        isGroupHeader: true,
        requiredPermissions: ['user.manage', 'role.assign'],
      },
      {
        id: 'topbar-directory-sync', label: 'Tổ chức và cán bộ',
        route: '/admin/directory/personnel', icon: 'pi pi-sitemap', group: 'TOPBAR_ADMIN',
        order: 7, requiredPermissions: ['system.config', 'role.assign'],
      },
      {
        id: 'topbar-access-roles', label: 'Vai trò và quyền',
        route: '/admin/access/roles', icon: 'pi pi-key', group: 'TOPBAR_ADMIN',
        order: 8, requiredPermissions: ['user.manage'],
      },
      {
        id: 'topbar-access-system-config',
        label: 'Cấu hình hệ thống',
        route: '/admin/system-config',
        icon: 'pi pi-cog',
        group: 'TOPBAR_ADMIN',
        order: 9,
        requiredPermissions: ['system.config'], // matches route guard
      },
    ],
  },

  // ================== TOP-BAR: Lịch trực dropdown ==================
  {
    id: 'topbar-schedule-root',
    label: 'Lịch trực',
    icon: 'pi pi-calendar',
    group: 'SCHEDULE',
    order: 1,
    requiredPermissions: ['roster.view', 'roster.create'],
    children: [
      {
        id: 'topbar-schedule-list',
        label: 'Danh sách kỳ lịch',
        route: '/schedule/rosters',
        icon: 'pi pi-list',
        group: 'SCHEDULE',
        order: 1,
        requiredPermissions: ['roster.view'],
      },
      {
        id: 'topbar-schedule-create',
        label: 'Tạo kỳ lịch mới',
        route: '/schedule/rosters/new',
        icon: 'pi pi-calendar-plus',
        group: 'SCHEDULE',
        order: 2,
        requiredPermissions: ['roster.create'],
      },
      {
        id: 'topbar-schedule-separator',
        label: '',
        group: 'SCHEDULE',
        order: 3,
        separator: true,
      },
      {
        id: 'topbar-schedule-monitoring',
        label: 'Giám sát trực',
        route: '/schedule/monitoring',
        icon: 'pi pi-eye',
        group: 'SCHEDULE',
        order: 4,
        requiredPermissions: ['roster.view'],
      },
    ],
  },

  // ================== TOP-BAR: Báo cáo dropdown ==================
  {
    id: 'topbar-reports-root',
    label: 'Báo cáo',
    icon: 'pi pi-chart-bar',
    group: 'REPORTS',
    order: 1,
    requiredPermissions: ['report.view'],
    children: [
      {
        id: 'topbar-reports-by-shift',
        label: 'Tổng hợp theo ca',
        route: '/reports/by-shift',
        icon: 'pi pi-chart-line',
        group: 'REPORTS',
        order: 1,
        requiredPermissions: ['report.view'],
      },
      {
        id: 'topbar-reports-by-user',
        label: 'Theo cán bộ',
        route: '/reports/by-user',
        icon: 'pi pi-users',
        group: 'REPORTS',
        order: 2,
        requiredPermissions: ['report.view'],
      },
    ],
  },

  // ================== TOP-BAR: Giấy tờ công tác ==================
  {
    id: 'topbar-travel',
    label: 'Giấy tờ công tác',
    icon: 'pi pi-briefcase',
    group: 'SCHEDULE',
    order: 2,
    children: [
      { id: 'topbar-travel-orders', label: 'Giấy đi đường', route: '/travel', icon: 'pi pi-map', group: 'SCHEDULE', order: 1 },
      { id: 'topbar-introduction', label: 'Giấy giới thiệu', route: '/introduction-letters', icon: 'pi pi-file', group: 'SCHEDULE', order: 2 },
    ],
  },

  // ================== ADMIN SIDEBAR: Danh mục section ==================
  {
    id: 'sidebar-catalog-locations',
    label: 'Địa điểm trực',
    route: '/admin/catalog/duty-locations',
    icon: 'pi pi-map-marker',
    group: 'ADMIN_CATALOG',
    order: 1,
    requiredPermissions: ['catalog.view'],
  },
  {
    id: 'sidebar-catalog-shifts',
    label: 'Ca trực',
    route: '/admin/catalog/shifts',
    icon: 'pi pi-clock',
    group: 'ADMIN_CATALOG',
    order: 2,
    requiredPermissions: ['catalog.view'],
  },

  // ================== ADMIN SIDEBAR: Quản trị section ==================
  {
    id: 'sidebar-access-system-config',
    label: 'Cấu hình hệ thống',
    route: '/admin/system-config',
    icon: 'pi pi-cog',
    group: 'ADMIN_ACCESS',
    order: 3,
    requiredPermissions: ['system.config'], // matches route guard: system.config
  },
];
