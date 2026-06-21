// src/modules/matchmaking/domain/models/Match.ts

import { GameType } from '../../../facilities/domain/models/PlayArea';

export type MatchStatus = 
  | 'PENDING_RESOURCE_ALLOCATION' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'DISPUTED' 
  | 'CANCELLED';

export class Match {
  id: string;
  playAreaReservationId: string | null; // Optional/nullable for virtual card games which bypass physical reservations
  gameType: GameType;
  status: MatchStatus;
  startedAt: Date;
  endedAt: Date | null;

  constructor(init?: Partial<Match>) {
    Object.assign(this, init);
  }
}
