import { CanDeactivateFn } from '@angular/router';
import type { LocalDirectoryComponent } from './local-directory.component';

export const directoryUnsavedGuard: CanDeactivateFn<LocalDirectoryComponent> = component => component.confirmDiscard();
