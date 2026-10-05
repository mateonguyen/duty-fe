import { ErrorHandler, Injectable, inject, Injector } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Global error handler to catch all uncaught errors, including NG0203 (inject() outside injection context).
 * Logs detailed diagnostic information and shows user-friendly error messages.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  // Use injector to get services lazily (avoid circular deps)
  private injector = inject(Injector);

  handleError(error: any): void {
    let router: Router | null = null;
    try {
      router = this.injector.get(Router, null);
    } catch {}

    const currentRoute = router?.url || '(unknown)';
    const timestamp = new Date().toISOString();

    // Log detailed error info
    console.error('═══════════════════════════════════════════════════════');
    console.error('[GlobalErrorHandler] Uncaught error detected');
    console.error('[Timestamp]:', timestamp);
    console.error('[Route]:', currentRoute);
    console.error('[Error]:', error);

    // Check for NG0203 (inject() outside injection context)
    if (
      error?.message?.includes('NG0203') ||
      error?.code === 'NG0203' ||
      error?.message?.includes('inject() must be called')
    ) {
      console.error('❌ NG0203: inject() called outside injection context!');
      console.error('Stack trace:', error.stack);
      console.error('\nCommon causes:');
      console.error('  1. inject() in subscribe/promise/setTimeout callback');
      console.error(
        '  2. inject() in class method (not field initializer/constructor)'
      );
      console.error('  3. inject() in event handler');
      console.error('  4. Missing providers in standalone component');
      console.error('  5. inject() after component construction phase');

      // Show user-friendly message
      this.showErrorBanner('Có lỗi khởi tạo dữ liệu. Vui lòng tải lại trang.');
    } else if (error?.rejection) {
      // Unhandled promise rejection
      console.error('❌ Unhandled Promise Rejection:', error.rejection);
      console.error('Stack:', error.rejection?.stack || error.stack);
    } else {
      console.error('Full stack:', error.stack || '(no stack)');
    }

    console.error('═══════════════════════════════════════════════════════');

    // Don't crash the app - let it continue
    // Angular's default error handler would stop here
  }

  private showErrorBanner(message: string): void {
    // Simple banner at top of page (no dependencies on PrimeNG)
    if (typeof document === 'undefined') return;

    // Remove existing error banner if any
    const existing = document.getElementById('global-error-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'global-error-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #f44336;
      color: white;
      padding: 12px 16px;
      text-align: center;
      z-index: 9999;
      font-family: var(--app-font-family, 'Google Sans', Arial, sans-serif);
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
    `;

    const text = document.createElement('span');
    text.textContent = message;
    banner.appendChild(text);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.4);
      color: white;
      padding: 4px 12px;
      cursor: pointer;
      border-radius: 4px;
      font-size: 16px;
      font-weight: bold;
    `;
    closeBtn.onclick = () => banner.remove();
    banner.appendChild(closeBtn);

    document.body.insertBefore(banner, document.body.firstChild);

    // Auto-dismiss after 15 seconds
    setTimeout(() => {
      if (banner.parentNode) banner.remove();
    }, 15000);
  }
}
