import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DirectoryOrganization } from './directory.models';

@Component({
  selector: 'app-organization-tree', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './organization-tree.component.html', styleUrls: ['./organization-tree.component.scss'],
})
export class OrganizationTreeComponent implements OnChanges {
  @Input() organizations: DirectoryOrganization[] = [];
  @Input() selectedCode = '';
  @Input() showAll = false;
  @Input() writable = false;
  @Input() busy = false;
  @Output() selectUnit = new EventEmitter<string>();
  @Output() addChild = new EventEmitter<DirectoryOrganization>();
  query = '';
  collapsed = new Set<string>();
  private normalize(value: string) { return value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd'); }
  private same(a: string | null, b: string) { return !!a && a.toUpperCase() === b.toUpperCase(); }
  private parent(org: DirectoryOrganization) { return this.organizations.find(x => this.same(org.parentId, x.id) || this.same(org.parentId, x.code)); }
  ngOnChanges() {
    let unit = this.organizations.find(x => x.code === this.selectedCode); const seen = new Set<string>();
    while (unit && !seen.has(unit.code)) { seen.add(unit.code); this.collapsed.delete(unit.code); unit = this.parent(unit); }
  }
  get root() { return this.organizations.find(x => !x.parentId); }
  get nodes() {
    const term = this.normalize(this.query.trim());
    const matches = new Set(this.organizations.filter(x => !term || this.normalize(x.code + ' ' + x.name).includes(term)).map(x => x.code));
    const visible = new Set(matches);
    if (term) for (const org of this.organizations.filter(x => matches.has(x.code))) {
      let ancestor = this.parent(org); const seen = new Set<string>([org.code]);
      while (ancestor && !seen.has(ancestor.code)) { seen.add(ancestor.code); visible.add(ancestor.code); ancestor = this.parent(ancestor); }
    }
    const result: { org: DirectoryOrganization; depth: number; children: number; context: boolean }[] = [];
    const visited = new Set<string>();
    const visit = (org: DirectoryOrganization, depth: number, hidden = false) => {
      if (visited.has(org.code)) return; visited.add(org.code);
      const children = this.organizations.filter(x => this.same(x.parentId, org.id) || this.same(x.parentId, org.code));
      if (!hidden && visible.has(org.code)) result.push({ org, depth, children: children.length, context: !!term && !matches.has(org.code) });
      children.forEach(child => visit(child, depth + 1, hidden || (!term && this.collapsed.has(org.code))));
    };
    this.organizations.filter(x => !x.parentId).forEach(x => visit(x, 0));
    this.organizations.forEach(x => { if (!visited.has(x.code)) visit(x, 0); });
    return result;
  }
  toggle(code: string) { this.collapsed.has(code) ? this.collapsed.delete(code) : this.collapsed.add(code); }
  trackCode(_: number, node: { org: DirectoryOrganization }) { return node.org.code; }
}
