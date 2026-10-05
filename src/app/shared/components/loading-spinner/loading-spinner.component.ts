import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-loading-spinner',
  imports: [CommonModule],
  template: `
    <div
      *ngIf="visible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-teal-900/40 via-teal-800/30 to-teal-900/40 backdrop-blur-sm"
    >
      <div class="flex flex-col items-center gap-4">
        <div class="spinner-container">
          <ng-container *ngIf="videoUrl; else imageSpinner">
            <video
              [src]="videoUrl"
              autoplay
              loop
              muted
              playsinline
              class="w-24 h-24 md:w-32 md:h-32 object-contain"
            ></video>
          </ng-container>
          <ng-template #imageSpinner>
            <img
              [src]="imageUrl || 'assets/loading.svg'"
              alt="Loading..."
              class="w-24 h-24 md:w-32 md:h-32 object-contain"
            />
          </ng-template>
        </div>
        <div *ngIf="loadingText" class="text-center">
          <p class="text-white text-lg font-semibold mb-1">{{ loadingText }}</p>
          <p *ngIf="subText" class="text-white/80 text-sm">{{ subText }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .spinner-container {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .animate-spin-slow {
        animation: spin 2s linear infinite;
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      /* Pulse animation for image spinner */
      .animate-pulse-scale {
        animation: pulse-scale 1.5s ease-in-out infinite;
      }

      @keyframes pulse-scale {
        0%,
        100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.05);
          opacity: 0.8;
        }
      }
    `,
  ],
})
export class LoadingSpinnerComponent implements OnChanges, OnDestroy {
  @Input() isLoading = false;
  @Input() minDurationMs = 600;
  @Input() imageUrl?: string;
  @Input() videoUrl?: string;
  @Input() loadingText?: string;
  @Input() subText?: string;

  visible = false;

  private loadingStart = 0;
  private hideTimer: any = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['isLoading']) return;

    const next = this.isLoading;

    if (next) {
      // bật loading: hiện ngay và ghi nhận start
      this.clearHideTimer();
      this.visible = true;
      this.loadingStart = Date.now();
    } else {
      // tắt loading: đảm bảo đủ minDuration
      const elapsed = Date.now() - this.loadingStart;
      const remaining = Math.max(0, this.minDurationMs - elapsed);

      if (remaining === 0) {
        this.visible = false;
      } else {
        this.hideTimer = setTimeout(() => {
          this.visible = false;
          this.hideTimer = null;
        }, remaining);
      }
    }
  }

  ngOnDestroy(): void {
    this.clearHideTimer();
  }

  private clearHideTimer() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
