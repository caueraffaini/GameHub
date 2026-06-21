// src/modules/moderation/domain/models/MatchDispute.ts

export type DisputeStatus = 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

export class MatchDispute {
  id: string;
  matchId: string;
  raisedById: string;
  reason: string;
  status: DisputeStatus;
  resolvedAt: Date | null;
  resolvedById: string | null;
  resolutionNotes: string | null;

  constructor(init?: Partial<MatchDispute>) {
    Object.assign(this, init);
  }
}
