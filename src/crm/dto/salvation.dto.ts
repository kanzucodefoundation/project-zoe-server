import { SalvationRecord } from "../entities/salvation.entity";

export class CreateSalvationRecordDto {
  fullName: string;
  phoneNumber: string;
  email?: string;
  address: string;
  dateOfSalvation: Date;
  serviceOrEvent: string;
}

export interface SalvationRecordWithMatches extends SalvationRecord {
  matchingRecords?: string[];
}
