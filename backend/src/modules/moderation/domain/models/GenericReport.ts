// src/modules/moderation/domain/models/GenericReport.ts

export type ReportStatus = 'OPEN' | 'INVESTIGATING' | 'CLOSED';

export class GenericReport {
  id: string;
  reportedByUserId: string;
  targetUserId: string;
  reason: string;
  details: string;
  reportedAt: Date;
  status: ReportStatus;

  constructor(init?: Partial<GenericReport>) {
    Object.assign(this, init);
  }
}
