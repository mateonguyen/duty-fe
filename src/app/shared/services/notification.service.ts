import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NotificationOverview } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/notifications';

  // Consumers distinguish failure from an empty inbox; never report a failed write as success.
  getMyNotifications(top = 20): Observable<NotificationOverview> {
    return this.http.get<NotificationOverview>(`${this.baseUrl}/my`, { params: { top } });
  }
  markAsRead(id: string): Observable<void> { return this.http.post<void>(`${this.baseUrl}/${id}/read`, {}); }
  markAllAsRead(): Observable<void> { return this.http.post<void>(`${this.baseUrl}/read-all`, {}); }
}
