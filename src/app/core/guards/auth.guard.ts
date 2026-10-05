import { inject } from '@angular/core';
import {
  CanMatchFn,
  CanActivateFn,
  CanActivateChildFn,
  Route,
  UrlSegment,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  UrlTree,
} from '@angular/router';
import { AuthService } from '../auth/auth.service';

async function evaluate(
  required: string[] | undefined,
  stateUrl: string,
): Promise<boolean | UrlTree> {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Try loading user from BFF if not already authenticated
  if (!auth.isAuthenticated()) {
    await auth.loadMe();
  }

  // If still not authenticated after loadMe, redirect to BFF login
  if (!auth.isAuthenticated()) {
    if (auth.sessionState() === 'forbidden') return router.createUrlTree(['/403']);
    if (auth.sessionState() === 'unauthenticated' && auth.tryAutomaticLogin(window.location.origin + stateUrl)) return false;
    return router.createUrlTree(['/session-error'], { queryParams: { returnUrl: stateUrl } });
  }

  // Check permissions if required
  const perms = required ?? [];
  if (perms.length === 0) return true;

  if (!auth.hasAnyPermission(perms)) {
    // Redirect to 403 forbidden
    return router.createUrlTree(['/403'], { queryParams: { returnUrl: stateUrl } });
  }

  return true;
}

export const AuthGuardCanMatch: CanMatchFn = async (
  route: Route,
  segments: UrlSegment[],
) => {
  const url = '/' + segments.map((s) => s.path).join('/');
  const required = (route.data as any)?.['permissions'] as string[] | undefined;
  return evaluate(required, url);
};

export const AuthGuardCanActivate: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const required = route.data?.['permissions'] as string[] | undefined;
  return evaluate(required, state.url);
};

export const AuthGuardCanActivateChild: CanActivateChildFn = async (route, state) => {
  const required = route.data?.['permissions'] as string[] | undefined;
  return evaluate(required, state.url);
};
