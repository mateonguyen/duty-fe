import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { UiSelectComponent, UiSelectOption } from '../../../shared/components/ui-select/ui-select.component';
import { environment } from '../../../../environments/environment';
import { DirectoryCatalog, DirectoryClassification, DirectoryDraft, DirectoryKind, DirectoryOrganization, DirectoryPerson } from './directory.models';
import { OrganizationTreeComponent } from './organization-tree.component';
import { OrganizationDetailComponent } from './organization-detail.component';
import { AuthService } from '../../../core/auth/auth.service';

interface AccessGrant { id: number; roleCode: string; roleName: string; scopeUnitCode: string | null; includeChildren: boolean; grantedByUsername: string | null; grantedAt: string; grantReason: string | null; expiresAt: string | null; }
interface AccessRole { code: string; name: string; description?: string | null; permissionCount: number; active: boolean; }

@Component({
  standalone: true, imports: [CommonModule, FormsModule, RouterLink, DialogModule, UiSelectComponent, OrganizationTreeComponent, OrganizationDetailComponent],
  host: { '[class.directory-workspace-host]': "kind === 'personnel' || kind === 'organizations'" },
  templateUrl: './local-directory.component.html', styleUrls: ['./local-directory.component.scss'],
})
export class LocalDirectoryComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = `${environment.apiBaseUrl}/api/directory`;
  private readonly organizationOrder = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
  private request?: Subscription;
  readonly tabs: { key: DirectoryKind; label: string; icon: string; description: string }[] = [
    { key: 'organizations', label: 'Đơn vị', icon: 'pi pi-sitemap', description: 'Cơ cấu tổ chức và đơn vị trực thuộc' },
    { key: 'personnel', label: 'Cán bộ', icon: 'pi pi-users', description: 'Hồ sơ cán bộ và liên kết tài khoản SSO' },
    { key: 'positions', label: 'Chức vụ', icon: 'pi pi-briefcase', description: 'Chức danh và cấp lãnh đạo, người ký' },
    { key: 'ranks', label: 'Cấp bậc', icon: 'pi pi-star', description: 'Danh mục cấp bậc dùng chung' },
  ];
  readonly statusOptions: UiSelectOption[] = [{ value: '', label: 'Tất cả trạng thái' }, { value: 'active', label: 'Đang hoạt động' }, { value: 'inactive', label: 'Ngừng hoạt động' }];
  kind: DirectoryKind = 'organizations';
  data?: DirectoryCatalog;
  draft: DirectoryDraft = this.emptyDraft();
  editing = '';
  editorOpen = false;
  editorError = '';
  error = ''; message = ''; query = ''; status = ''; selectedOrg = ''; page = 1; loading = false; saving = false;
  discardOpen = false;
  accessPerson?: DirectoryPerson;
  accessOpen = false;
  accessLoading = false;
  accessScopesLoading = false;
  accessRolesLoading = false;
  accessRolesError = '';
  accessSaving = false;
  accessError = '';
  accessMessage = '';
  accessGrants: AccessGrant[] = [];
  accessRoles: AccessRole[] = [];
  accessScopeCodes: string[] = [];
  accessRoleCodes: string[] = [];
  accessRemovedGrantIds: number[] = [];
  accessScopeCode = '';
  accessReason = '';
  accessExpiry = '';
  accessIncludeChildren = false;
  private orgBaseline = '';
  private discardPromise?: Promise<boolean>;
  private discardDecision?: (answer: boolean) => void;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const kind = params.get('kind');
      this.kind = this.tabs.some(x => x.key === kind) ? kind as DirectoryKind : 'organizations';
      this.editorOpen = false; this.orgBaseline = ''; this.query = ''; this.status = ''; this.selectedOrg = ''; this.page = 1; this.message = ''; this.load();
    });
  }
  get tab() { return this.tabs.find(x => x.key === this.kind)!; }
  get label() { return this.tab.label.toLocaleLowerCase('vi-VN'); }
  get writable() { return this.data?.mode === 'Local' && this.auth.hasPermission('system.config'); }
  get canManageAccess() { return this.auth.hasPermission('role.assign'); }
  get isExceptionalGrant() {
    if (!this.accessPerson || !this.accessScopeCode) return false;
    const home = this.organizations.find(x => x.code === this.accessPerson?.orgCode);
    const scope = this.organizations.find(x => x.code === this.accessScopeCode);
    if (!home || !scope) return false;
    return !this.descendants(home).has(scope.code) && !this.descendants(scope).has(home.code);
  }
  get isParentScopeGrant() {
    const homeCode = this.accessPerson?.orgCode;
    const scope = this.organizations.find(x => x.code === this.accessScopeCode);
    return !!homeCode && !!scope && scope.code !== homeCode && this.descendants(scope).has(homeCode);
  }
  get availableAccessRoles() { return this.accessRoles.filter(x => x.active && (x.code !== 'admin' || (!!this.root && this.accessScopeCodes.includes(this.root.code)))); }
  get canManageRoles() { return this.auth.hasPermission('user.manage'); }
  get needsExceptionalGrantDetails() { return this.isExceptionalGrant && this.accessRoleCodes.some(code => code !== 'admin'); }
  assignedGrantHere(code: string): AccessGrant | undefined {
    const scope = code === 'admin' ? this.root?.code : this.accessScopeCode;
    return scope ? this.accessGrants.find(grant => grant.roleCode === code
      && (grant.scopeUnitCode === scope || (code === 'admin' && !grant.scopeUnitCode))
      && (grant.includeChildren || !this.accessIncludeChildren)) : undefined;
  }
  isRoleAssignedHere(code: string): boolean { return !!this.assignedGrantHere(code); }
  get pendingAccessRoleCodes(): string[] {
    return this.accessRoleCodes.filter(code => code !== 'viewer' && !this.isRoleAssignedHere(code));
  }
  get hasPendingAccessChanges(): boolean { return this.pendingAccessRoleCodes.length > 0 || this.accessRemovedGrantIds.length > 0; }
  isGrantMarkedForRemoval(grant: AccessGrant): boolean { return this.accessRemovedGrantIds.includes(grant.id); }
  isRoleSelected(code: string): boolean {
    if (code === 'viewer') return true;
    const assigned = this.assignedGrantHere(code);
    return assigned ? !this.isGrantMarkedForRemoval(assigned) : this.accessRoleCodes.includes(code);
  }
  roleHint(role: AccessRole): string {
    if (role.code === 'viewer') return 'Tự động theo đơn vị công tác';
    const assigned = this.assignedGrantHere(role.code);
    if (assigned) return this.isGrantMarkedForRemoval(assigned) ? 'Sẽ bỏ khi cập nhật' : 'Đã gán · bấm để bỏ chọn';
    if (this.accessRoleCodes.includes(role.code)) return 'Sẽ gán khi cập nhật';
    return role.description || `${role.permissionCount} quyền chức năng`;
  }
  toggleGrantRemoval(grant: AccessGrant): void {
    if (this.accessSaving || this.accessLoading || grant.roleCode === 'DIRECTORY_ADMIN'
      || (grant.roleCode === 'viewer' && grant.grantedByUsername === 'SYSTEM')) return;
    this.accessRemovedGrantIds = this.isGrantMarkedForRemoval(grant)
      ? this.accessRemovedGrantIds.filter(id => id !== grant.id) : [...this.accessRemovedGrantIds, grant.id];
    this.accessError = ''; this.accessMessage = '';
  }
  selectAccessRole(code: string): void {
    if (code === 'viewer' || this.accessSaving || this.accessLoading) return;
    const assigned = this.assignedGrantHere(code);
    if (assigned) { this.toggleGrantRemoval(assigned); return; }
    this.accessRoleCodes = this.accessRoleCodes.includes(code)
      ? this.accessRoleCodes.filter(x => x !== code) : [...this.accessRoleCodes, code];
    this.accessError = ''; this.accessMessage = '';
  }
  get accessScopeOptions(): UiSelectOption[] { return this.organizations.filter(x => x.active && this.accessScopeCodes.includes(x.code)).map(x => ({ value: x.code, label: x.name, detail: x.code })); }
  get hasTree() { return this.kind === 'organizations' || this.kind === 'personnel'; }
  get organizations() { return this.data?.organizations || []; }
  get root() { return this.organizations.find(x => !x.parentId); }
  get selectedUnit() { return this.organizations.find(x => x.code === this.selectedOrg); }
  get unitFilterOptions(): UiSelectOption[] { return [{ value: '', label: 'Tất cả đơn vị' }, ...this.organizations.map(x => ({ value: x.code, label: x.name, detail: x.code + (x.active ? '' : ' · ngừng hoạt động') }))]; }
  get totalPages() { return Math.max(1, Math.ceil((this.data?.total || 0) / 50)); }
  get rangeStart() { return this.data?.total ? (this.page - 1) * 50 + 1 : 0; }
  get rangeEnd() { return Math.min(this.page * 50, this.data?.total || 0); }
  count(kind: DirectoryKind): number { return kind === 'personnel' ? this.data?.personnelTotal ?? this.data?.total ?? 0 : this.data?.[kind].length || 0; }
  private normalize(value: string | null | undefined) { return (value || '').toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd'); }
  private same(a: string | null | undefined, b: string | null | undefined) { return !!a && !!b && a.toUpperCase() === b.toUpperCase(); }
  private children(org: DirectoryOrganization) { return this.organizations.filter(x => this.same(x.parentId, org.id) || this.same(x.parentId, org.code)); }
  private descendants(org: DirectoryOrganization): Set<string> {
    const result = new Set<string>(); const queue = [org];
    while (queue.length) { const node = queue.shift()!; if (result.has(node.code)) continue; result.add(node.code); queue.push(...this.children(node)); }
    return result;
  }
  private organizationSnapshot() { const d = this.draft; return JSON.stringify([d.code, d.name, d.parentId, d.shortName, d.active]); }
  get organizationDirty() { return this.kind === 'organizations' && this.editorOpen && this.organizationSnapshot() !== this.orgBaseline; }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent) { if (this.organizationDirty) { event.preventDefault(); event.returnValue = ''; } }
  confirmDiscard(): boolean | Promise<boolean> {
    if (this.saving) return false;
    if (!this.organizationDirty) return true;
    if (!this.discardPromise) {
      this.discardOpen = true;
      this.discardPromise = new Promise<boolean>(resolve => this.discardDecision = resolve);
    }
    return this.discardPromise;
  }
  resolveDiscard(answer: boolean) {
    this.discardOpen = false; const resolve = this.discardDecision;
    this.discardPromise = undefined; this.discardDecision = undefined;
    if (answer) this.orgBaseline = this.organizationSnapshot();
    resolve?.(answer);
  }
  async selectOrg(code: string) {
    if (this.kind === 'organizations') {
      if (!(await this.confirmDiscard())) return;
      this.cancelOrganizationEdit(); this.selectedOrg = code; return;
    }
    this.selectedOrg = code; this.page = 1; if (this.kind === 'personnel') this.load();
  }
  cancelOrganizationEdit() { this.editorOpen = false; this.editorError = ''; this.editing = ''; this.orgBaseline = ''; }
  async refresh() { if (await this.confirmDiscard()) { if (this.kind === 'organizations') this.cancelOrganizationEdit(); this.load(); } }
  get rows(): any[] {
    if (this.kind === 'personnel') return this.data?.personnel || [];
    const codes = this.selectedUnit ? this.descendants(this.selectedUnit) : null;
    const term = this.normalize(this.query);
    return (this.data?.[this.kind] || []).filter(x => (!term || this.normalize(x.code + ' ' + x.name).includes(term))
      && (!this.status || x.active === (this.status === 'active')) && (this.kind !== 'organizations' || !codes || codes.has(x.code)));
  }
  get parentOptions(): UiSelectOption[] {
    const edited = this.organizations.find(x => x.code === this.editing);
    const excluded = edited ? this.descendants(edited) : new Set<string>();
    return [{ value: null, label: 'Đơn vị gốc của bản cài', disabled: !!this.root && this.root.code !== this.editing },
      ...this.organizations.filter(x => x.active && !excluded.has(x.code)).map(x => ({ value: x.id, label: x.name, detail: x.code }))];
  }
  get orgOptions(): UiSelectOption[] { return this.organizations.filter(x => x.active || x.code === this.draft.orgCode).map(x => ({ value: x.code, label: x.name, detail: x.code + (x.active ? '' : ' · ngừng hoạt động') })); }
  get positionOptions(): UiSelectOption[] { return [{ value: null, label: 'Chưa chọn chức vụ' }, ...(this.data?.positions || []).filter(x => x.active || x.code === this.draft.positionCode).map(x => ({ value: x.code, label: x.name, detail: x.code }))]; }
  get rankOptions(): UiSelectOption[] { return [{ value: null, label: 'Chưa chọn cấp bậc' }, ...(this.data?.ranks || []).filter(x => x.active || x.code === this.draft.rankCode).map(x => ({ value: x.code, label: x.name, detail: x.code }))]; }
  private emptyDraft(): DirectoryDraft { return { code: '', name: '', parentId: null, shortName: '', username: '', fullName: '', orgCode: '', positionCode: null, rankCode: null, active: true, phone: '', email: '', level: null, order: null }; }
  async create(parent?: DirectoryOrganization): Promise<void> {
    if (!this.writable || this.saving) return;
    if (parent && !parent.active) return;
    if (this.kind === 'organizations' && !(await this.confirmDiscard())) return;
    this.editing = ''; this.editorError = ''; this.message = ''; this.draft = this.emptyDraft();
    this.draft.parentId = parent?.id || (this.selectedUnit?.active ? this.selectedUnit.id : this.root?.id) || null;
    this.draft.orgCode = this.selectedOrg; this.editorOpen = true;
    if (this.kind === 'organizations') { if (parent) this.selectedOrg = parent.code; this.orgBaseline = this.organizationSnapshot(); }
  }
  async edit(row: DirectoryOrganization | DirectoryPerson | DirectoryClassification): Promise<void> {
    if (!this.writable || this.saving) return;
    if (this.kind === 'organizations' && !(await this.confirmDiscard())) return;
    this.editing = 'username' in row ? row.username : row.code;
    this.draft = { ...this.emptyDraft(), ...row } as DirectoryDraft;
    // Legacy PID may be a CODE; select always submits the stable organization ID.
    if (this.kind === 'organizations' && this.draft.parentId) this.draft.parentId = this.organizations.find(x => this.same(x.id, this.draft.parentId) || this.same(x.code, this.draft.parentId))?.id || this.draft.parentId;
    this.editorError = ''; this.message = ''; this.editorOpen = true;
    if (this.kind === 'organizations') { this.selectedOrg = this.editing; this.orgBaseline = this.organizationSnapshot(); }
  }
  orgName(code: string) { return this.organizations.find(x => x.code === code)?.name || code || 'Chưa có đơn vị'; }
  classificationName(kind: 'positions' | 'ranks', code: string | null) { return this.data?.[kind].find(x => x.code === code)?.name || 'Chưa chọn'; }
  initials(name: string) { return (name || '').trim().split(/\s+/).slice(-2).map(x => x[0] || '').join('').toUpperCase(); }
  openAccess(person: DirectoryPerson): void {
    this.accessPerson = person; this.accessOpen = true; this.accessError = ''; this.accessMessage = ''; this.accessRoleCodes = []; this.accessRemovedGrantIds = []; this.accessScopeCodes = [];
    this.accessScopeCode = person.orgCode; this.accessReason = ''; this.accessExpiry = ''; this.accessIncludeChildren = true;
    this.loadAccess();
  }
  loadAccess(): void {
    if (!this.accessPerson) return;
    this.accessLoading = true;
    const url = `${environment.apiBaseUrl}/api/auth`;
    this.http.get<AccessGrant[]>(`${url}/user-roles`, { params: { username: this.accessPerson.username } })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.accessLoading = false))
      .subscribe({ next: grants => this.accessGrants = grants, error: err => this.accessError = err.error?.message || 'Không tải được quyền của cán bộ.' });
    this.accessScopesLoading = true;
    this.http.get<string[]>(`${url}/grant-scopes`, { params: { username: this.accessPerson.username } })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.accessScopesLoading = false))
      .subscribe({ next: codes => { this.accessScopeCodes = codes; if (!codes.includes(this.accessScopeCode)) this.accessScopeCode = codes[0] || ''; },
        error: () => this.accessError = 'Không kiểm tra được phạm vi cấp quyền.' });
    if (!this.accessRoles.length) this.loadAccessTasks();
  }
  loadAccessTasks(): void {
    this.accessRolesLoading = true;
    this.accessRolesError = '';
    this.http.get<AccessRole[]>(`${environment.apiBaseUrl}/api/auth/grantable-roles`)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.accessRolesLoading = false))
      .subscribe({
        next: roles => {
          this.accessRoles = roles;
          if (!this.availableAccessRoles.length) this.accessRolesError = 'Chưa có vai trò nào có thể gán. Kiểm tra danh mục vai trò hoặc chạy lại Backend để cập nhật.';
        },
        error: err => this.accessRolesError = err.status === 404
          ? 'Backend đang chạy phiên bản cũ. Sau khi bạn chạy lại Backend, bấm Tải lại.'
          : err.status === 403
            ? 'Tài khoản hiện tại không có quyền phân quyền cán bộ.'
            : 'Không tải được chức năng phân quyền. Kiểm tra Backend rồi bấm Tải lại.',
      });
  }
  updateAccess(): void {
    if (!this.accessPerson || !this.hasPendingAccessChanges || this.accessSaving || this.accessLoading
      || (this.pendingAccessRoleCodes.length > 0 && !this.accessScopeCode)) return;
    const username = this.accessPerson.username;
    const assignments = this.pendingAccessRoleCodes.map(roleCode => ({
      roleCode,
      scopeUnitCode: roleCode === 'admin' ? this.root?.code : this.accessScopeCode,
      includeChildren: roleCode === 'admin' ? true : this.accessIncludeChildren,
      reason: this.isExceptionalGrant && roleCode !== 'admin' ? this.accessReason : null,
      expiresAt: this.isExceptionalGrant && roleCode !== 'admin' && this.accessExpiry ? new Date(`${this.accessExpiry}T23:59:59`).toISOString() : null,
    })).filter(request => request.scopeUnitCode && !this.accessGrants.some(grant =>
      grant.roleCode === request.roleCode && grant.scopeUnitCode === request.scopeUnitCode
      && grant.includeChildren === request.includeChildren && !this.isGrantMarkedForRemoval(grant)));
    if (!assignments.length && !this.accessRemovedGrantIds.length) return;
    this.accessSaving = true; this.accessError = ''; this.accessMessage = '';
    this.http.post(`${environment.apiBaseUrl}/api/auth/update-user-roles`, {
      username, revokeIds: this.accessRemovedGrantIds, assignments,
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.accessSaving = false))
      .subscribe({ next: () => { this.accessRoleCodes = []; this.accessRemovedGrantIds = []; this.accessReason = ''; this.accessExpiry = ''; this.accessMessage = 'Đã cập nhật vai trò của cán bộ.'; this.loadAccess(); },
        error: err => this.accessError = err.status === 404
          ? 'Backend đang chạy bản cũ. Sau khi bạn chạy lại Backend, bấm Cập nhật.'
          : err.error?.message || `Không cập nhật được vai trò (HTTP ${err.status || 'không xác định'}).` });
  }
  grantScopeLabel(grant: AccessGrant): string { return grant.scopeUnitCode ? this.orgName(grant.scopeUnitCode) + (grant.includeChildren ? ' và cấp dưới' : '') : 'Toàn hệ thống · quyền cũ'; }
  isLegacyGrant(grant: AccessGrant): boolean { return grant.roleCode !== 'DIRECTORY_ADMIN' && (!['viewer', 'roster.editor', 'roster.publisher', 'travel.editor', 'travel.manager', 'access.manager'].includes(grant.roleCode) || !grant.scopeUnitCode); }
  filterChanged() { this.page = 1; if (this.kind === 'personnel') this.load(); }
  clearFilters() { this.query = ''; this.status = ''; this.selectedOrg = ''; this.page = 1; if (this.kind === 'personnel') this.load(); }
  changePage(delta: number) { this.page = Math.max(1, Math.min(this.totalPages, this.page + delta)); this.load(); }
  load(): void {
    this.request?.unsubscribe(); this.loading = true; this.error = '';
    let params = new HttpParams().set('page', this.page);
    if (this.kind === 'personnel') {
      params = params.set('q', this.query).set('orgCode', this.selectedOrg);
      if (this.status) params = params.set('active', this.status === 'active');
    }
    this.request = this.http.get<DirectoryCatalog>(this.api, { params }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false))
      .subscribe({ next: data => {
        const lastPage = Math.max(1, Math.ceil(data.total / 50));
        if (this.kind === 'personnel' && this.page > lastPage) {
          this.page = lastPage; queueMicrotask(() => this.load()); return;
        }
        this.data = { ...data, organizations: [...data.organizations].sort((a, b) => this.organizationOrder.compare(a.code, b.code)) };
        if (this.kind === 'organizations' && !this.selectedUnit) this.selectedOrg = this.root?.code || this.organizations[0]?.code || '';
      }, error: err => { this.error = err.error?.error || 'Không tải được danh mục. Vui lòng thử lại.'; } });
  }
  save(): void {
    if (!this.writable || this.saving) return;
    if (this.kind === 'organizations' && this.editing && !this.organizationDirty) return;
    this.saving = true; this.editorError = ''; this.message = '';
    const url = `${this.api}/${this.kind}${this.editing ? '/' + encodeURIComponent(this.editing) : ''}`;
    const d = this.draft;
    const body = this.kind === 'personnel' ? { username: d.username, fullName: d.fullName, orgCode: d.orgCode, positionCode: d.positionCode, rankCode: d.rankCode, active: d.active, phone: d.phone || null, email: d.email || null }
      : this.kind === 'organizations' ? { code: d.code, name: d.name, parentId: d.parentId, shortName: d.shortName || null, active: d.active }
      : { code: d.code, name: d.name, level: d.level, order: d.order, active: d.active };
    const options = { headers: { 'X-Duty-Admin': '1' } };
    (this.editing ? this.http.put(url, body, options) : this.http.post(url, body, options))
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving = false)).subscribe({ next: () => {
        this.editorOpen = false; this.orgBaseline = ''; if (this.kind === 'organizations') this.selectedOrg = d.code.trim().toUpperCase();
        this.message = `Đã lưu ${this.label} “${d.fullName || d.name}”.`; this.load();
      }, error: err => { this.editorError = err.error?.error || 'Không lưu được. Kiểm tra các trường nhập rồi thử lại.'; } });
  }
}
