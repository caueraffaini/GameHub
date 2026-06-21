// src/modules/matchmaking/adapters/persistence/TicketRepository.ts

import { Repository, DataSource } from 'typeorm';
import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import Redis from 'ioredis';

import { ITicketRepositoryPort } from '../../ports/outbound/ITicketRepositoryPort';
import { MatchmakingTicket } from '../../domain/models/MatchmakingTicket';
import { MatchmakingTicketEntity } from './MatchmakingTicket.entity';
import { REDIS_CLIENT } from '../redis/RedisModule';
import { UserEntity } from '../../../identity/adapters/persistence/User.entity';

@Injectable()
export class TicketRepository implements ITicketRepositoryPort {
  constructor(
    @InjectRepository(MatchmakingTicketEntity)
    private readonly repo: Repository<MatchmakingTicketEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async findById(id: string): Promise<MatchmakingTicket | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? entity.toModel() : null;
  }

  async save(ticket: MatchmakingTicket): Promise<MatchmakingTicket> {
    const existing = await this.repo.findOneBy({ id: ticket.id });
    const user = await this.dataSource.getRepository(UserEntity).findOneBy({ id: ticket.userId });
    if (!user) {
      throw new Error('User not found');
    }
    const instituteId = user.instituteId;

    if (ticket.status === 'WAITING') {
      if (!existing) {
        // Atomic Duplicate Ticket Guard
        const lockKey = `gamehub:ticket_lock:${ticket.userId}:${ticket.gameType}`;
        const acquired = await this.redis.set(lockKey, ticket.id, 'EX', 600, 'NX');
        if (!acquired) {
          throw new ConflictException('Duplicate ticket detected');
        }
      }

      const entity = MatchmakingTicketEntity.toEntity(ticket);
      const saved = await this.repo.save(entity);

      // Campus-isolated queue push to ZSET
      const queueKey = `gamehub:queue:${instituteId}:${ticket.gameType}`;
      const score = new Date(ticket.joinedAt).getTime();
      await this.redis.zadd(queueKey, score, ticket.id);

      return saved.toModel();
    } else {
      const entity = MatchmakingTicketEntity.toEntity(ticket);
      const saved = await this.repo.save(entity);

      // Clean up queue and lock
      const queueKey = `gamehub:queue:${instituteId}:${ticket.gameType}`;
      await this.redis.zrem(queueKey, ticket.id);

      const lockKey = `gamehub:ticket_lock:${ticket.userId}:${ticket.gameType}`;
      const currentLockVal = await this.redis.get(lockKey);
      if (currentLockVal === ticket.id) {
        await this.redis.del(lockKey);
      }

      return saved.toModel();
    }
  }

  async cancelActiveByUser(userId: string): Promise<void> {
    const active = await this.repo.find({
      where: {
        userId,
        status: 'WAITING',
      },
    });
    const user = await this.dataSource.getRepository(UserEntity).findOneBy({ id: userId });
    for (const ticket of active) {
      ticket.status = 'CANCELLED';
      await this.repo.save(ticket);

      if (user) {
        const queueKey = `gamehub:queue:${user.instituteId}:${ticket.gameType}`;
        await this.redis.zrem(queueKey, ticket.id);
      }

      const lockKey = `gamehub:ticket_lock:${userId}:${ticket.gameType}`;
      await this.redis.del(lockKey);
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

  async requeueWithPriority(ticketId: string): Promise<void> {
    const ticketEntity = await this.repo.findOneBy({ id: ticketId });
    if (!ticketEntity) return;

    const user = await this.dataSource.getRepository(UserEntity).findOneBy({ id: ticketEntity.userId });
    if (!user) return;

    const queueKey = `gamehub:queue:${user.instituteId}:${ticketEntity.gameType}`;
    // absolute front priority (score = 0)
    await this.redis.zadd(queueKey, 0, ticketId);
  }

  async getActiveTicketIds(instituteId: string, gameType: string): Promise<string[]> {
    const key = `gamehub:queue:${instituteId}:${gameType}`;
    return await this.redis.zrange(key, 0, -1);
  }
}
