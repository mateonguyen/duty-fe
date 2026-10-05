import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ChangeTripStatusRequest,
  CreateSingleTravelOrderRequestDto,
  CreateTravelTripRequest,
  CreateTravelTripResponse,
  TravelOrderDetailDto,
  TravelOrderListItemDto,
  TravelOrderViewDto,
  TravelTripDetailDto,
  UpdateTravelOrderOverrideRequest,
  UpdateTravelOrderRequestDto,
} from '../models/travel.models';

@Injectable({
  providedIn: 'root',
})
export class TravelApiService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  // Trip endpoints
  createTrip(
    request: CreateTravelTripRequest,
  ): Observable<CreateTravelTripResponse> {
    return this.http.post<CreateTravelTripResponse>(
      `${this.apiUrl}/travel-trips`,
      request,
    );
  }

  getTrip(tripId: number): Observable<TravelTripDetailDto> {
    return this.http.get<TravelTripDetailDto>(
      `${this.apiUrl}/travel-trips/${tripId}`,
    );
  }

  updateTrip(tripId: number, request: any): Observable<TravelTripDetailDto> {
    return this.http.put<TravelTripDetailDto>(
      `${this.apiUrl}/travel-trips/${tripId}`,
      request,
    );
  }

  listTrips(): Observable<TravelTripDetailDto[]> {
    return this.http.get<TravelTripDetailDto[]>(`${this.apiUrl}/travel-trips`);
  }

  changeTripStatus(
    tripId: number,
    request: ChangeTripStatusRequest,
  ): Observable<TravelTripDetailDto> {
    return this.http.put<TravelTripDetailDto>(
      `${this.apiUrl}/travel-trips/${tripId}/status`,
      request,
    );
  }

  createReplacement(tripId: number, reason: string): Observable<{ tripId: number }> {
    return this.http.post<{ tripId: number }>(`${this.apiUrl}/travel-trips/${tripId}/replacement`, { reason });
  }

  createDemoTrip(): Observable<CreateTravelTripResponse> {
    return this.http.post<CreateTravelTripResponse>(
      `${this.apiUrl}/travel-trips/demo`,
      {},
    );
  }

  printTrip(tripId: number): Observable<TravelTripDetailDto> {
    return this.http.post<TravelTripDetailDto>(
      `${this.apiUrl}/travel-trips/${tripId}/print`,
      {},
    );
  }

  // Order endpoints
  listOrders(): Observable<TravelOrderListItemDto[]> {
    return this.http.get<TravelOrderListItemDto[]>(
      `${this.apiUrl}/travel-orders`,
    );
  }

  getOrderDetail(orderId: number): Observable<TravelOrderDetailDto> {
    return this.http.get<TravelOrderDetailDto>(
      `${this.apiUrl}/travel-orders/${orderId}`,
    );
  }

  deleteOrder(orderId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/travel-orders/${orderId}`);
  }

  createSingleOrder(
    request: CreateSingleTravelOrderRequestDto,
  ): Observable<TravelOrderDetailDto> {
    return this.http.post<TravelOrderDetailDto>(
      `${this.apiUrl}/travel-orders`,
      request,
    );
  }

  updateOrder(
    orderId: number,
    request: UpdateTravelOrderRequestDto,
  ): Observable<TravelOrderDetailDto> {
    return this.http.put<TravelOrderDetailDto>(
      `${this.apiUrl}/travel-orders/${orderId}`,
      request,
    );
  }

  getOrderView(orderId: number): Observable<TravelOrderViewDto> {
    return this.http.get<TravelOrderViewDto>(
      `${this.apiUrl}/travel-orders/${orderId}/view`,
    );
  }

  updateOrderOverride(
    orderId: number,
    request: UpdateTravelOrderOverrideRequest,
  ): Observable<TravelOrderViewDto> {
    return this.http.put<TravelOrderViewDto>(
      `${this.apiUrl}/travel-orders/${orderId}/override`,
      request,
    );
  }

  // Export PDF
  exportOrderPdf(orderId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/travel-orders/${orderId}/pdf`, {
      responseType: 'blob',
    });
  }

  exportTripPdf(tripId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/travel-trips/${tripId}/pdf`, {
      responseType: 'blob',
    });
  }

  exportOrdersPdf(orderIds: number[]): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/travel-orders/pdf/batch`, orderIds, {
      responseType: 'blob',
    });
  }

  // Preview PDF endpoint (MVP)
  /**
   * Generate preview PDF from preview request with tenCanBo and persons list
   */
  previewTripPdf(request: {
    empName: string;
    signerName: string;
    signerRankName?: string;
    signerUserId?: string;
    signerUnitId?: string;
    rootOrgId?: string;
    documentSnapshotJson?: string;
    empTitle?: string;
    soCongLenh?: string;
    persons: {
      fullName: string;
      username?: string;
      rankId?: string;
      rankCode?: string;
      rankName?: string;
      rankTitle?: string;
      displayNameWithRank?: string;
      positionTitle?: string;
      unitName?: string;
    }[];
    previewPersonIndex: number;
    missionDate?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
    stops?: {
      fromLocation?: string | null;
      toLocation?: string | null;
      fromDateTime?: string | null;
      toDateTime?: string | null;
      transport?: string | null;
    }[];
  }): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/travel-trips/preview/pdf`, request, {
      responseType: 'blob',
    });
  }
}
