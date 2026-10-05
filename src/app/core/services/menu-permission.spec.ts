import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { NAV_CONFIG } from '../config/nav.config';
import { AuthGuardCanActivate, AuthGuardCanActivateChild } from '../guards/auth.guard';
import { MenuService } from './menu.service';
import { ADMIN_ROUTES } from '../../features/admin/admin.routes';
import { SCHEDULE_ROUTES } from '../../features/schedule/schedule.routes';
import { PERMISSION_NAMES, UNIMPLEMENTED_PERMISSIONS } from '../../features/admin/access/permission-display';
import { RosterListComponent } from '../../features/schedule/roster-list/roster-list.component';
import { RosterApiService } from '../../features/schedule/roster-api.service';
import { ScopeService } from './scope.service';
import { RolesListComponent } from '../../features/admin/access/roles-list.component';
import { AuthApiService } from '../api/auth-api.service';
import { of } from 'rxjs';

describe('Menu and direct URL permissions', () => {
  const permissions = signal<string[]>([]);
  const auth = {
    permissions,
    username: signal('test.user'),
    isAuthenticated: signal(true),
    hasPermission: (code: string) => permissions().includes(code),
    hasAnyPermission: (codes: string[]) => codes.some(code => permissions().includes(code)),
  };
  let menu: MenuService;

  beforeEach(() => {
    permissions.set([]);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: RosterApiService, useValue: {} },
        { provide: ScopeService, useValue: {} },
        { provide: AuthApiService, useValue: {
          updateRolePermissions: jasmine.createSpy('updateRolePermissions').and.returnValue(of(undefined)),
          getRoles: () => of([]),
        } },
      ],
    });
    menu = TestBed.inject(MenuService);
  });

  it('hides and shows every protected menu item when its permission changes', () => {
    const items = NAV_CONFIG.flatMap(root => [root, ...(root.children || [])])
      .filter(item => item.requiredPermissions?.length && !item.separator && !item.isGroupHeader);
    expect(items.length).toBeGreaterThan(10);
    for (const item of items) {
      permissions.set([]);
      expect(menu.canShow(item)).withContext(`${item.id} without permission`).toBeFalse();
      for (const code of item.requiredPermissions!) {
        permissions.set([code]);
        expect(menu.canShow(item)).withContext(`${item.id} with ${code}`).toBeTrue();
      }
    }
  });

  it('has a Vietnamese label for every listed permission', () => {
    expect(Object.keys(PERMISSION_NAMES).length).toBe(27);
    for (const [code, label] of Object.entries(PERMISSION_NAMES)) {
      expect(label).withContext(code).not.toBe(code);
      expect(label).withContext(code).toMatch(/^[A-ZÀ-Ỹ]/);
    }
    expect(UNIMPLEMENTED_PERMISSIONS.size).toBe(6);
  });

  it('keeps personal travel menu visible when unit-wide travel rights are off', () => {
    const travel = NAV_CONFIG.find(item => item.id === 'topbar-travel')!;
    permissions.set([]);
    expect(menu.canShow(travel)).toBeTrue();
  });

  it('blocks a direct admin child URL and allows it after granting the permission', async () => {
    const route = { data: { permissions: ['user.manage'] } } as any;
    const state = { url: '/admin/access/roles' } as any;
    permissions.set([]);
    const denied = await TestBed.runInInjectionContext(() => AuthGuardCanActivateChild(route, state));
    expect(denied).toEqual(TestBed.inject(Router).createUrlTree(['/403'], { queryParams: { returnUrl: state.url } }));
    permissions.set(['user.manage']);
    expect(await TestBed.runInInjectionContext(() => AuthGuardCanActivateChild(route, state))).toBeTrue();
  });

  it('guards every private admin page and the monitoring page', () => {
    const parent = ADMIN_ROUTES[0];
    expect(parent.canActivateChild).toContain(AuthGuardCanActivateChild);
    for (const child of parent.children || []) {
      if (child.redirectTo) continue;
      expect((child.data?.['permissions'] || []).length)
        .withContext(`admin/${child.path}`).toBeGreaterThan(0);
    }
    const monitor = SCHEDULE_ROUTES.find(route => route.path === 'monitoring')!;
    expect(monitor.data?.['permissions']).toEqual(['roster.view']);
    expect(monitor.canActivate?.length).toBeGreaterThan(0);
  });

  it('denies and then allows each protected admin and schedule route', async () => {
    const protectedRoutes = [
      ...(ADMIN_ROUTES[0].children || []).filter(route => !route.redirectTo)
        .map(route => ({ route, guard: AuthGuardCanActivateChild, url: `/admin/${route.path}` })),
      ...SCHEDULE_ROUTES.filter(route => route.canActivate && route.data?.['permissions'])
        .map(route => ({ route, guard: AuthGuardCanActivate, url: `/schedule/${route.path}` })),
    ];
    for (const { route, guard, url } of protectedRoutes) {
      const state = { url } as any;
      permissions.set([]);
      const denied = await TestBed.runInInjectionContext(() => guard(route as any, state));
      expect(denied).withContext(`${url} without permission`).not.toBeTrue();
      for (const code of route.data?.['permissions'] || []) {
        permissions.set([code]);
        expect(await TestBed.runInInjectionContext(() => guard(route as any, state)))
          .withContext(`${url} with ${code}`).toBeTrue();
      }
    }
  });

  it('shows roster actions only with the matching permission and draft state', () => {
    const page = TestBed.createComponent(RosterListComponent).componentInstance;
    const draft = { status: 'DRAFT' } as any;
    const published = { status: 'PUBLISHED' } as any;
    permissions.set([]);
    expect(page.canCreate()).toBeFalse();
    expect(page.canEdit(draft)).toBeFalse();
    expect(page.canPublish(draft)).toBeFalse();
    expect(page.canDelete(draft)).toBeFalse();

    permissions.set(['roster.create']);
    expect(page.canCreate()).toBeTrue();
    expect(page.canEdit(draft)).toBeFalse();
    permissions.set(['roster.edit']);
    expect(page.canEdit(draft)).toBeTrue();
    expect(page.canEdit(published)).toBeFalse();
    expect(page.canLock(draft)).toBeTrue();
    permissions.set(['roster.publish']);
    expect(page.canPublish(draft)).toBeTrue();
    expect(page.canUnpublish(published)).toBeTrue();
    expect(page.canDelete(draft)).toBeFalse();
    permissions.set(['roster.delete']);
    expect(page.canDelete(draft)).toBeTrue();
    expect(page.canDelete(published)).toBeFalse();
  });

  it('saves each editable switch and ignores legacy switches without an operation', () => {
    const page = TestBed.createComponent(RolesListComponent).componentInstance;
    const api = TestBed.inject(AuthApiService);
    page.currentRole = { code: 'custom', name: 'Vai trò thử', isSystemRole: false, permissions: [] } as any;
    page.allPermissions = [
      { code: 'catalog.view', name: 'Xem danh mục' },
      { code: 'catalog.create', name: 'Tạo danh mục' },
      { code: 'roster.approve', name: 'Phê duyệt lịch' },
    ] as any;
    page.editedPerms = new Set<string>();
    page.togglePermission('catalog.view', true);
    page.togglePermission('catalog.create', true);
    page.togglePermission('roster.approve', true);
    expect([...page.editedPerms]).toEqual(['catalog.view', 'catalog.create']);
    page.togglePermission('catalog.view', false);
    expect(page.editedPerms.size).toBe(0);
    page.togglePermission('catalog.create', true);
    page.savePermissions();
    expect(api.updateRolePermissions).toHaveBeenCalledWith('custom', ['catalog.create', 'catalog.view']);
  });

  it('edits a seeded role while keeping the bootstrap administrator protected', () => {
    const page = TestBed.createComponent(RolesListComponent).componentInstance;
    const api = TestBed.inject(AuthApiService);
    page.allPermissions = [{ code: 'roster.view', name: 'Xem lịch trực' }] as any;
    page.currentRole = { code: 'roster.editor', name: 'Lập lịch', isSystemRole: true, permissions: [] } as any;
    page.editedPerms = new Set(['roster.view']);
    expect(page.isProtectedRole('roster.editor')).toBeFalse();
    page.savePermissions();
    expect(api.updateRolePermissions).toHaveBeenCalledWith('roster.editor', ['roster.view']);

    page.currentRole = { code: 'DIRECTORY_ADMIN', name: 'Quản trị gốc', isSystemRole: true, permissions: [] } as any;
    page.editedPerms = new Set(['roster.view']);
    expect(page.isProtectedRole('DIRECTORY_ADMIN')).toBeTrue();
    page.savePermissions();
    expect(api.updateRolePermissions).toHaveBeenCalledTimes(1);
  });

  it('shows only the three business roles after retiring unused templates', () => {
    const page = TestBed.createComponent(RolesListComponent).componentInstance;
    page.roles = [
      { code: 'admin', name: 'Quản trị viên', active: true },
      { code: 'viewer', name: 'Người dùng', active: true },
      { code: 'roster.editor', name: 'Người lập lịch trực', active: true },
      { code: 'manager', name: 'Quản lý', active: false },
      { code: 'DIRECTORY_ADMIN', name: 'Quản trị gốc', active: true },
    ] as any;
    expect(page.filteredRoles.map(role => role.code)).toEqual(['admin', 'viewer', 'roster.editor']);
  });
});
