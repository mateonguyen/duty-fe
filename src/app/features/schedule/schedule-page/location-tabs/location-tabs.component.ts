import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { DutyLocation } from '../../schedule';

export interface LocationConfig {
  id: number;
  name: string;
  isEnabled: boolean;
}

/**
 * Location Tabs Component
 *
 * Displays duty locations as horizontal tabs with scroll support.
 * Includes configuration dialog to enable/disable locations for roster.
 * Green theme palette: #0A8F4B primary, #CDEEDD border, #EAFBF2 active bg
 */
@Component({
  standalone: true,
  selector: 'app-location-tabs',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TooltipModule,
    DialogModule,
    CheckboxModule,
  ],
  templateUrl: './location-tabs.component.html',
  styleUrls: ['./location-tabs.component.scss'],
})
export class LocationTabsComponent {
  // All available locations in scope
  @Input() allLocations: DutyLocation[] = [];

  // Configuration: which locations are enabled for this roster
  @Input() set locationConfigs(configs: LocationConfig[]) {
    this._locationConfigs = configs;
    this.configsMap.set(new Map(configs.map((c) => [c.id, c.isEnabled])));
  }
  get locationConfigs(): LocationConfig[] {
    return this._locationConfigs;
  }
  private _locationConfigs: LocationConfig[] = [];

  @Input() selectedLocationId: number | null = null;

  // Emits when user selects a location tab
  @Output() locationChange = new EventEmitter<number>();

  // Emits when user toggles location enable/disable
  // Parent should handle confirmation if location has assignments
  @Output() locationConfigChange = new EventEmitter<LocationConfig[]>();

  // Internal state for config dialog
  configsMap = signal<Map<number, boolean>>(new Map());
  manageDialogVisible = false; // Use regular property for two-way binding
  tempConfigs = new Map<number, boolean>();

  // Computed: only show enabled locations
  enabledLocations = computed(() => {
    const map = this.configsMap();
    return this.allLocations.filter((loc) => map.get(loc.id) === true);
  });

  // Computed selected location for template usage
  selectedLocation = computed<DutyLocation | null>(() => {
    const id = this.selectedLocationId;
    if (!id) return null;
    return this.allLocations.find((loc) => loc.id === id) ?? null;
  });

  selectLocation(location: DutyLocation) {
    this.locationChange.emit(location.id);
  }

  trackByLocationId(index: number, location: DutyLocation): number {
    return location.id;
  }

  openManageDialog() {
    // Copy current state to temp
    this.tempConfigs = new Map(this.configsMap());
    this.manageDialogVisible = true;
  }

  toggleLocationConfig(locationId: number, enabled: boolean) {
    this.tempConfigs.set(locationId, enabled);
  }

  isLocationEnabled(locationId: number): boolean {
    return this.tempConfigs.get(locationId) ?? false;
  }

  selectAllLocations() {
    this.allLocations.forEach((loc) => {
      this.tempConfigs.set(loc.id, true);
    });
  }

  clearAllLocations() {
    this.tempConfigs.clear();
    this.allLocations.forEach((loc) => {
      this.tempConfigs.set(loc.id, false);
    });
  }

  applyLocationConfig() {
    // Build new config array
    const newConfigs: LocationConfig[] = this.allLocations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      isEnabled: this.tempConfigs.get(loc.id) ?? false,
    }));

    // Emit to parent for confirmation & assignment cleanup
    this.locationConfigChange.emit(newConfigs);
    this.manageDialogVisible = false;
  }

  cancelManageDialog() {
    this.tempConfigs.clear();
    this.manageDialogVisible = false;
  }
}
