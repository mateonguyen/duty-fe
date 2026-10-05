export type SectionState = 'ready' | 'unavailable' | 'error';
export interface DailyCount { date: string; count: number; }
export interface TravelStatusCount { code: string; name: string; count: number; }
export interface HomeAssignment {
  rosterId: number; date: string; staffName: string; unitName: string;
  shiftName: string; timeRange: string; locationName: string; status: string;
}
export interface HomeOverviewDto {
  updatedAt: string; today: string; timeZone: string; period: string; scopeCode: string; scopeName: string;
  scopes: { code: string; name: string }[];
  capabilities: { canCreateRoster: boolean; canCreateTravel: boolean; canManageDirectory: boolean; canManageAccess: boolean };
  roster: {
    state: SectionState; todayCount: number; activeRosterCount: number; myShiftCount: number; myPendingSwapCount: number;
    chartStart: string; chartEnd: string; dailyCounts: DailyCount[];
    todayAssignments: HomeAssignment[]; upcomingAssignments: HomeAssignment[]; upcomingCount: number;
  };
  travel: { state: SectionState; totalCount: number; unfinishedCount: number; statusCounts: TravelStatusCount[] };
  introduction: { state: SectionState; totalCount: number };
  directory: { state: SectionState; organizationCount: number; personnelCount: number; requiresSetup: boolean } | null;
}
