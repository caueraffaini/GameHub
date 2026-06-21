// src/modules/progression/domain/models/PlayerRanking.ts

import { GameType } from '../../../facilities/domain/models/PlayArea';

export class PlayerRanking {
  id: string;
  seasonId: string;
  userId: string;
  teamId: string | null;
  gameType: GameType;
  eloValue: number;
  gamesPlayed: number;
  lastMatchAt: Date | null;

  constructor(init?: Partial<PlayerRanking>) {
    Object.assign(this, init);
  }
}
