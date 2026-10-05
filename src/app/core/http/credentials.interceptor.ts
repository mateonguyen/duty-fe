import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const apiBase = environment.apiBaseUrl;
  if (
    req.url.startsWith('/api') ||
    req.url.startsWith('/auth') ||
    (apiBase && req.url.startsWith(apiBase))
  ) {
    const cloned = req.clone({ withCredentials: true });
    return next(cloned);
  }
  return next(req);
};
