import { OfficialTeam, TemporaryEventTeam, TeamRoster } from '../../domain/models/Team';

export interface ITeamRepositoryPort {
  saveOfficial(team: OfficialTeam): Promise<OfficialTeam>;
  saveTemporary(team: TemporaryEventTeam): Promise<TemporaryEventTeam>;
  findOfficialById(id: string): Promise<OfficialTeam | null>;
  findTemporaryById(id: string): Promise<TemporaryEventTeam | null>;
  saveRoster(roster: TeamRoster): Promise<TeamRoster>;
  findRoster(teamId: string, userId: string): Promise<TeamRoster | null>;
  deleteRoster(teamId: string, userId: string): Promise<void>;
}

export const ITeamRepositoryPortToken = Symbol('ITeamRepositoryPort');
