import {
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  computed,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { OrgUnitNodeWithStaff } from '../services/travel-staff-tree.service';
import { SimpleUser } from '../../schedule/schedule';

/**
 * TravelStaffDropdownComponent
 * Displays staff tree structure in a dropdown panel.
 * Reuses same logic as schedule-page staff-tree component.
 */
@Component({
  standalone: true,
  selector: 'app-travel-staff-dropdown',
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule],
  template: `
    <div class="staff-dropdown-panel">
      <!-- Staff Tree -->
      <div class="tree-container">
        <ng-container *ngIf="filteredTree().length > 0; else emptyState">
          <ng-template #recursiveTree let-nodes>
            <div *ngFor="let node of nodes" class="tree-node">
              <!-- Org Unit Header -->
              <div class="org-header" (click)="toggleGroup(node.code)">
                <i
                  class="pi text-xs"
                  [ngClass]="
                    expandedGroups()[node.code] !== false
                      ? 'pi-chevron-down'
                      : 'pi-chevron-right'
                  "
                ></i>
                <span class="org-name">{{ node.name }}</span>
                <span class="org-count">({{ node.staff?.length || 0 }})</span>
              </div>

              <!-- Staff List -->
              <div
                *ngIf="expandedGroups()[node.code] !== false"
                class="staff-list"
              >
                <div
                  *ngFor="let person of node.staff"
                  class="staff-item"
                  [ngClass]="{ 'is-leader': person.isLeader }"
                  (click)="selectPerson(person)"
                >
                  <i
                    class="pi pi-user"
                    [ngClass]="
                      person.isLeader ? 'text-emerald-600' : 'text-gray-400'
                    "
                  ></i>
                  <div class="staff-info">
                    <div
                      class="staff-name"
                      [ngClass]="
                        person.isLeader ? 'text-emerald-900' : 'text-gray-800'
                      "
                    >
                      {{ person.displayName }}
                      <i
                        *ngIf="person.isLeader"
                        class="pi pi-star-fill text-yellow-500 text-xs ml-1"
                      ></i>
                    </div>
                    <div
                      class="staff-position"
                      [ngClass]="
                        person.isLeader ? 'text-emerald-700' : 'text-gray-500'
                      "
                    >
                      {{ person.positionName }}
                    </div>
                  </div>
                </div>

                <!-- Recursive Children -->
                <div
                  *ngIf="node.children && node.children.length > 0"
                  class="ml-4"
                >
                  <ng-container
                    *ngTemplateOutlet="
                      recursiveTree;
                      context: { $implicit: node.children }
                    "
                  ></ng-container>
                </div>
              </div>
            </div>
          </ng-template>

          <ng-container
            *ngTemplateOutlet="
              recursiveTree;
              context: { $implicit: filteredTree() }
            "
          ></ng-container>
        </ng-container>

        <ng-template #emptyState>
          <div class="empty-state">
            <i class="pi pi-users text-4xl text-gray-300"></i>
            <div class="text-gray-500">Không tìm thấy cán bộ</div>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [
    `
      .staff-dropdown-panel {
        display: flex;
        flex-direction: column;
        max-height: 400px;
        width: 100%;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      }

      .search-header {
        display: none;
      }

      .tree-container {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }

      .tree-node {
        margin-bottom: 4px;
      }

      .org-header {
        position: sticky;
        top: 0;
        background: #f1f5f9;
        padding: 8px 12px;
        font-weight: 600;
        font-size: 0.875rem;
        color: #475569;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        border-radius: 4px;
        z-index: 1;
      }

      .org-header:hover {
        background: #e2e8f0;
      }

      .org-name {
        flex: 1;
      }

      .org-count {
        color: #64748b;
        font-size: 0.75rem;
      }

      .staff-list {
        padding: 4px 0;
      }

      .staff-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        margin: 2px 0;
        border-radius: 4px;
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.2s;
      }

      .staff-item:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }

      .staff-item.is-leader {
        background: #ecfdf5;
        border-color: #a7f3d0;
      }

      .staff-item.is-leader:hover {
        background: #d1fae5;
        border-color: #6ee7b7;
      }

      .staff-info {
        flex: 1;
        overflow: hidden;
      }

      .staff-name {
        font-weight: 600;
        font-size: 0.875rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .staff-position {
        font-size: 0.75rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
      }
    `,
  ],
})
export class TravelStaffDropdownComponent {
  private _tree = signal<OrgUnitNodeWithStaff[]>([]);

  @Input()
  set tree(val: OrgUnitNodeWithStaff[]) {
    this._tree.set(val || []);
  }

  @Output() selectStaff = new EventEmitter<SimpleUser>();
  @Output() closed = new EventEmitter<void>();

  expandedGroups = signal<{ [key: string]: boolean }>({});

  filteredTree = computed(() => {
    // Parent should pass already-filtered nodes when a query is applied.
    return this._tree();
  });

  toggleGroup(code: string) {
    this.expandedGroups.update((groups) => ({
      ...groups,
      [code]: !groups[code],
    }));
  }

  constructor() {}

  selectPerson(person: SimpleUser) {
    this.selectStaff.emit(person);
    this.closed.emit();
  }

  // No internal search; parent controls filtering

  private removeDiacritics(str: string): string {
    return str
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  // Parent component handles outside-click closing to avoid focus/flicker races

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(ev: any) {
    ev.stopPropagation();
    this.closed.emit();
  }
}
