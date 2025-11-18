# Custom Loading Spinner Guide

## Overview

The `LoadingSpinnerComponent` is a reusable loading overlay that can display custom images, videos, or a default animated spinner.

## Basic Usage

```typescript
import { LoadingSpinnerComponent } from './shared/components/loading-spinner/loading-spinner.component';

@Component({
  imports: [LoadingSpinnerComponent, ...],
  template: `
    <app-loading-spinner
      [isLoading]="loading()"
      loadingText="Loading data..."
      subText="Please wait"
    ></app-loading-spinner>
  `
})
```

## Customization Options

### 1. Using Custom Image (SVG/PNG/GIF)

**Place your custom image in `src/assets/` folder:**

- `src/assets/spinner-logo.svg`
- `src/assets/spinner-logo.png`
- `src/assets/spinner-logo.gif`

**Use in template:**

```html
<app-loading-spinner [isLoading]="loading()" loadingText="Loading..." imageUrl="/assets/spinner-logo.svg"></app-loading-spinner>
```

**For animated SVG:**

- Create an SVG with `<animateTransform>` elements for rotation
- See `src/assets/spinner-default.svg` for reference

**For GIF:**

- Use a looping GIF animation
- Recommended size: 120x120px or 200x200px

### 2. Using Custom Video

**Place your video in `src/assets/` folder:**

- `src/assets/spinner-animation.mp4`
- `src/assets/spinner-animation.webm`

**Use in template:**

```html
<app-loading-spinner [isLoading]="loading()" loadingText="Loading..." videoUrl="/assets/spinner-animation.mp4"></app-loading-spinner>
```

**Video requirements:**

- Short loop (1-3 seconds)
- Small file size (< 500KB recommended)
- Transparent background (WebM with alpha channel)
- Formats: MP4, WebM (WebM preferred for transparency)

### 3. Global Configuration

**Option A: Create a shared service for spinner config:**

```typescript
// src/app/shared/services/spinner-config.service.ts
import { Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class SpinnerConfigService {
  readonly imageUrl = "/assets/custom-logo.svg";
  readonly videoUrl?: string; // Optional video URL
  readonly defaultText = "Đang tải...";
}
```

**Use in components:**

```typescript
export class MyComponent {
  spinnerConfig = inject(SpinnerConfigService);
}
```

```html
<app-loading-spinner [isLoading]="loading()" [loadingText]="spinnerConfig.defaultText" [imageUrl]="spinnerConfig.imageUrl"></app-loading-spinner>
```

**Option B: Extend the spinner component:**

Create a custom wrapper:

```typescript
// src/app/shared/components/app-spinner/app-spinner.component.ts
import { Component, Input } from "@angular/core";
import { LoadingSpinnerComponent } from "../loading-spinner/loading-spinner.component";

@Component({
  selector: "app-spinner",
  standalone: true,
  imports: [LoadingSpinnerComponent],
  template: ` <app-loading-spinner [isLoading]="isLoading" [loadingText]="loadingText || 'Đang tải...'" imageUrl="/assets/company-logo.svg"></app-loading-spinner> `,
})
export class AppSpinnerComponent {
  @Input() isLoading = false;
  @Input() loadingText?: string;
}
```

## Animation Styles

The spinner supports multiple animation styles via CSS classes:

### Spin Animation (default for images)

```css
.animate-spin-slow {
  animation: spin 2s linear infinite;
}
```

### Pulse Scale Animation

Add class to image element:

```html
<img class="animate-pulse-scale" ... />
```

### Custom Animation

Override in your component styles:

```scss
::ng-deep .spinner-container img {
  animation: custom-bounce 1.5s ease-in-out infinite;
}

@keyframes custom-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-20px);
  }
}
```

## Theme Support

The spinner automatically inherits theme colors. To customize:

```scss
// In your global styles or component styles
::ng-deep app-loading-spinner {
  .bg-white {
    background-color: var(--surface-ground); // Use theme variable
  }

  .text-blue-600 {
    color: var(--primary-color);
  }
}
```

## Performance Tips

1. **Optimize image size:**

   - SVG: < 10KB (recommended)
   - PNG: < 50KB
   - GIF: < 200KB

2. **Optimize video:**

   - Duration: 1-2 seconds
   - Resolution: 200x200px max
   - Format: WebM for best compression
   - Use `autoplay loop muted playsinline` attributes

3. **Lazy loading:**
   The spinner component is already standalone and tree-shakeable.

## Examples

### Example 1: Company Logo Spinner

```html
<app-loading-spinner [isLoading]="pageLoading()" loadingText="Đang tải dữ liệu..." subText="Hệ thống phân công trực" imageUrl="/assets/company-logo.svg"></app-loading-spinner>
```

### Example 2: Animated Brand Video

```html
<app-loading-spinner [isLoading]="processing()" loadingText="Đang xử lý..." videoUrl="/assets/brand-animation.webm"></app-loading-spinner>
```

### Example 3: Custom GIF

```html
<app-loading-spinner [isLoading]="saving()" loadingText="Đang lưu..." imageUrl="/assets/spinner-dots.gif"></app-loading-spinner>
```

## Integration Checklist

- [ ] Import `LoadingSpinnerComponent` in your component
- [ ] Add `<app-loading-spinner>` to template
- [ ] Bind `[isLoading]` to a signal or observable
- [ ] (Optional) Add custom `imageUrl` or `videoUrl`
- [ ] (Optional) Customize `loadingText` and `subText`
- [ ] Test loading state visibility
- [ ] Verify backdrop blocks interaction
- [ ] Test on mobile devices
