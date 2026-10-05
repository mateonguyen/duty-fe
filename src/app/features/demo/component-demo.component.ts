import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { StaffAvatarComponent } from '../../shared/components/staff-avatar/staff-avatar.component';
import { RoleBadgeComponent } from '../../shared/components/role-badge/role-badge.component';
import { StaffChipComponent } from '../../shared/components/staff-chip/staff-chip.component';
import {
  getMockAvatar,
  MOCK_AVATARS_ENABLED,
} from '../../shared/utils/mock-avatars';

interface StaffMember {
  fullName: string;
  role: string;
  department: string;
}

/**
 * Demo page showcasing staff avatar and badge components.
 * Navigate to /component-demo to view.
 */
@Component({
  selector: 'app-component-demo',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    TableModule,
    StaffAvatarComponent,
    RoleBadgeComponent,
    StaffChipComponent,
  ],
  template: `
    <div class="p-6 space-y-6">
      <h1 class="text-3xl font-bold mb-2">Staff Avatar & Badge Components</h1>
      <p class="text-surface-600">
        Reusable components for displaying staff information with avatars and
        role badges.
      </p>

      <!-- Avatar Showcase -->
      <p-card header="Staff Avatars">
        <p class="mb-4 text-sm text-surface-600">
          Avatars automatically generate initials and colors based on staff
          names.
        </p>
        <div class="flex flex-wrap gap-6">
          <div
            *ngFor="let staff of sampleStaff"
            class="flex flex-col items-center gap-2"
          >
            <app-staff-avatar
              [fullName]="staff.fullName"
              [photoUrl]="getPhoto(staff.fullName)"
            ></app-staff-avatar>
            <span class="text-xs text-surface-600">{{ staff.fullName }}</span>
          </div>
        </div>
      </p-card>

      <!-- Role Badge Showcase -->
      <p-card header="Role Badges">
        <p class="mb-4 text-sm text-surface-600">
          Color-coded badges for different role hierarchies.
        </p>
        <div class="flex flex-wrap gap-3">
          <app-role-badge role="Cục trưởng"></app-role-badge>
          <app-role-badge role="Trưởng phòng"></app-role-badge>
          <app-role-badge role="Phó cục trưởng"></app-role-badge>
          <app-role-badge role="Phó phòng"></app-role-badge>
          <app-role-badge role="Chỉ huy trực"></app-role-badge>
          <app-role-badge role="Điều phối"></app-role-badge>
          <app-role-badge role="Chuyên viên"></app-role-badge>
          <app-role-badge role="Cán bộ"></app-role-badge>
        </div>
      </p-card>

      <!-- Staff Chip Showcase -->
      <p-card header="Staff Chips (Combined)">
        <p class="mb-4 text-sm text-surface-600">
          Complete staff display with avatar, name, and role badge.
        </p>
        <div class="flex flex-col gap-3">
          <app-staff-chip
            *ngFor="let staff of sampleStaff"
            [fullName]="staff.fullName"
            [role]="staff.role"
            [photoUrl]="getPhoto(staff.fullName)"
          ></app-staff-chip>
        </div>
      </p-card>

      <!-- Table Usage Example -->
      <p-card header="Usage in Table">
        <p class="mb-4 text-sm text-surface-600">
          Example of staff chips in a data table (typical use case).
        </p>
        <p-table [value]="sampleStaff" [tableStyle]="{ 'min-width': '50rem' }">
          <ng-template pTemplate="header">
            <tr>
              <th>Cán bộ</th>
              <th>Phòng ban</th>
              <th>Chức vụ</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-staff>
            <tr>
              <td>
                <app-staff-chip
                  [fullName]="staff.fullName"
                  [role]="staff.role"
                  [photoUrl]="getPhoto(staff.fullName)"
                  [showRole]="false"
                ></app-staff-chip>
              </td>
              <td>{{ staff.department }}</td>
              <td>
                <app-role-badge [role]="staff.role"></app-role-badge>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>

      <!-- Compact Mode -->
      <p-card header="Compact Mode">
        <p class="mb-4 text-sm text-surface-600">
          Compact variant for space-constrained layouts.
        </p>
        <div class="flex flex-col gap-2">
          <app-staff-chip
            *ngFor="let staff of sampleStaff.slice(0, 5)"
            [fullName]="staff.fullName"
            [role]="staff.role"
            [photoUrl]="getPhoto(staff.fullName)"
            [compact]="true"
          ></app-staff-chip>
        </div>
      </p-card>

      <!-- Implementation Notes -->
      <p-card header="Implementation Notes">
        <ul class="list-disc list-inside space-y-2 text-sm">
          <li>
            <strong>Automatic Color Generation:</strong> Each name gets a
            consistent HSL color based on hash function
          </li>
          <li>
            <strong>Vietnamese Name Support:</strong> Initials use last two
            words (given + middle name)
          </li>
          <li>
            <strong>Role Hierarchy:</strong> Red (leadership) → Orange (deputy)
            → Blue (operational) → Gray (staff)
          </li>
          <li>
            <strong>Mock Photos:</strong> Currently
            {{ mockEnabled ? 'enabled' : 'disabled' }} (toggle in
            <code>mock-avatars.ts</code>)
          </li>
          <li>
            <strong>Standalone Components:</strong> Import directly into any
            component
          </li>
          <li>
            <strong>Responsive:</strong> Works in tables, cards, lists, and
            mobile layouts
          </li>
        </ul>
      </p-card>
    </div>
  `,
  styles: [
    `
      code {
        background: #f3f4f6;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 0.875em;
      }
    `,
  ],
})
export class ComponentDemoComponent {
  mockEnabled = MOCK_AVATARS_ENABLED;

  sampleStaff: StaffMember[] = [
    {
      fullName: 'Nguyễn Văn An',
      role: 'Cục trưởng',
      department: 'Ban Giám đốc',
    },
    {
      fullName: 'Trần Thị Bình',
      role: 'Trưởng phòng',
      department: 'Phòng Hành chính',
    },
    {
      fullName: 'Lê Văn Cường',
      role: 'Phó cục trưởng',
      department: 'Ban Giám đốc',
    },
    {
      fullName: 'Phạm Thị Dung',
      role: 'Phó phòng',
      department: 'Phòng Kế hoạch',
    },
    {
      fullName: 'Hoàng Văn Đức',
      role: 'Chỉ huy trực',
      department: 'Phòng Điều hành',
    },
    {
      fullName: 'Vũ Thị Hoa',
      role: 'Điều phối',
      department: 'Phòng Điều hành',
    },
    {
      fullName: 'Đỗ Văn Khoa',
      role: 'Chuyên viên',
      department: 'Phòng Kỹ thuật',
    },
    { fullName: 'Bùi Thị Lan', role: 'Cán bộ', department: 'Phòng Hành chính' },
    {
      fullName: 'Dương Văn Tính',
      role: 'Cán bộ',
      department: 'Phòng Kế hoạch',
    },
    {
      fullName: 'Bùi Công Đại',
      role: 'Chuyên viên',
      department: 'Phòng Kỹ thuật',
    },
  ];

  getPhoto(fullName: string): string | undefined {
    return MOCK_AVATARS_ENABLED ? getMockAvatar(fullName) : undefined;
  }
}
