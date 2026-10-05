import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiSelectComponent, UiSelectOption } from '../../../shared/components/ui-select/ui-select.component';
import { DirectoryDraft, DirectoryOrganization } from './directory.models';

@Component({
  selector: 'app-organization-detail', standalone: true, imports: [CommonModule, FormsModule, UiSelectComponent],
  templateUrl: './organization-detail.component.html', styleUrls: ['./organization-detail.component.scss'],
})
export class OrganizationDetailComponent {
  @Input() unit?: DirectoryOrganization;
  @Input() organizations: DirectoryOrganization[] = [];
  @Input() draft!: DirectoryDraft;
  @Input() editing = '';
  @Input() editorOpen = false;
  @Input() editorError = '';
  @Input() writable = false;
  @Input() saving = false;
  @Input() loading = false;
  @Input() error = '';
  @Input() dirty = false;
  @Input() parentOptions: UiSelectOption[] = [];
  @Output() editUnit = new EventEmitter<DirectoryOrganization>();
  @Output() createUnit = new EventEmitter<void>();
  @Output() addChild = new EventEmitter<DirectoryOrganization>();
  @Output() saveUnit = new EventEmitter<void>();
  @Output() cancelEdit = new EventEmitter<void>();
  @Output() selectUnit = new EventEmitter<string>();
  private same(a: string | null, b: string) { return !!a && a.toUpperCase() === b.toUpperCase(); }
  get root() { return this.organizations.find(x => !x.parentId); }
  get parent() { return this.organizations.find(x => this.same(this.unit?.parentId || null, x.id) || this.same(this.unit?.parentId || null, x.code)); }
  get children() { return this.unit ? this.organizations.filter(x => this.same(x.parentId, this.unit!.id) || this.same(x.parentId, this.unit!.code)) : []; }
  get path() {
    const path: DirectoryOrganization[] = []; const seen = new Set<string>(); let current = this.unit;
    while (current && !seen.has(current.code)) {
      path.unshift(current); seen.add(current.code);
      current = this.organizations.find(x => this.same(current!.parentId, x.id) || this.same(current!.parentId, x.code));
    }
    return path;
  }
}
