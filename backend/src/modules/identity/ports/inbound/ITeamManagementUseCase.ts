import { OfficialTeam, TemporaryEventTeam } from '../../domain/models/Team';

export interface CreateOfficialTeamDto {
  name: string;
  captainId: string;
  instituteId: string;
}

export interface CreateTemporaryTeamDto {
  name: string;
  captainId: string;
  associatedEventId: string;
  durationHours: number;
}

export interface ITeamManagementUseCase {
  createOfficialTeam(dto: CreateOfficialTeamDto): Promise<OfficialTeam>;
  createTemporaryTeam(dto: CreateTemporaryTeamDto): Promise<TemporaryEventTeam>;
  addPlayerToRoster(teamId: string, userId: string): Promise<void>;
  removePlayerFromRoster(teamId: string, userId: string): Promise<void>;
}

export const ITeamManagementUseCaseToken = Symbol('ITeamManagementUseCase');
