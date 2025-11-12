import { Injectable, signal } from '@angular/core';
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

  constructor(private http: HttpClient) {}

  fetchAll(): Observable<SystemConfig[]> {
    this.loading.set(true);
    return this.http.get<SystemConfig[]>('/api/systemconfig');
  }

  update(config: SystemConfig): Observable<void> {
    return this.http.post<void>('/api/systemconfig', config);
  }
}
