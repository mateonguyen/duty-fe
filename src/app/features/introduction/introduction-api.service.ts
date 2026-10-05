import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface IntroductionLetter {
  id: number;
  batchId: number;
  batchNo: string;
  number: string | null;
  displayNumber: string;
  personUsername: string;
  fullName: string;
  rankName?: string;
  positionTitle?: string;
  unitName: string;
  recipientAgency: string;
  destination: string;
  purpose: string;
  issueDate: string;
  validUntil?: string;
  issuePlace: string;
  signerUsername: string;
  signerName: string;
  signerRankName?: string;
  signerPositionTitle?: string;
  signerUnitName?: string;
  status: string;
  canEdit: boolean;
  canDelete: boolean;
  createdAt: string;
}

export interface IntroductionGroup {
  id: number;
  batchNo: string;
  displayBatchNo: string;
  createdAt: string;
  canEdit: boolean;
  canTakeNumber: boolean;
  letters: IntroductionLetter[];
}

export interface IntroductionGroupRequest extends Omit<IntroductionRequest, 'personUsername'> {
  personUsernames: string[];
  signerOverrides?: Record<string, string>;
}

export interface IntroductionRequest {
  personUsername: string;
  signerUsername: string;
  recipientAgency: string;
  destination: string;
  purpose: string;
  issueDate: string | null;
  validUntil: string | null;
  issuePlace: string;
}

@Injectable({ providedIn: 'root' })
export class IntroductionApiService {
  private readonly base = '/api/introduction-letters';
  constructor(private http: HttpClient) {}
  list(): Observable<IntroductionLetter[]> { return this.http.get<IntroductionLetter[]>(this.base); }
  groups(): Observable<IntroductionGroup[]> { return this.http.get<IntroductionGroup[]>(`${this.base}/groups`); }
  group(id: number): Observable<IntroductionGroup> { return this.http.get<IntroductionGroup>(`${this.base}/groups/${id}`); }
  createGroup(value: IntroductionGroupRequest): Observable<IntroductionGroup> { return this.http.post<IntroductionGroup>(`${this.base}/groups`, value); }
  updateGroup(id: number, value: IntroductionGroupRequest): Observable<IntroductionGroup> { return this.http.put<IntroductionGroup>(`${this.base}/groups/${id}`, value); }
  deleteGroup(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/groups/${id}`); }
  takeNumbers(id: number): Observable<IntroductionGroup> { return this.http.post<IntroductionGroup>(`${this.base}/groups/${id}/take-number`, {}); }
  groupPdf(id: number): Observable<Blob> { return this.http.get(`${this.base}/groups/${id}/pdf`, { responseType: 'blob' }); }
  get(id: number): Observable<IntroductionLetter> { return this.http.get<IntroductionLetter>(`${this.base}/${id}`); }
  create(value: IntroductionRequest): Observable<IntroductionLetter> { return this.http.post<IntroductionLetter>(this.base, value); }
  update(id: number, value: IntroductionRequest): Observable<IntroductionLetter> { return this.http.put<IntroductionLetter>(`${this.base}/${id}`, value); }
  delete(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
  pdf(id: number): Observable<Blob> { return this.http.get(`${this.base}/${id}/pdf`, { responseType: 'blob' }); }
  preview(value: IntroductionRequest): Observable<Blob> { return this.http.post(`${this.base}/preview/pdf`, value, { responseType: 'blob' }); }
  batch(ids: number[]): Observable<Blob> { return this.http.post(`${this.base}/pdf/batch`, ids, { responseType: 'blob' }); }
}

export function printIntroductionPdf(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
  frame.setAttribute('aria-hidden', 'true');
  const cleanup = () => { frame.remove(); URL.revokeObjectURL(url); };
  frame.onload = () => {
    frame.contentWindow?.addEventListener('afterprint', cleanup, { once: true });
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  };
  frame.src = url;
  document.body.appendChild(frame);
  setTimeout(cleanup, 300000);
}
