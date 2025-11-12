import { Injectable, inject } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, catchError, throwError, from, switchMap } from 'rxjs';
import { TokenService } from './token.service';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private tokens: TokenService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    const token = this.tokens.getToken();
    const router = inject(Router);
    const auth = inject(AuthService);

    // Attach Authorization only for API calls, except login/refresh endpoints
    const isApi = req.url.startsWith('/api');
    const isLogin = req.url.includes('/api/authtest/login');
    const isBootstrap = false; // bootstrap disabled in JWT-only mode

    // Debug logging
    console.debug(
      `[AuthInt] ${req.method} ${req.url}`,
      `attach=${!!token}`,
      `isAuth=${auth.isAuthenticated()}`,
      `authReady=${auth.isAuthReady()}`
    );

    // Wait for auth to be ready before attaching token (except for login and bootstrap itself)
    if (isApi && !isLogin && token) {
      return from(auth.authReady$).pipe(
        switchMap(() => {
          const currentToken = this.tokens.getToken();
          const authReq = currentToken
            ? req.clone({
                setHeaders: { Authorization: `Bearer ${currentToken}` },
              })
            : req;

          console.debug(
            `[AuthInt] After authReady: ${req.url}`,
            `token=${!!currentToken}`
          );

          return next.handle(authReq).pipe(
            catchError((err: any) => {
              if (err instanceof HttpErrorResponse) {
                if (err.status === 401) {
                  const phase = auth.isAuthReady()
                    ? 'post-auth-401'
                    : 'init-401';
                  if (phase === 'init-401') {
                    console.debug(
                      `[AuthInt] 401 (${phase}) - suppress logout`,
                      req.url
                    );
                  } else if (auth.isAuthenticated()) {
                    console.warn(
                      `[AuthInt] 401 (${phase}) - logging out once`,
                      req.url
                    );
                    auth.logout();
                  }
                } else if (err.status === 403) {
                  // leave as-is, route guard or caller will handle
                }
              }
              return throwError(() => err);
            })
          );
        })
      );
    }

    // For login or non-API requests, proceed immediately
    debugger;
    const authReq =
      token && isApi && !isLogin
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;

    return next.handle(authReq).pipe(
      catchError((err: any) => {
        if (err instanceof HttpErrorResponse) {
          if (err.status === 401) {
            const phase = auth.isAuthReady() ? 'post-auth-401' : 'init-401';
            if (phase === 'init-401') {
              console.debug(
                `[AuthInt] 401 (${phase}) - suppress logout`,
                req.url
              );
            } else if (auth.isAuthenticated()) {
              console.warn(
                `[AuthInt] 401 (${phase}) - logging out once`,
                req.url
              );
              auth.logout();
            }
          }
        }
        return throwError(() => err);
      })
    );
  }
}
