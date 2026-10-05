import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePickerModule } from 'primeng/datepicker';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { OrganizationService } from '../admin/system-config/organization.service';
import { OrgUnitNodeWithStaffDto, SimpleUserWithOrgDto } from '../../shared/models/org-unit';
import { PersonnelDto } from '../travel/services/personnel-api.service';
import { FileConfig, FileViewComponent } from '../../shared/components/file-view/file-view.component';
import { IntroductionApiService, IntroductionGroup, IntroductionGroupRequest, IntroductionLetter, IntroductionRequest } from './introduction-api.service';

type StaffTreeData = { kind: 'unit'; code: string } | { kind: 'person'; person: PersonnelDto };
type SignerChoice = { username: string; name: string; detail: string };
type SelectedGroup = { key: string; label: string; people: PersonnelDto[] };

@Component({
  selector: 'app-introduction-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePickerModule, TreeModule, FileViewComponent],
  templateUrl: './introduction-form.component.html',
  styleUrls: ['./introduction-form.component.scss'],
})
export class IntroductionFormComponent implements OnInit, OnDestroy {
  editId: number | null = null; groupId: number | null = null;
  busy = signal(false); error = signal(''); people = signal<PersonnelDto[]>([]);
  canTakeNumberOnForm = signal(true);
  signerQuery = ''; signerName = ''; signerDetail = '';
  signerDropdownOpen = false;
  signerDropdownUp = false;
  signerOptions = signal<PersonnelDto[]>([]);
  bureauSigners = signal<PersonnelDto[]>([]);
  signerOverrides: Record<string, SignerChoice> = {};
  cardSignerFor = ''; cardSignerQuery = ''; cardSignerOptions = signal<PersonnelDto[]>([]);
  sections: Record<number, boolean> = { 1: true, 2: true, 3: true, 4: false };
  treeDropdownOpen = false; treeQuery = '';
  staffTree = signal<TreeNode<StaffTreeData>[]>([]); staffTreeLoading = signal(false); staffTreeError = signal('');
  searchResults = signal<PersonnelDto[]>([]);
  readonly searchLeaders = computed(() => this.searchResults().filter(person => person.isLeader));
  readonly searchStaff = computed(() => this.searchResults().filter(person => !person.isLeader));
  selectedTreeNodes: TreeNode<StaffTreeData>[] | TreeNode<StaffTreeData> | null = [];
  private personNodes = new Map<string, TreeNode<StaffTreeData>>();
  private unitNodes = new Map<string, TreeNode<StaffTreeData>>();
  private personOrder = new Map<string, number>();
  private personGroup = new Map<string, { key: string; label: string }>();
  private nextPersonOrder = 0;
  readonly orderedPeople = computed(() => { this.staffTree(); return [...this.people()].sort((a, b) =>
    (this.personOrder.get(a.username.toLowerCase()) ?? Number.MAX_SAFE_INTEGER) - (this.personOrder.get(b.username.toLowerCase()) ?? Number.MAX_SAFE_INTEGER)); });
  readonly selectedGroups = computed<SelectedGroup[]>(() => {
    const groups: SelectedGroup[] = [];
    for (const person of this.orderedPeople()) {
      const unit = this.personGroup.get(person.username.toLowerCase()) || { key: 'historical', label: 'Cán bộ ngoài danh mục hiện tại' };
      let group = groups.find(item => item.key === unit.key);
      if (!group) { group = { ...unit, people: [] }; groups.push(group); }
      group.people.push(person);
    }
    return groups;
  });
  @ViewChild('treePickerShell') treePickerShell?: ElementRef<HTMLElement>;
  @ViewChild('signerPickerShell') signerPickerShell?: ElementRef<HTMLElement>;
  @ViewChild('signerSearchInput') signerSearchInput?: ElementRef<HTMLInputElement>;
  issueDate: Date | null = new Date(); validUntil: Date | null = null;
  form: IntroductionGroupRequest = { personUsernames: [], signerUsername: '', recipientAgency: '', destination: '', purpose: '', issueDate: null, validUntil: null, issuePlace: 'Hà Nội' };
  previewPersonUsername = signal(''); previewConfig = signal<FileConfig | null>(null);
  previewLoading = signal(false); previewError = signal('');
  private previewBlob: Blob | null = null; private previewObjectUrl: string | null = null;
  private previewChanges = new Subject<void>(); private previewChangesSub?: Subscription; private previewRequestSub?: Subscription;
  constructor(private api: IntroductionApiService,
    private organizations: OrganizationService, private route: ActivatedRoute,
    private router: Router) {}

  ngOnInit(): void {
    this.previewChangesSub = this.previewChanges.pipe(debounceTime(500)).subscribe(() => this.refreshPreview());
    this.loadStaffTree();
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id && this.route.snapshot.url[0]?.path === 'groups') {
      this.groupId = id;
      this.canTakeNumberOnForm.set(false);
      this.api.group(id).subscribe({ next: x => { this.canTakeNumberOnForm.set(x.canTakeNumber); this.populateGroup(x); }, error: e => this.error.set(this.message(e)) });
    } else if (id) {
      this.editId = id;
      this.canTakeNumberOnForm.set(false);
      this.api.get(id).subscribe({ next: x => { this.populateLetter(x); this.api.group(x.batchId).subscribe({ next: group => this.canTakeNumberOnForm.set(group.canTakeNumber), error: e => this.error.set(this.message(e)) }); }, error: e => this.error.set(this.message(e)) });
    } else {
      const copy = sessionStorage.getItem('introduction-copy');
      if (copy) { sessionStorage.removeItem('introduction-copy'); try { this.populateLetter(JSON.parse(copy), true); } catch {} }
    }
  }
  ngOnDestroy(): void {
    this.previewChangesSub?.unsubscribe(); this.previewRequestSub?.unsubscribe();
    if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
  }
  private populateGroup(group: IntroductionGroup): void {
    if (!group.letters.length) return;
    this.populateLetter(group.letters[0]);
    this.people.set(group.letters.map(x => this.personFromLetter(x)));
    this.signerOverrides = {};
    for (const letter of group.letters) {
      if (letter.signerUsername.toLowerCase() !== this.form.signerUsername.toLowerCase())
        this.signerOverrides[letter.personUsername.toLowerCase()] = {
          username: letter.signerUsername, name: letter.signerName,
          detail: [letter.signerPositionTitle, letter.signerUnitName].filter(Boolean).join(' · '),
        };
    }
    this.syncTreeSelection();
    this.queuePreview();
  }
  private populateLetter(x: IntroductionLetter, copying = false): void {
    this.form = { personUsernames: [x.personUsername], signerUsername: x.signerUsername, recipientAgency: x.recipientAgency, destination: x.destination, purpose: x.purpose, issueDate: x.issueDate, validUntil: x.validUntil || null, issuePlace: x.issuePlace };
    this.people.set([this.personFromLetter(x)]); this.previewPersonUsername.set(x.personUsername);
    this.signerOverrides = {};
    this.syncTreeSelection();
    this.signerName = x.signerName; this.signerDetail = [x.signerPositionTitle, x.signerUnitName].filter(Boolean).join(' · ');
    this.issueDate = copying ? new Date() : this.parseDate(x.issueDate);
    this.validUntil = x.validUntil ? this.parseDate(x.validUntil) : null;
    this.queuePreview();
  }
  private personFromLetter(x: IntroductionLetter): PersonnelDto { return { username: x.personUsername, fullName: x.fullName, rankName: x.rankName, displayNameWithRank: [x.rankName, x.fullName].filter(Boolean).join(' '), positionTitle: x.positionTitle, unitName: x.unitName }; }
  loadStaffTree(): void {
    this.staffTreeLoading.set(true); this.staffTreeError.set('');
    this.organizations.fetchAllWithStaff(undefined, true).subscribe({
      next: roots => {
        this.personNodes.clear(); this.unitNodes.clear(); this.personOrder.clear(); this.personGroup.clear(); this.nextPersonOrder = 0;
        const children = roots.map(root => this.mapUnitNode(root)).filter((node): node is TreeNode<StaffTreeData> => !!node);
        this.staffTree.set(children);
        this.updateStaffSearch(this.treeQuery);
        const leaders = roots.flatMap(root => root.staff || [])
          .filter(user => this.bureauLeaderPriority(user.positionName) < 2)
          .sort((a, b) => this.bureauLeaderPriority(a.positionName) - this.bureauLeaderPriority(b.positionName))
          .map(user => this.signerFromDirectory(user));
        this.bureauSigners.set(leaders);
        if (!this.editId && !this.groupId && !this.form.signerUsername && leaders.length) this.selectSigner(leaders[0]);
        this.syncTreeSelection(); this.staffTreeLoading.set(false);
      },
      error: e => { this.staffTreeLoading.set(false); this.staffTreeError.set(this.message(e)); },
    });
  }
  private mapUnitNode(unit: OrgUnitNodeWithStaffDto, depth = 0): TreeNode<StaffTreeData> | null {
    const children = (unit.children || []).map(child => this.mapUnitNode(child, depth + 1)).filter((node): node is TreeNode<StaffTreeData> => !!node);
    const staff = (unit.staff || []).filter(user => !!user.username).map(user => this.mapPersonNode(user, unit));
    if (!children.length && !staff.length) return null;
    const node: TreeNode<StaffTreeData> = {
      key: `unit:${unit.code}`, label: this.unitDisplayName(unit), data: { kind: 'unit', code: unit.code },
      children: [...children, ...staff], expanded: depth === 0, selectable: !this.editId,
    };
    for (const child of node.children || []) child.parent = node;
    this.unitNodes.set(node.key!, node);
    return node;
  }
  private unitDisplayName(unit: OrgUnitNodeWithStaffDto): string {
    const name = unit.name?.trim() || unit.code;
    const shortName = unit.shortName?.trim();
    if (!shortName || name.toLocaleLowerCase('vi-VN').startsWith(shortName.toLocaleLowerCase('vi-VN'))) return name;
    return `${shortName} — ${name}`;
  }
  private mapPersonNode(user: SimpleUserWithOrgDto, unit: OrgUnitNodeWithStaffDto): TreeNode<StaffTreeData> {
    const person: PersonnelDto = {
      username: user.username, fullName: user.displayName, rankName: user.rankName || undefined,
      displayNameWithRank: user.displayNameWithRank || user.displayName,
      positionTitle: user.positionName, unitName: user.orgUnitName || undefined, orgCode: user.orgUnitCode || undefined,
    };
    person.unitName ||= unit.name;
    person.isLeader = !!user.isLeader;
    const node: TreeNode<StaffTreeData> = { key: `person:${user.username.toLowerCase()}`, label: person.displayNameWithRank, data: { kind: 'person', person }, leaf: true, styleClass: 'intro-person-option' };
    this.personNodes.set(user.username.toLowerCase(), node);
    this.personOrder.set(user.username.toLowerCase(), this.nextPersonOrder++);
    this.personGroup.set(user.username.toLowerCase(), { key: unit.code, label: this.unitDisplayName(unit) });
    return node;
  }
  private bureauLeaderPriority(title?: string | null): number {
    const value = (title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toUpperCase();
    if (/\bPHO CUC TRUONG\b/.test(value)) return 1;
    if (/\bCUC TRUONG\b/.test(value)) return 0;
    return 2;
  }
  private signerFromDirectory(user: SimpleUserWithOrgDto): PersonnelDto {
    return { username: user.username, fullName: user.displayName, rankName: user.rankName || undefined,
      displayNameWithRank: user.displayNameWithRank || user.displayName, positionTitle: user.positionName,
      unitName: user.orgUnitName || undefined, orgCode: user.orgUnitCode || undefined };
  }
  openTreeDropdown(): void { this.treeDropdownOpen = true; }
  toggleTreeDropdown(): void { this.treeDropdownOpen = !this.treeDropdownOpen; }
  filterStaffTree(query: string): void { this.treeDropdownOpen = true; this.updateStaffSearch(query); }
  private updateStaffSearch(query: string): void {
    const term = this.normalizeSearch(query);
    if (!term) { this.searchResults.set([]); return; }
    this.searchResults.set([...this.personNodes.values()]
      .map(node => (node.data as { kind: 'person'; person: PersonnelDto }).person)
      .filter(person => this.normalizeSearch([person.displayNameWithRank, person.fullName, person.positionTitle, person.unitName].join(' ')).includes(term)));
  }
  isPersonSelected(username: string): boolean {
    return this.people().some(person => person.username.toLowerCase() === username.toLowerCase());
  }
  toggleSearchPerson(username: string): void {
    const node = this.personNodes.get(username.toLowerCase());
    if (node) this.onTreeNodeChange(node, !this.isPersonSelected(username));
  }
  @HostListener('document:click', ['$event'])
  closeTreeOnOutsideClick(event: MouseEvent): void {
    if (this.treeDropdownOpen && this.treePickerShell && !this.treePickerShell.nativeElement.contains(event.target as Node)) this.treeDropdownOpen = false;
    if (this.signerDropdownOpen && this.signerPickerShell && !this.signerPickerShell.nativeElement.contains(event.target as Node)) this.signerDropdownOpen = false;
  }
  onTreeNodeChange(clicked: TreeNode<StaffTreeData>, select: boolean): void {
    const original = clicked.data?.kind === 'person' ? this.personNodes.get(clicked.data.person.username.toLowerCase()) : this.unitNodes.get(clicked.key || '');
    if (!original) return;
    const members: PersonnelDto[] = [];
    const visit = (node: TreeNode<StaffTreeData>): void => {
      if (node.data?.kind === 'person') members.push(node.data.person);
      else for (const child of node.children || []) visit(child);
    };
    visit(original);
    const affected = new Set(members.map(person => person.username.toLowerCase()));
    if (this.editId) this.people.set(select ? members.slice(0, 1) : []);
    else if (select) {
      const existing = new Set(this.people().map(person => person.username.toLowerCase()));
      this.people.update(list => [...list, ...members.filter(person => !existing.has(person.username.toLowerCase()))]);
    } else this.people.update(list => list.filter(person => !affected.has(person.username.toLowerCase())));
    this.pruneSignerOverrides();
    if (!this.people().some(person => person.username.toLowerCase() === this.previewPersonUsername().toLowerCase()))
      this.previewPersonUsername.set(this.people()[0]?.username || '');
    this.syncTreeSelection(); this.refreshVisibleTree(); this.queuePreview();
  }
  private refreshVisibleTree(): void { if (this.treeQuery) this.updateStaffSearch(this.treeQuery); }
  private syncTreeSelection(): void {
    const selected = new Set(this.people().map(person => person.username.toLowerCase()));
    const nodes: TreeNode<StaffTreeData>[] = [];
    const visit = (node: TreeNode<StaffTreeData>): { total: number; chosen: number } => {
      if (node.data?.kind === 'person') {
        const isChosen = selected.has(node.data.person.username.toLowerCase());
        node.partialSelected = false;
        if (isChosen) nodes.push(node);
        return { total: 1, chosen: isChosen ? 1 : 0 };
      }
      const counts = (node.children || []).map(visit);
      const total = counts.reduce((sum, count) => sum + count.total, 0);
      const chosen = counts.reduce((sum, count) => sum + count.chosen, 0);
      node.partialSelected = chosen > 0 && chosen < total;
      if (total && chosen === total) nodes.push(node);
      return { total, chosen };
    };
    for (const root of this.staffTree()) visit(root);
    this.selectedTreeNodes = this.editId ? nodes.find(node => node.data?.kind === 'person') || null : nodes;
  }
  selectAllPeople(): void {
    if (this.editId) return;
    const historical = this.people().filter(person => !this.personNodes.has(person.username.toLowerCase()));
    const all = [...this.personNodes.values()].map(node => (node.data as { kind: 'person'; person: PersonnelDto }).person);
    this.people.set([...historical, ...all]);
    if (!this.previewPersonUsername()) this.previewPersonUsername.set(this.people()[0]?.username || '');
    this.syncTreeSelection(); this.refreshVisibleTree(); this.queuePreview();
  }
  clearPeople(): void { this.people.set([]); this.signerOverrides = {}; this.previewPersonUsername.set(''); this.syncTreeSelection(); this.refreshVisibleTree(); this.queuePreview(); }
  removePerson(username: string): void {
    this.people.update(list => list.filter(x => x.username.toLowerCase() !== username.toLowerCase()));
    delete this.signerOverrides[username.toLowerCase()];
    if (this.previewPersonUsername().toLowerCase() === username.toLowerCase()) this.previewPersonUsername.set(this.people()[0]?.username || '');
    this.syncTreeSelection(); this.refreshVisibleTree(); this.queuePreview();
  }
  findSigner(q: string): void {
    const query = this.normalizeSearch(q);
    this.signerOptions.set(this.bureauSigners().filter(person =>
      this.normalizeSearch([person.fullName, person.positionTitle, person.unitName].join(' ')).includes(query)));
  }
  toggleSignerDropdown(): void {
    this.signerDropdownOpen = !this.signerDropdownOpen;
    if (this.signerDropdownOpen) {
      this.signerQuery = '';
      this.findSigner('');
      const picker = this.signerPickerShell?.nativeElement;
      const panel = picker?.closest('.form-panel');
      if (picker && panel) {
        const spaceBelow = panel.getBoundingClientRect().bottom - picker.getBoundingClientRect().bottom;
        const spaceAbove = picker.getBoundingClientRect().top - panel.getBoundingClientRect().top;
        this.signerDropdownUp = spaceBelow < 270 && spaceAbove > spaceBelow;
      }
      setTimeout(() => this.signerSearchInput?.nativeElement.focus(), 0);
    }
  }
  signerDisplayName(): string {
    return this.bureauSigners().find(person => person.username === this.form.signerUsername)?.displayNameWithRank || this.signerName;
  }
  private normalizeSearch(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
  }
  selectSigner(p: PersonnelDto): void {
    this.form.signerUsername = p.username; this.signerName = p.fullName;
    this.signerDetail = [p.positionTitle, p.unitName].filter(Boolean).join(' · ');
    this.signerQuery = ''; this.signerOptions.set([]); this.signerDropdownOpen = false; this.queuePreview();
  }
  toggleSection(section: number): void { this.sections[section] = !this.sections[section]; }
  signerFor(username: string): SignerChoice | null {
    return this.signerOverrides[username.toLowerCase()] || (this.form.signerUsername ? {
      username: this.form.signerUsername, name: this.signerName, detail: this.signerDetail,
    } : null);
  }
  applySignerToAll(): void { if (!this.form.signerUsername) return; this.signerOverrides = {}; this.queuePreview(); }
  hasSignerOverrides(): boolean { return Object.keys(this.signerOverrides).length > 0; }
  toggleCardSigner(username: string): void {
    this.cardSignerFor = this.cardSignerFor === username ? '' : username;
    this.previewPersonUsername.set(username);
    this.cardSignerQuery = ''; this.cardSignerOptions.set([]);
    if (this.cardSignerFor) this.findCardSigner('');
    this.queuePreview();
  }
  findCardSigner(query: string): void {
    const term = this.normalizeSearch(query);
    this.cardSignerOptions.set(this.bureauSigners().filter(person =>
      this.normalizeSearch([person.fullName, person.positionTitle, person.unitName].join(' ')).includes(term)));
  }
  chooseCardSigner(username: string, signer: PersonnelDto): void {
    this.signerOverrides[username.toLowerCase()] = {
      username: signer.username, name: signer.fullName,
      detail: [signer.positionTitle, signer.unitName].filter(Boolean).join(' · '),
    };
    this.cardSignerFor = ''; this.queuePreview();
  }
  useBulkSigner(username: string): void { delete this.signerOverrides[username.toLowerCase()]; this.cardSignerFor = ''; this.queuePreview(); }
  private pruneSignerOverrides(): void {
    const selected = new Set(this.people().map(person => person.username.toLowerCase()));
    for (const username of Object.keys(this.signerOverrides)) if (!selected.has(username)) delete this.signerOverrides[username];
  }
  setPreviewPerson(username: string): void { this.previewPersonUsername.set(username); this.queuePreview(); }
  previewPersonName(): string { const p = this.people().find(x => x.username === this.previewPersonUsername()); return p?.displayNameWithRank || p?.fullName || ''; }
  queuePreview(): void { this.previewChanges.next(); }
  private refreshPreview(): void {
    this.previewRequestSub?.unsubscribe();
    if (!this.canPreview()) { this.clearPreview(); this.previewLoading.set(false); this.previewError.set(''); return; }
    const username = this.previewPersonUsername() || this.people()[0].username;
    const request: IntroductionRequest = { ...this.payload(), personUsername: username, signerUsername: this.signerFor(username)?.username || '' };
    this.previewLoading.set(true); this.previewError.set('');
    this.previewRequestSub = this.api.preview(request).subscribe({
      next: blob => {
        const nextUrl = URL.createObjectURL(blob);
        const oldUrl = this.previewObjectUrl;
        this.previewBlob = blob; this.previewObjectUrl = nextUrl;
        this.previewConfig.set({ filePath: nextUrl, fileName: 'GiayGioiThieu_XemTruoc.pdf', isBlobUrl: true });
        this.previewLoading.set(false);
        if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 1000);
      },
      error: e => { this.clearPreview(); this.previewLoading.set(false); this.previewError.set(this.message(e)); },
    });
  }
  private clearPreview(): void {
    if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
    this.previewObjectUrl = null; this.previewBlob = null; this.previewConfig.set(null);
  }
  openPreview(): void {
    if (!this.previewBlob) return;
    const url = URL.createObjectURL(this.previewBlob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 300000);
  }
  hasPreview(): boolean { return !!this.previewBlob && !this.previewLoading(); }
  private canPreview(): boolean { return !!(this.people().length && this.signerFor(this.previewPersonUsername() || this.people()[0].username) && this.issueDate && (!this.validUntil || this.validUntil >= this.issueDate)); }
  valid(): boolean { return !!(this.people().length && this.people().length <= 1000 && this.people().every(person => this.signerFor(person.username)) && this.form.destination.trim() && this.form.purpose.trim() && this.issueDate && (!this.validUntil || this.validUntil >= this.issueDate)); }
  private payload(): IntroductionGroupRequest { return { ...this.form, personUsernames: this.people().map(x => x.username), signerOverrides: Object.fromEntries(Object.entries(this.signerOverrides).map(([key, value]) => [key, value.username])), issueDate: this.issueDate ? this.iso(this.issueDate) : null, validUntil: this.validUntil ? this.iso(this.validUntil) : null }; }
  save(mode: 'draft' | 'issue-print'): void {
    if (!this.valid() || this.busy()) return; this.busy.set(true); this.error.set('');
    if (this.editId) { const data = this.payload(); const request: IntroductionRequest = { ...data, personUsername: data.personUsernames[0], signerUsername: this.signerFor(data.personUsernames[0])?.username || '' }; this.api.update(this.editId, request).subscribe({ next: x => this.finishSave(x.batchId, mode), error: e => this.fail(e) }); }
    else { const op = this.groupId ? this.api.updateGroup(this.groupId, this.payload()) : this.api.createGroup(this.payload()); op.subscribe({ next: group => this.finishSave(group.id, mode), error: e => this.fail(e) }); }
  }
  private finishSave(groupId: number, mode: 'draft' | 'issue-print'): void {
    this.busy.set(false);
    this.router.navigate(['/introduction-letters'], mode === 'issue-print' ? { queryParams: { issueAndPrintGroup: groupId } } : undefined);
  }
  private fail(e: any): void { this.busy.set(false); this.error.set(this.message(e)); }
  private iso(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  private parseDate(value: string): Date { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d); }
  private message(e: any): string {
    if (typeof e?.error?.error === 'string') return e.error.error;
    if (e?.status >= 500) return 'Chưa lưu được giấy giới thiệu. Vui lòng thử lại.';
    return e?.message || 'Thao tác thất bại.';
  }
}
