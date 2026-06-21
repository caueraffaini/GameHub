// src/modules/matches/domain/events/MatchFinalizedEvent.ts

import { GameType } from '../../../facilities/domain/models/PlayArea';

export class MatchFinalizedEvent {
  constructor(
    public readonly matchId: string,
    public readonly gameType: GameType,
    public readonly player1Id: string,
    public readonly player2Id: string,
    public readonly player1Score: number,
    public readonly player2Score: number,
    public readonly winnerId: string,
    public readonly forfeitedUserId: string | null = null,
  ) {}
}
