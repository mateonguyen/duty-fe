import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RosterListItem } from './schedule';

export interface RosterCreateDto {
  name: string;
  scopeUnitId: number;
  periodStart: string; // ISO date string "YYYY-MM-DD"
  periodEnd: string;
  defaultLocationId?: number;
}

export interface RosterUpdateDto {
  id: number;
  name: string;
  periodStart: string;
  periodEnd: string;
  defaultLocationId?: number;
}

@Injectable({ providedIn: 'root' })
export class RosterApiService {
  private http = inject(HttpClient);
  private baseUrl = '/api/rosters';

  getByMonth(
    unitId: number,
    year: number,
    month: number
  ): Observable<RosterListItem[]> {
    const params = new HttpParams()
      .set('unitId', unitId.toString())
      .set('year', year.toString())
      .set('month', month.toString());
    return this.http.get<RosterListItem[]>(`${this.baseUrl}/by-month`, {
      params,
    });
  }

  getById(id: number): Observable<RosterListItem> {
    return this.http.get<RosterListItem>(`${this.baseUrl}/${id}`);
  }

  getMatrix(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${id}/matrix`);
  }

  create(dto: RosterCreateDto): Observable<RosterListItem> {
    return this.http.post<RosterListItem>(this.baseUrl, dto);
  }

  update(dto: RosterUpdateDto): Observable<RosterListItem> {
    return this.http.put<RosterListItem>(`${this.baseUrl}/${dto.id}`, dto);
  }

  publish(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/publish`, {});
  }

  unpublish(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/unpublish`, {});
  }

  lock(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/lock`, {});
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
