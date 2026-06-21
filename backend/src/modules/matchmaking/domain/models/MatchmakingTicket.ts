// src/modules/matchmaking/domain/models/MatchmakingTicket.ts

import { GameType } from '../../../facilities/domain/models/PlayArea';

export type TicketStatus = 'WAITING' | 'MATCHED' | 'CANCELLED' | 'EXPIRED';

export class MatchmakingTicket {
  id: string;
  userId: string;
  teamId: string | null;
  eloRating: number;
  gameType: GameType;
  joinedAt: Date;
  expiryTime: Date;
  status: TicketStatus;

  constructor(init?: Partial<MatchmakingTicket>) {
    Object.assign(this, init);
  }

  isExpired(currentTime: Date = new Date()): boolean {
    return currentTime.getTime() >= new Date(this.expiryTime).getTime();
  }
}
