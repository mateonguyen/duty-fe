import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TokenService {
  private storageKey = 'duty.auth.token';
  token = signal<string | null>(this.getStoredToken());

  getToken() {
    return this.token();
  }
  setToken(token: string) {
    localStorage.setItem(this.storageKey, token);
    this.token.set(token);
  }
  clear() {
    localStorage.removeItem(this.storageKey);
    this.token.set(null);
  }
  private getStoredToken(): string | null {
    return localStorage.getItem(this.storageKey);
  }
}
