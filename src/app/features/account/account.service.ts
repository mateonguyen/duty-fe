import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay, shareReplay } from 'rxjs/operators';
import { AccountProfile, ChangePasswordRequest } from './account.models';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private http = inject(HttpClient);
  private profileCache$?: Observable<AccountProfile>;

  getMyProfile(): Observable<AccountProfile> {
    if (!this.profileCache$) {
      this.profileCache$ = this.http
        .get<AccountProfile>('/api/account/me')
        .pipe(shareReplay(1));
    }
    return this.profileCache$;
  }

  updateMyProfile(profile: Partial<AccountProfile>): Observable<void> {
    // Clear cache when updating profile
    this.profileCache$ = undefined;
    return this.http.put<void>('/api/account/me', profile);
  }

  changePassword(req: ChangePasswordRequest): Observable<void> {
    console.log('changePassword mock', req);
    return of(void 0).pipe(delay(700));
  }
}
