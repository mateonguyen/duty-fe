import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    // If not on SSO callback, ensure splash is hidden after bootstrap
    const hasCode = new URLSearchParams(window.location.search).has('code');
    if (!hasCode) {
      (window as any).hideSplash?.();
    }
  })
  .catch((err) => console.error(err));
