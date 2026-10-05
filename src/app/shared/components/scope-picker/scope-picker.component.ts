import {
  Component,
  Input,
  OnInit,
  inject,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';
import { Output, EventEmitter } from '@angular/core';
import { ScopeRef } from '../../../core/services/scope.service';

@Component({
  selector: 'app-scope-picker',
  standalone: true,
  imports: [CommonModule, DropdownModule, FormsModule],
  template: `
    <div class="scope-picker">
      <ng-container *ngIf="scopes.length > 0; else noScopeMsg">
        <p-dropdown
          [options]="scopes"
          [(ngModel)]="selected"
          (ngModelChange)="onScopeChange($event)"
          optionLabel="displayName"
          [placeholder]="placeholder"
          [style]="{ width: '100%' }"
          [disabled]="false"
        >
          <ng-template let-scope pTemplate="item">
            <div class="flex items-center gap-2">
              <i class="pi pi-building text-sm"></i>
              <span>{{ scope.displayName }}</span>
              <span
                *ngIf="showIncludeChildrenHint && scope.includeChildren"
                class="text-xs text-slate-500 italic"
                >(bao gồm đơn vị con)</span
              >
            </div>
          </ng-template>
        </p-dropdown>
      </ng-container>
      <ng-template #noScopeMsg>
        <div class="text-sm text-slate-500">Không có phạm vi truy cập</div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      ::ng-deep .p-dropdown {
        min-width: 280px;
        border-radius: 0.5rem;
        border-color: var(--surface-border);
        transition: all 0.2s ease;
      }
      ::ng-deep .p-dropdown:hover {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.1);
      }
    `,
  ],
})
export class ScopePickerComponent implements OnInit {
  // Stateless/controlled inputs
  @Input() scopes: ScopeRef[] = [];
  @Input() selected: ScopeRef | null = null;
  @Input() placeholder: string = 'Chọn phạm vi...';
  @Input() showIncludeChildrenHint: boolean = false; // NEW: control display of "(bao gồm đơn vị con)"

  // Emit when user changes selection
  @Input() onScopeSelected?: (scope: ScopeRef | null) => void; // backward compat handler
  @Output() selectedChange = new EventEmitter<ScopeRef | null>();

  // Always show when we have at least one scope (even a single option)
  get showPicker(): boolean {
    return (this.scopes?.length ?? 0) >= 1;
  }

  ngOnInit() {
    // No service injection; fully controlled by inputs
  }

  onScopeChange(scope: ScopeRef | null) {
    if (this.onScopeSelected) this.onScopeSelected(scope);
    this.selectedChange.emit(scope);
  }
}
