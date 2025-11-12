import { inject } from '@angular/core';
import {
  CanMatchFn,
  CanActivateFn,
  Router,
  UrlTree,
  Route,
  UrlSegment,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from '../auth/auth.service';

function evaluate(
  required: string[] | undefined,
  stateUrl: string
): boolean | UrlTree {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: stateUrl },
    });
  }

  const perms = required ?? [];
  if (perms.length === 0) return true;

  return auth.hasAnyPermission(perms)
    ? true
    : router.createUrlTree(['/403'], { queryParams: { returnUrl: stateUrl } });
}

export const AuthGuardCanMatch: CanMatchFn = (
  route: Route,
  segments: UrlSegment[]
) => {
  const url = '/' + segments.map((s) => s.path).join('/');
  const required = (route.data as any)?.['permissions'] as string[] | undefined;
  return evaluate(required, url);
};

export const AuthGuardCanActivate: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const required = route.data?.['permissions'] as string[] | undefined;
  return evaluate(required, state.url);
};
