export interface DutyLocationReadDto {
  id: number;
  code: string;
  name: string;
  active: boolean;
}

export interface DutyLocationWriteDto {
  code: string;
  name: string;
  active: boolean;
}
