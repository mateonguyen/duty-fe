import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SystemConfig {
  key: string;
  value: string | null;
  description?: string | null;
}

@Injectable({ providedIn: 'root' })
export class SystemConfigService {
  configs = signal<SystemConfig[]>([]);
  loading = signal(false);

  // Computed signal for MaxAssignableCLevel
  maxAssignableCLevel = computed(() => {
    const config = this.configs().find((c) => c.key === 'MaxAssignableCLevel');
    return config ? parseInt(config.value || '99', 10) : 99;
  });

  constructor(private http: HttpClient) {
    // Auto-load configs on service initialization
    this.loadConfigs();
  }

  loadConfigs(): void {
    this.fetchAll().subscribe({
      next: (configs) => this.configs.set(configs),
      error: (err) => console.error('Failed to load system configs:', err),
      complete: () => this.loading.set(false),
    });
  }

  fetchAll(): Observable<SystemConfig[]> {
    this.loading.set(true);
    return this.http.get<SystemConfig[]>('/api/systemconfig');
  }

  update(config: SystemConfig): Observable<void> {
    return this.http.post<void>('/api/systemconfig', config);
  }
}
