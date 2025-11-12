import { inject, Injectable } from '@angular/core';
import {
  CanActivateFn,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthService } from './auth.service';

// Functional guard style (Angular >=15)
export const PermissionGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  console.debug(
    '[PermissionGuard]',
    state.url,
    'isAuth=',
    auth.isAuthenticated()
  );

  // First check: if not authenticated, redirect to login WITHOUT calling hasPermission
  if (!auth.isAuthenticated()) {
    console.debug('[PermissionGuard] Not authenticated - redirecting to login');
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  const required: string[] = route.data?.['permissions'] || [];
  if (!required || required.length === 0) {
    console.debug('[PermissionGuard] No permissions required - allowing');
    return true; // no permissions required
  }

  const has = auth.hasAnyPermission(required);
  console.debug(
    '[PermissionGuard] Required:',
    required,
    'Has:',
    has,
    'UserPerms:',
    auth.getAllPermissions()
  );

  if (has) return true;

  // navigate to forbidden
  console.warn('[PermissionGuard] Permission denied - redirecting to /403');
  return router.createUrlTree(['/403'], {
    queryParams: { returnUrl: state.url },
  });
};
