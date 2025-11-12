import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DiagnosticsService {
  // Counters
  bootstrapCount = signal(0);
  rosterLoadCount = signal(0);
  staffTreeReloadCount = signal(0);
  scopesLoadCount = signal(0);

  constructor() {
    // Expose for dev tools and E2E assertions
    try {
      (window as any).__diag = {
        get bootstrap() {
          return (window as any).__ngDiag.bootstrapCount();
        },
        get rosterLoads() {
          return (window as any).__ngDiag.rosterLoadCount();
        },
        get staffTreeReloads() {
          return (window as any).__ngDiag.staffTreeReloadCount();
        },
        get scopesLoads() {
          return (window as any).__ngDiag.scopesLoadCount();
        },
      };
      (window as any).__ngDiag = this;
    } catch {}
  }

  incBootstrap() {
    this.bootstrapCount.set(this.bootstrapCount() + 1);
  }

  incRosterLoad() {
    this.rosterLoadCount.set(this.rosterLoadCount() + 1);
  }

  incStaffTreeReload() {
    this.staffTreeReloadCount.set(this.staffTreeReloadCount() + 1);
  }

  incScopesLoad() {
    this.scopesLoadCount.set(this.scopesLoadCount() + 1);
  }
}
