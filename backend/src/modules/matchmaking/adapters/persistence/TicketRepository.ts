import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ITicketRepositoryPort } from '../../ports/outbound/ITicketRepositoryPort';
import { MatchmakingTicket } from '../../domain/models/MatchmakingTicket';
import { MatchmakingTicketEntity } from './MatchmakingTicket.entity';

@Injectable()
export class TicketRepository implements ITicketRepositoryPort {
  constructor(
    @InjectRepository(MatchmakingTicketEntity)
    private readonly repo: Repository<MatchmakingTicketEntity>,
  ) {}

  async findById(id: string): Promise<MatchmakingTicket | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? entity.toModel() : null;
  }

  async save(ticket: MatchmakingTicket): Promise<MatchmakingTicket> {
    const entity = MatchmakingTicketEntity.toEntity(ticket);
    const saved = await this.repo.save(entity);
    return saved.toModel();
  }

  async cancelActiveByUser(userId: string): Promise<void> {
    const active = await this.repo.find({
      where: {
        userId,
        status: 'WAITING',
      },
    });
    for (const ticket of active) {
      ticket.status = 'CANCELLED';
      await this.repo.save(ticket);
    }
  }

  async findActiveByUser(userId: string): Promise<MatchmakingTicket | null> {
    const entity = await this.repo.findOne({
      where: {
        userId,
        status: 'WAITING',
      },
    });
    return entity ? entity.toModel() : null;
  }
}
