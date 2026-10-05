export type DirectoryKind = 'organizations' | 'personnel' | 'positions' | 'ranks';
export interface DirectoryOrganization { id: string; code: string; name: string; parentId: string | null; shortName?: string; active: boolean; }
export interface DirectoryClassification { code: string; name: string; active: boolean; level?: number | null; order?: number | null; }
export interface DirectoryPerson { username: string; fullName: string; orgCode: string; positionCode?: string | null; rankCode?: string | null; active: boolean; phone?: string | null; email?: string | null; }
export interface DirectoryCatalog {
  mode: 'Local' | 'OracleSync'; organizations: DirectoryOrganization[]; personnel: DirectoryPerson[];
  positions: DirectoryClassification[]; ranks: DirectoryClassification[]; total: number; personnelTotal?: number; page: number;
}
export interface DirectoryDraft {
  code: string; name: string; parentId: string | null; shortName: string; username: string; fullName: string;
  orgCode: string; positionCode: string | null; rankCode: string | null; active: boolean;
  phone: string; email: string; level: number | null; order: number | null;
}
