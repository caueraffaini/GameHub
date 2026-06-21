// src/modules/tournaments/domain/models/GroupStanding.ts

export class GroupStanding {
  tournamentId: string;
  teamId: string;
  points: number;
  matchesWon: number;
  matchesLost: number;
  scoreDifferential: number;

  constructor(init?: Partial<GroupStanding>) {
    Object.assign(this, init);
  }
}
