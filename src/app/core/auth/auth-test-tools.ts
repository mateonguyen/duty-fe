import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

/**
 * Dev utility to simulate token expiry immediately. Next secured call should yield 401.
 */
export function expireTokenNow() {
  const auth = inject(AuthService);
  const tokens = inject(TokenService);
  const fake = `EXPIRED.${Date.now()}`; // invalid signature format
  tokens.setToken(fake);
  // Do NOT mark authenticated; keep existing state. Interceptor will treat 401 as post-auth if ready.
  console.warn(
    '[AuthTestTools] Token force-expired (invalid). Next API call should 401.'
  );
}

// Expose globally in dev for console usage
try {
  (window as any).expireTokenNow = expireTokenNow;
} catch {}
