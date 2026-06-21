// src/modules/progression/domain/models/EloLedger.ts

export class EloLedger {
  id: string;
  userId: string;
  teamId: string | null;
  matchId: string;
  seasonId: string;
  oldRating: number;
  newRating: number;
  changeAmount: number;
  calculatedAt: Date;
  status: string;

  constructor(init?: Partial<EloLedger>) {
    Object.assign(this, init);
  }
}
