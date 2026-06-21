import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ITeamRepositoryPort } from '../../ports/outbound/ITeamRepositoryPort';
import { OfficialTeam, TemporaryEventTeam, TeamRoster } from '../../domain/models/Team';
import { TeamEntity } from './Team.entity';
import { TeamRosterEntity } from './TeamRoster.entity';

@Injectable()
export class TeamRepository implements ITeamRepositoryPort {
  constructor(
    @InjectRepository(TeamEntity)
    private readonly teamRepo: Repository<TeamEntity>,
    @InjectRepository(TeamRosterEntity)
    private readonly rosterRepo: Repository<TeamRosterEntity>,
  ) {}

  async saveOfficial(team: OfficialTeam): Promise<OfficialTeam> {
    const entity = TeamEntity.toEntity(team);
    const saved = await this.teamRepo.save(entity);
    return saved.toModel() as OfficialTeam;
  }

  async saveTemporary(team: TemporaryEventTeam): Promise<TemporaryEventTeam> {
    const entity = TeamEntity.toEntity(team);
    const saved = await this.teamRepo.save(entity);
    return saved.toModel() as TemporaryEventTeam;
  }

  async findOfficialById(id: string): Promise<OfficialTeam | null> {
    const entity = await this.teamRepo.findOneBy({ id, type: 'OFFICIAL' });
    return entity ? (entity.toModel() as OfficialTeam) : null;
  }

  async findTemporaryById(id: string): Promise<TemporaryEventTeam | null> {
    const entity = await this.teamRepo.findOneBy({ id, type: 'TEMPORARY' });
    return entity ? (entity.toModel() as TemporaryEventTeam) : null;
  }

  async saveRoster(roster: TeamRoster): Promise<TeamRoster> {
    const entity = TeamRosterEntity.toEntity(roster);
    const saved = await this.rosterRepo.save(entity);
    return saved.toModel();
  }

  async findRoster(teamId: string, userId: string): Promise<TeamRoster | null> {
    const entity = await this.rosterRepo.findOneBy({ teamId, userId });
    return entity ? entity.toModel() : null;
  }

  async deleteRoster(teamId: string, userId: string): Promise<void> {
    await this.rosterRepo.delete({ teamId, userId });
  }
}
