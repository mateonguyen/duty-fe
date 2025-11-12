import { Injectable, inject } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable()
export class HttpDebugInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    if (!environment.debugHttp) {
      return next.handle(req);
    }
    const forbidden = [
      '/api/me/bootstrap',
      '/api/authtest/whoami',
      '/api/auth/roles',
      // '/api/scopes/effective' is allowed for runtime scope loading (stateless pages)
    ];
    const suspicious = forbidden.some((p) => req.url.includes(p));
    if (suspicious) {
      // Dev-only log for unexpected auth/scope traffic
      console.warn(
        '[HttpDebug] Forbidden endpoint called:',
        req.method,
        req.url
      );
    }
    return next.handle(req).pipe(
      tap({
        error: (err) => {
          if (suspicious) {
            console.warn('[HttpDebug] Error on suspicious call', err);
          }
        },
      })
    );
  }
}
