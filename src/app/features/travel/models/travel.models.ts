// Request/Response DTOs
export interface CreateTravelTripRequest {
  tripNo: string;
  missionNo?: string;
  missionDate?: string; // ISO date string
  purpose?: string;
  fromDate?: string;
  toDate?: string;
  departureDate?: string;
  signerName?: string;
  signerTitle?: string;
  signerUnitName?: string;
  signedAt?: string;
  stops: CreateTravelTripStopDto[];
  persons: CreateTravelOrderDto[];
}

export interface CreateTravelTripStopDto {
  stopIndex: number;
  fromLocation: string;
  fromDateTime?: string; // ISO datetime string
  toLocation?: string;
  toDateTime?: string;
  transport?: string;
}

export interface CreateTravelOrderDto {
  orderNo: string;
  personId?: string;
  personCode?: string;
  fullName: string;
  displayNameWithRank?: string;
  rankId?: string;
  rankCode?: string;
  rankName?: string;
  positionTitle?: string;
  rankTitle?: string;
  unitName: string;
  unitCode?: string;
  missionNoOverride?: string;
  missionDateOverride?: string;
  fromDateOverride?: string;
  toDateOverride?: string;
  departureDateOverride?: string;
  stopOverrides: CreateTravelOrderStopOverrideDto[];
}

export interface CreateTravelOrderStopOverrideDto {
  stopIndex: number;
  fromLocationOverride?: string;
  fromDateTimeOverride?: string;
  toLocationOverride?: string;
  toDateTimeOverride?: string;
  transportOverride?: string;
}

// Detail View DTOs
export interface TravelTripDetailDto {
  canTakeNumber: boolean;
  id: number;
  tripNo: string;
  missionNo?: string;
  missionDate?: string;
  purpose?: string;
  fromDate?: string;
  toDate?: string;
  departureDate?: string;
  signerName?: string;
  signerTitle?: string;
  signerUnitName?: string;
  signedAt?: string;
  status: string; // "DRAFT", "PRINTED", "SIGNED", "CLOSED", "CANCELLED"
  issuedAt?: string;
  issuedBy?: string;
  cancellationReason?: string;
  replacesTripId?: number;
  legacyReviewedAt?: string;
  legacyReviewedBy?: string;
  legacyReviewNote?: string;
  createdAt: string;
  stops: TravelTripStopDto[];
  orders: TravelOrderDto[];
}

export interface TravelTripStopDto {
  id: number;
  stopIndex: number;
  fromLocation: string;
  fromDateTime?: string;
  toLocation?: string;
  toDateTime?: string;
  transport?: string;
}

export interface TravelOrderDto {
  id: number;
  orderNo: string;
  personId?: string;
  personCode?: string;
  unitCode?: string;
  fullName: string;
  displayNameWithRank?: string;
  rankId?: string;
  rankCode?: string;
  rankName?: string;
  positionTitle?: string;
  rankTitle?: string;
  unitName: string;
  status: string;
  overrideCount: number;
}

// Order View DTO (merged view)
export interface TravelOrderViewDto {
  id: number;
  orderNo: string;
  fullName: string;
  displayNameWithRank?: string;
  rankId?: string;
  rankCode?: string;
  rankName?: string;
  positionTitle?: string;
  rankTitle?: string;
  unitName: string;
  unitCode?: string;
  missionNo?: string;
  missionDate?: string;
  purpose?: string;
  fromDate?: string;
  toDate?: string;
  departureDate?: string;
  signerName?: string;
  signerTitle?: string;
  signerUnitName?: string;
  signerPositionTitle?: string;
  signedAt?: string;
  status: string;
  stopsMerged: TravelStopViewDto[];
}

export interface TravelStopViewDto {
  stopIndex: number;
  fromLocation: string;
  fromDateTime?: string;
  toLocation?: string;
  toDateTime?: string;
  transport?: string;
}

export interface TravelOrderListItemDto {
  id: number;
  canEdit: boolean;
  canDelete: boolean;
  canTakeNumber: boolean;
  tripId: number;
  tripNo: string;
  orderNo: string;
  fullName: string;
  displayNameWithRank?: string;
  rankId?: string;
  rankCode?: string;
  rankName?: string;
  positionTitle?: string;
  rankTitle?: string;
  unitName: string;
  missionNo?: string;
  signerName?: string;
  signerPositionTitle?: string;
  status: string;
  createdAt: string;
  tripCreatedAt: string;
}

export interface TravelOrderItineraryStopDto {
  stopIndex: number;
  fromLocation: string;
  fromDateTime?: string;
  toLocation?: string;
  toDateTime?: string;
  transport?: string;
}

export interface TravelOrderDetailDto {
  id: number;
  tripId: number;
  tripNo: string;
  orderNo: string;
  personId?: string;
  personCode?: string;
  fullName: string;
  displayNameWithRank?: string;
  rankId?: string;
  rankCode?: string;
  rankName?: string;
  positionTitle?: string;
  rankTitle?: string;
  unitName: string;
  unitCode?: string;
  missionNo?: string;
  missionDate?: string;
  purpose?: string;
  fromDate?: string;
  toDate?: string;
  departureDate?: string;
  signerName?: string;
  signerTitle?: string;
  signerUnitName?: string;
  signerPositionTitle?: string;
  documentSnapshotJson?: string;
  signedAt?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  itinerary: TravelOrderItineraryStopDto[];
}

export interface CreateSingleTravelOrderRequestDto {
  tripId?: number;
  purpose?: string;
  personId?: string;
  personCode?: string;
  fullName: string;
  displayNameWithRank?: string;
  rankId?: string;
  rankCode?: string;
  rankName?: string;
  positionTitle?: string;
  rankTitle?: string;
  unitName: string;
  unitCode?: string;
  missionNo?: string;
  missionDate?: string;
  fromDate?: string;
  toDate?: string;
  departureDate?: string;
  signerName?: string;
  signerTitle?: string;
  signerUnitName?: string;
  signedAt?: string;
  itinerary?: TravelOrderItineraryStopDto[];
}

export interface UpdateTravelOrderRequestDto {
  personId?: string;
  personCode?: string;
  fullName: string;
  displayNameWithRank?: string;
  rankId?: string;
  rankCode?: string;
  rankName?: string;
  positionTitle?: string;
  rankTitle?: string;
  unitName: string;
  unitCode?: string;
  missionNo?: string;
  missionDate?: string;
  fromDate?: string;
  toDate?: string;
  departureDate?: string;
  signerName?: string;
  signerTitle?: string;
  signerUnitName?: string;
  signedAt?: string;
  status?: string;
  itinerary?: TravelOrderItineraryStopDto[];
}

// Update Request DTOs
export interface UpdateTravelOrderOverrideRequest {
  missionNoOverride?: string;
  missionDateOverride?: string;
  fromDateOverride?: string;
  toDateOverride?: string;
  departureDateOverride?: string;
  stopOverrides: UpdateTravelOrderStopOverrideDto[];
}

export interface UpdateTravelOrderStopOverrideDto {
  stopIndex: number;
  fromLocationOverride?: string;
  fromDateTimeOverride?: string;
  toLocationOverride?: string;
  toDateTimeOverride?: string;
  transportOverride?: string;
}

export interface ChangeTripStatusRequest {
  status: string; // "DRAFT", "PRINTED", "ISSUED", "SIGNED", "CLOSED", "CANCELLED"
  signerName?: string;
  signerTitle?: string;
  signerUnitName?: string;
  actualEndDateTime?: string;
  cancellationReason?: string;
}

// Response DTO
export interface CreateTravelTripResponse {
  tripId: number;
}

// Preview Model (for rendering document)
export interface TravelOrderPreviewModel {
  orderNo: string;
  tripNo?: string;
  fullName: string;
  displayNameWithRank?: string;
  rankId?: string;
  rankCode?: string;
  rankName?: string;
  positionTitle?: string;
  rankTitle?: string;
  unitName: string;
  missionNo?: string;
  missionDate?: string;
  purpose?: string;
  fromDate?: string;
  toDate?: string;
  departureDate?: string;
  signerName?: string;
  signerTitle?: string;
  signerUnitName?: string;
  stops: PreviewStopModel[];
}

export interface PreviewStopModel {
  stopIndex: number;
  fromLocation: string;
  fromDateTime?: string;
  toLocation?: string;
  toDateTime?: string;
  transport?: string;
}

// Constants
export const TripStatuses = {
  DRAFT: 'DRAFT',
  PRINTED: 'PRINTED',
  ISSUED: 'ISSUED',
  SIGNED: 'SIGNED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
  DELETED: 'DELETED',
};
