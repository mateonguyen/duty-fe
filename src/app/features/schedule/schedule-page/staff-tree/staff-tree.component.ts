import {
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  inject,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnChanges,
  OnDestroy,
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
export class StaffTreeComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('staffScroll') private staffScroll?: ElementRef<HTMLDivElement>;
  @ViewChild('staffContent') private staffContent?: ElementRef<HTMLDivElement>;
  @Input() orgTree: OrgUnitNodeWithStaff[] | null = null;
  @Input() selectedUser: SimpleUser | null = null;
  @Output() selectUser = new EventEmitter<SimpleUser | null>();

  private configService = inject(SystemConfigService);

  query = signal('');
  // key by org unit CODE (string) because numeric id may be 0 for many records from backend
  expandedGroups = signal<{ [key: string]: boolean }>({});
  isFocus = false;
  scrollbarVisible = signal(false);
  thumbHeight = signal(0);
  thumbTop = signal(0);
  private resizeObserver?: ResizeObserver;
  private updateFrame = 0;
  private dragStartY = 0;
  private dragStartScrollTop = 0;

  ngAfterViewInit(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleScrollbarUpdate());
      this.resizeObserver.observe(this.staffScroll!.nativeElement);
      this.resizeObserver.observe(this.staffContent!.nativeElement);
    }
    this.scheduleScrollbarUpdate();
  }

  ngOnChanges(): void {
    this.scheduleScrollbarUpdate();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.updateFrame);
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.scheduleScrollbarUpdate();
  }

  private scheduleScrollbarUpdate(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    cancelAnimationFrame(this.updateFrame);
    this.updateFrame = requestAnimationFrame(() => this.updateScrollbar());
  }

  updateScrollbar(): void {
    const scroll = this.staffScroll?.nativeElement;
    if (!scroll) return;
    const overflow = scroll.scrollHeight - scroll.clientHeight;
    this.scrollbarVisible.set(overflow > 1);
    if (overflow <= 1) return;
    const trackHeight = Math.max(0, scroll.clientHeight - 8);
    const thumbHeight = Math.min(trackHeight, Math.max(24, trackHeight * scroll.clientHeight / scroll.scrollHeight));
    this.thumbHeight.set(thumbHeight);
    this.thumbTop.set(scroll.scrollTop / overflow * (trackHeight - thumbHeight));
  }

  startThumbDrag(event: PointerEvent): void {
    event.preventDefault();
    this.dragStartY = event.clientY;
    this.dragStartScrollTop = this.staffScroll?.nativeElement.scrollTop ?? 0;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  moveThumbDrag(event: PointerEvent): void {
    if (!(event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) return;
    const scroll = this.staffScroll?.nativeElement;
    if (!scroll) return;
    const trackTravel = scroll.clientHeight - 8 - this.thumbHeight();
    if (trackTravel > 0) {
      scroll.scrollTop = this.dragStartScrollTop + (event.clientY - this.dragStartY) * (scroll.scrollHeight - scroll.clientHeight) / trackTravel;
    }
  }

  endThumbDrag(event: PointerEvent): void {
    const thumb = event.currentTarget as HTMLElement;
    if (thumb.hasPointerCapture(event.pointerId)) thumb.releasePointerCapture(event.pointerId);
  }

  pick(u: SimpleUser) {
    this.selectUser.emit(u);
  }

  toggleGroupExpanded(groupKey: string) {
    this.expandedGroups.update((e) => ({ ...e, [groupKey]: !e[groupKey] }));
    this.scheduleScrollbarUpdate();
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
