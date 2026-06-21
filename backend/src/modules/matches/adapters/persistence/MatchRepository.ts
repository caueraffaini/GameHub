// src/modules/matches/adapters/persistence/MatchRepository.ts

import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IMatchRepositoryPort } from '../../ports/outbound/IMatchRepositoryPort';
import { Match } from '../../domain/models/Match';
import { MatchEntity } from './Match.entity';

@Injectable()
export class MatchRepository implements IMatchRepositoryPort {
  constructor(
    @InjectRepository(MatchEntity)
    private readonly repo: Repository<MatchEntity>,
  ) {}

  async findById(id: string): Promise<Match | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? entity.toModel() : null;
  }

  async save(match: Match): Promise<Match> {
    const entity = MatchEntity.toEntity(match);
    const saved = await this.repo.save(entity);
    return saved.toModel();
  }

  async findActiveByUser(userId: string): Promise<Match | null> {
    const entity = await this.repo.findOne({
      where: [
        { player1Id: userId, status: 'IN_PROGRESS' },
        { player2Id: userId, status: 'IN_PROGRESS' },
        { player1Id: userId, status: 'PENDING_RESOURCE_ALLOCATION' },
        { player2Id: userId, status: 'PENDING_RESOURCE_ALLOCATION' },
      ],
    });
    return entity ? entity.toModel() : null;
  }
}
