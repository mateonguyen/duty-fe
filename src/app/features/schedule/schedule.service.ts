import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { CalendarMap } from './schedule';

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private http = inject(HttpClient);
  private base = '/api/rosters';

  /** Lấy calendar của 1 ca cho 1 roster */
  getCalendar(rosterId: number, shiftId: number, month: string) {
    const params = new HttpParams().set('shiftId', shiftId).set('month', month);
    return this.http.get<CalendarMap>(`${this.base}/${rosterId}/calendar`, {
      params,
    });
  }

  /** Tổng hợp cho badge tab */
  getSummary(rosterId: number, shiftId: number, month: string) {
    const params = new HttpParams().set('shiftId', shiftId).set('month', month);
    return this.http.get<{
      assigned: number;
      total: number;
      conflicts: number;
    }>(`${this.base}/${rosterId}/summary`, { params });
  }

  /** Gán hàng loạt */
  assignBulk(
    rosterId: number,
    body: { shiftId: number; userIds: number[]; dates: string[] }
  ) {
    return this.http.post(`${this.base}/${rosterId}/assign/bulk`, body);
  }

  /** Bỏ gán một ô */
  remove(
    rosterId: number,
    body: { shiftId: number; userId: number; date: string }
  ) {
    return this.http.request('delete', `${this.base}/${rosterId}/assign`, {
      body,
    });
  }
}
