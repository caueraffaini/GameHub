// src/modules/tournaments/domain/models/Tournament.ts

export type TournamentFormat = 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN';
export type TournamentStatus = 'REGISTRATION' | 'ACTIVE' | 'CONCLUDED';

export class Tournament {
  id: string;
  name: string;
  gameId: string; // Mapped to gameId in Section 2.4
  format: TournamentFormat;
  registrationStartTime: Date;
  registrationEndTime: Date;
  status: TournamentStatus;

  constructor(init?: Partial<Tournament>) {
    Object.assign(this, init);
  }
}
