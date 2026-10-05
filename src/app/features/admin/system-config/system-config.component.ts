import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { SystemConfigService } from './system-config.service';
import { OrganizationService, OrgSearchResult } from './organization.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  standalone: true,
  selector: 'app-system-config',
  templateUrl: './system-config.component.html',
  styleUrls: ['./system-config.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    InputSwitchModule,
    DropdownModule,
    ToastModule,
  ],
  providers: [MessageService],
})
export class SystemConfigComponent implements OnInit {
  saving = false;
  configs;
  loading;
  organizations;
  orgLoading;
  private _orgOptions: OrgSearchResult[] = [];
  orgLoadingFlag = false;
  private orgOptionsUpdateTrigger = signal(0);
  searchText = ''; // Separate search state

  get orgOptions(): OrgSearchResult[] {
    // Trigger để đảm bảo change detection
    this.orgOptionsUpdateTrigger();
    return this._orgOptions;
  }

  set orgOptions(value: OrgSearchResult[]) {
    this._orgOptions = value;
    this.orgOptionsUpdateTrigger.set(this.orgOptionsUpdateTrigger() + 1);
  }

  // Filtered options based on search text
  get filteredOrgOptions(): OrgSearchResult[] {
    if (!this.searchText || this.searchText.trim() === '') {
      return this._orgOptions;
    }
    const searchLower = this.searchText.toLowerCase().trim();
    return this._orgOptions.filter((org) => {
      if (!org) return false;
      const code = org.code?.toLowerCase() || '';
      const name = org.name?.toLowerCase() || '';
      const displayName = org.displayName?.toLowerCase() || '';
      return (
        code.includes(searchLower) ||
        name.includes(searchLower) ||
        displayName.includes(searchLower)
      );
    });
  }

  constructor(
    public svc: SystemConfigService,
    private orgSvc: OrganizationService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef
  ) {
    this.configs = this.svc.configs;
    this.loading = this.svc.loading;
    this.organizations = this.orgSvc.organizations;
    this.orgLoading = this.orgSvc.loading;
  }

  ngOnInit(): void {
    console.log('ngOnInit called');
    this.refreshConfigs();
  }

  private refreshConfigs() {
    this.svc.fetchAll().subscribe((cfgs) => {
      // Sắp xếp lại thứ tự các config theo yêu cầu
      const order = [
        'SystemName',
        'RootOrgCode',
        'MaxDutyDays',
        'EnableNotifications',
      ];
      const sortedCfgs = cfgs.sort((a, b) => {
        const indexA = order.indexOf(a.key);
        const indexB = order.indexOf(b.key);
        // Nếu không có trong order array thì để cuối
        const posA = indexA === -1 ? order.length : indexA;
        const posB = indexB === -1 ? order.length : indexB;
        return posA - posB;
      });
      this.svc.configs.set(sortedCfgs);
      this.svc.loading.set(false);

      // Sau khi load configs, đảm bảo load org options để dropdown hiển thị đúng
      this.loadOrgOptions();
    });
  }

  save() {
    this.saving = true;
    const configs = this.configs().filter(cfg => cfg.key !== 'RootOrgCode');
    if (configs.length === 0) { this.saving = false; return; }
    let count = 0;
    configs.forEach((cfg) => {
      this.svc.update(cfg).subscribe({
        next: () => {
          count++;
          if (count === configs.length) {
            this.saving = false;
            this.messageService.add({
              severity: 'success',
              summary: 'Thành công',
              detail: 'Lưu cấu hình thành công!',
            });
            // Load lại dữ liệu sau khi lưu thành công
            this.refreshConfigs();
          }
        },
        error: () => {
          this.saving = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: 'Có lỗi khi lưu cấu hình!',
          });
        },
      });
    });
  }

  getBooleanValue(config: any): boolean {
    return config.value === 'true' || config.value === true;
  }

  setBooleanValue(config: any, value: boolean) {
    config.value = value.toString();
  }

  getInputType(key: string) {
    if (
      key.toLowerCase().includes('enable') ||
      key.toLowerCase().includes('public')
    )
      return 'switch';
    if (key.toLowerCase().includes('max') || key.toLowerCase().includes('days'))
      return 'number';
    if (key.toLowerCase().includes('rootorg')) return 'dropdown';
    return 'text';
  }

  onOrgFilter(event: any) {
    // Only update search text for local filtering
    this.searchText = event.filter || '';
    // Optionally load more data from server if needed
    // For now, use local filtering for better UX
  }

  onOrgScroll(event: any) {
    // Load more data when scrolling to bottom
    // For now, just load with current filter
  }

  private loadOrgOptions(query = '', page = 1) {
    this.orgLoadingFlag = true;
    // Load more items to ensure we have the selected value
    this.orgSvc.searchOrganizations(query, page, 500).subscribe({
      next: (response) => {
        // Store current selection before updating options
        const rootOrgConfig = this.configs().find(
          (c) => c.key === 'RootOrgCode'
        );
        const currentValue = rootOrgConfig?.value;

        // Update options
        this._orgOptions = response.items;

        // Ensure selected value is in the list (matching by code field)
        if (
          currentValue &&
          !this._orgOptions.find((opt) => opt.code === currentValue)
        ) {
          // If current value is not in the list, try to fetch it
          console.warn(
            `Selected value ${currentValue} not found in options list`
          );
        }

        // Sort: move current selection to top for better UX
        if (currentValue) {
          const currentIndex = this._orgOptions.findIndex(
            (opt) => opt.code === currentValue
          );
          if (currentIndex > 0) {
            const [currentOrg] = this._orgOptions.splice(currentIndex, 1);
            this._orgOptions = [currentOrg, ...this._orgOptions];
          }
        }

        this.orgLoadingFlag = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('API error in loadOrgOptions:', err);
        this.orgLoadingFlag = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Lỗi',
          detail: 'Không thể tải danh sách đơn vị',
        });
      },
    });
  }

  getSelectedOrg(value: string | null) {
    if (!value) return null;
    // RootOrgCode config stores org CODE (for scope matching), so match by code field
    const allOrgs = this.flattenOrganizations(this.organizations());
    return allOrgs.find((org) => org.code === value) || null;
  }

  flattenOrganizations(orgs: any[]): any[] {
    const result: any[] = [];
    const flatten = (nodes: any[]) => {
      nodes.forEach((node) => {
        // Store both code and id; RootOrgConfig uses code for scope matching
        result.push({
          code: node.code, // Used for RootOrgCode config (scope matching)
          id: node.id, // Reference only
          name: `${node.code} - ${node.name}`,
        });
        if (node.children && node.children.length > 0) {
          flatten(node.children);
        }
      });
    };
    flatten(orgs);
    return result;
  }

  // TrackBy function for dropdown to prevent losing selection
  trackByOrgCode(index: number, item: OrgSearchResult): string {
    return item.code || item.id;
  }

  // Reset search text when dropdown is hidden
  onDropdownHide() {
    this.searchText = '';
  }
}
