export type RosterStatus = 'ACTIVE' | 'INVITATION_PENDING' | 'REMOVED';

export abstract class Team {
  id: string;
  name: string;
  captainId: string;
  createdAt: Date;

  constructor(init?: Partial<Team>) {
    Object.assign(this, init);
  }
}

export class OfficialTeam extends Team {
  instituteId: string;
  isActiveCompetitionTeam: boolean;

  constructor(init?: Partial<OfficialTeam>) {
    super(init);
    Object.assign(this, init);
  }
}

export class TemporaryEventTeam extends Team {
  associatedEventId: string;
  expiresAt: Date;

  constructor(init?: Partial<TemporaryEventTeam>) {
    super(init);
    Object.assign(this, init);
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }
}

export class TeamRoster {
  teamId: string;
  userId: string;
  joinedAt: Date;
  status: RosterStatus;
  seedNumber: number;

  constructor(init?: Partial<TeamRoster>) {
    Object.assign(this, init);
  }
}
