import { jwtDecode } from 'jwt-decode';

export interface DecodedToken {
  sub?: string;
  username?: string;
  permissions?: string[] | string;
  scopes?: string[] | string;
  [key: string]: any;
}

export function decodeToken(token: string | null): DecodedToken | null {
  if (!token) return null;
  try {
    const decoded = jwtDecode(token) as any;

    // Parse permissions if it's a JSON string
    if (typeof decoded.permissions === 'string') {
      try {
        decoded.permissions = JSON.parse(decoded.permissions);
      } catch {
        decoded.permissions = [];
      }
    }

    // Parse scopes if it's a JSON string
    if (typeof decoded.scopes === 'string') {
      try {
        decoded.scopes = JSON.parse(decoded.scopes);
      } catch {
        decoded.scopes = [];
      }
    }

    return decoded as DecodedToken;
  } catch {
    return null;
  }
}
