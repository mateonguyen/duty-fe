import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-loading-spinner',
  imports: [CommonModule],
  template: `
    <div
      *ngIf="isLoading"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      [class.hidden]="!isLoading"
    >
      <div
        class="flex flex-col items-center gap-4 p-8 bg-white rounded-lg shadow-2xl"
      >
        <!-- Custom spinner container -->
        <div class="spinner-container">
          <ng-container *ngIf="videoUrl; else imageSpinner">
            <video
              [src]="videoUrl"
              autoplay
              loop
              muted
              playsinline
              class="w-24 h-24 object-contain"
            ></video>
          </ng-container>
          <ng-template #imageSpinner>
            <img
              *ngIf="imageUrl"
              [src]="imageUrl"
              alt="Loading..."
              class="w-24 h-24 object-contain animate-spin-slow"
            />
            <!-- Default SVG spinner if no custom asset -->
            <svg
              *ngIf="!imageUrl"
              class="w-16 h-16 text-blue-600 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </ng-template>
        </div>

        <!-- Loading text -->
        <div class="text-center">
          <p class="text-lg font-semibold text-gray-800">{{ loadingText }}</p>
          <p *ngIf="subText" class="text-sm text-gray-500 mt-1">
            {{ subText }}
          </p>
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
export class LoadingSpinnerComponent {
  @Input() isLoading = false;
  @Input() loadingText = 'Đang tải...';
  @Input() subText?: string;
  @Input() imageUrl?: string; // Path to custom image (SVG/PNG/GIF)
  @Input() videoUrl?: string; // Path to custom video
}
