import {
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TooltipModule } from 'primeng/tooltip';
import { AccordionModule } from 'primeng/accordion';
import { FormsModule } from '@angular/forms';
import { SimpleUser } from '../../schedule';
import { OrgUnitNodeWithStaff } from '../schedule-page.component';
import { SystemConfigService } from '../../../admin/system-config/system-config.service';

@Component({
  standalone: true,
  selector: 'app-staff-tree',
  imports: [
    CommonModule,
    InputTextModule,
    FormsModule,
    DragDropModule,
    TooltipModule,
    AccordionModule,
  ],
  styleUrls: ['./staff-tree.component.scss'],
  templateUrl: './staff-tree.component.html',
})
export class StaffTreeComponent {
  @Input() orgTree: OrgUnitNodeWithStaff[] | null = null;
  @Input() selectedUser: SimpleUser | null = null;
  @Output() selectUser = new EventEmitter<SimpleUser | null>();

  private configService = inject(SystemConfigService);

  query = signal('');
  // key by org unit CODE (string) because numeric id may be 0 for many records from backend
  expandedGroups = signal<{ [key: string]: boolean }>({});
  isFocus = false;

  pick(u: SimpleUser) {
    this.selectUser.emit(u);
  }

  toggleGroupExpanded(groupKey: string) {
    this.expandedGroups.update((e) => ({ ...e, [groupKey]: !e[groupKey] }));
  }

  // Remove Vietnamese diacritics for search
  removeDiacritics(str: string): string {
    return str
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  // Filter tree by query (search by displayName, positionName, ...), không dấu
  // Also filter by C_LEVEL: only show staff with positionLevel <= MaxAssignableCLevel
  get filteredTree(): OrgUnitNodeWithStaff[] | null {
    const qRaw = this.query().trim();
    const q = this.removeDiacritics(qRaw).toLowerCase();
    const maxCLevel = this.configService.maxAssignableCLevel();

    if (!this.orgTree) return null;

    const removeDiacritics = this.removeDiacritics;

    function filterNode(
      node: OrgUnitNodeWithStaff
    ): OrgUnitNodeWithStaff | null {
      // Filter staff in this node
      const filteredStaff = (node.staff || []).filter((u) => {
        // C_LEVEL filter: exclude users with positionLevel > maxCLevel
        if (u.positionLevel && u.positionLevel > maxCLevel) {
          return false;
        }
        // Query filter (search)
        if (!q) return true;
        const name = removeDiacritics(u.displayName || '').toLowerCase();
        const pos = removeDiacritics(u.positionName || '').toLowerCase();
        return name.includes(q) || pos.includes(q);
      });
      // Filter children recursively
      const filteredChildren = (node.children || [])
        .map(filterNode)
        .filter((c): c is OrgUnitNodeWithStaff => !!c);
      // If this node or any child has staff, keep it
      if (filteredStaff.length > 0 || filteredChildren.length > 0) {
        return {
          ...node,
          staff: filteredStaff,
          children: filteredChildren,
        };
      }
      return null;
    }

    const result = this.orgTree
      .map(filterNode)
      .filter((n): n is OrgUnitNodeWithStaff => !!n);
    return result.length > 0 ? result : [];
  }
}
