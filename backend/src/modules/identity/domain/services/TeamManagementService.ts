import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ITeamManagementUseCase, CreateOfficialTeamDto, CreateTemporaryTeamDto } from '../../ports/inbound/ITeamManagementUseCase';
import { ITeamRepositoryPort, ITeamRepositoryPortToken } from '../../ports/outbound/ITeamRepositoryPort';
import { IUserRepositoryPort, IUserRepositoryPortToken } from '../../ports/outbound/IUserRepositoryPort';
import { OfficialTeam, TemporaryEventTeam, TeamRoster } from '../models/Team';

@Injectable()
export class TeamManagementService implements ITeamManagementUseCase {
  constructor(
    @Inject(ITeamRepositoryPortToken)
    private readonly teamRepo: ITeamRepositoryPort,
    @Inject(IUserRepositoryPortToken)
    private readonly userRepo: IUserRepositoryPort,
  ) {}

  async createOfficialTeam(dto: CreateOfficialTeamDto): Promise<OfficialTeam> {
    const captain = await this.userRepo.findById(dto.captainId);
    if (!captain) {
      throw new NotFoundException('Captain user not found');
    }

    const team = new OfficialTeam({
      id: crypto.randomUUID(),
      name: dto.name,
      captainId: dto.captainId,
      createdAt: new Date(),
      instituteId: dto.instituteId,
      isActiveCompetitionTeam: true,
    });

    const saved = await this.teamRepo.saveOfficial(team);

    // Auto-add captain to roster
    await this.addPlayerToRoster(saved.id, dto.captainId);

    return saved;
  }

  async createTemporaryTeam(dto: CreateTemporaryTeamDto): Promise<TemporaryEventTeam> {
    const captain = await this.userRepo.findById(dto.captainId);
    if (!captain) {
      throw new NotFoundException('Captain user not found');
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + dto.durationHours);

    const team = new TemporaryEventTeam({
      id: crypto.randomUUID(),
      name: dto.name,
      captainId: dto.captainId,
      createdAt: new Date(),
      associatedEventId: dto.associatedEventId,
      expiresAt,
    });

    const saved = await this.teamRepo.saveTemporary(team);

    // Auto-add captain to roster
    await this.addPlayerToRoster(saved.id, dto.captainId);

    return saved;
  }

  async addPlayerToRoster(teamId: string, userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const officialTeam = await this.teamRepo.findOfficialById(teamId);
    const tempTeam = await this.teamRepo.findTemporaryById(teamId);
    if (!officialTeam && !tempTeam) {
      throw new NotFoundException('Team not found');
    }

    const existingRoster = await this.teamRepo.findRoster(teamId, userId);
    if (existingRoster && existingRoster.status === 'ACTIVE') {
      throw new BadRequestException('Player already active in this team');
    }

    const roster = new TeamRoster({
      teamId,
      userId,
      joinedAt: new Date(),
      status: 'ACTIVE',
      seedNumber: 0,
    });

    await this.teamRepo.saveRoster(roster);
  }

  async removePlayerFromRoster(teamId: string, userId: string): Promise<void> {
    const officialTeam = await this.teamRepo.findOfficialById(teamId);
    const tempTeam = await this.teamRepo.findTemporaryById(teamId);
    const team = officialTeam || tempTeam;
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.captainId === userId) {
      throw new BadRequestException('Cannot remove the team captain from roster');
    }

    const existingRoster = await this.teamRepo.findRoster(teamId, userId);
    if (!existingRoster) {
      throw new NotFoundException('Player not in team roster');
    }

    await this.teamRepo.deleteRoster(teamId, userId);
  }
}
