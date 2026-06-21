// src/modules/tournaments/domain/models/TournamentMatchSlot.ts

export class TournamentMatchSlot {
  id: string;
  tournamentId: string;
  roundNumber: number;
  matchId: string | null;
  parentSlotId: string | null;

  constructor(init?: Partial<TournamentMatchSlot>) {
    Object.assign(this, init);
  }
}
