// src/modules/matchmaking/domain/services/MatchmakingService.ts

import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';

import { MatchmakingTicket } from '../models/MatchmakingTicket';
import { GameType } from '../../../facilities/domain/models/PlayArea';
import { ITicketRepositoryPort, ITicketRepositoryPortToken } from '../../ports/outbound/ITicketRepositoryPort';
import { IReservationUseCase, IReservationUseCaseToken } from '../../../facilities/ports/inbound/IReservationUseCase';
import { OptimisticLockException } from '../../../facilities/domain/exceptions/OptimisticLockException';
import { MatchEntity } from '../../../matches/adapters/persistence/Match.entity';

@Injectable()
export class MatchmakingService {
  constructor(
    @Inject(ITicketRepositoryPortToken)
    private readonly ticketRepo: ITicketRepositoryPort,
    @Inject(IReservationUseCaseToken)
    private readonly reservationUseCase: IReservationUseCase,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async createTicket(userId: string, gameType: GameType): Promise<MatchmakingTicket> {
    const ticket = new MatchmakingTicket({
      id: randomUUID(),
      userId,
      teamId: null,
      eloRating: 1500,
      gameType,
      joinedAt: new Date(),
      expiryTime: new Date(Date.now() + 30 * 60 * 1000), // 30 mins
      status: 'WAITING',
    });

    // save() handles lock acquisition & ZSET queue natively
    return await this.ticketRepo.save(ticket);
  }

  async matchmakePair(
    ticketAId: string,
    ticketBId: string,
    playAreaId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<void> {
    const ticketA = await this.ticketRepo.findById(ticketAId);
    const ticketB = await this.ticketRepo.findById(ticketBId);

    if (!ticketA || !ticketB) {
      throw new Error('Matchmaking tickets not found');
    }

    // Matched but Homeless recovery transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      // 1. Attempt PlayArea reservation
      // Under OCC, version check might trigger OptimisticLockException
      await this.reservationUseCase.reserve(
        playAreaId,
        ticketA.userId,
        ticketA.gameType,
        startTime,
        endTime,
      );

      // 2. Create Match Entity
      const match = new MatchEntity();
      match.id = randomUUID();
      match.playAreaReservationId = null; // or link reservation id
      match.player1Id = ticketA.userId;
      match.player2Id = ticketB.userId;
      match.status = 'IN_PROGRESS';
      match.gameType = ticketA.gameType;
      match.startedAt = new Date();

      await queryRunner.manager.save(MatchEntity, match);

      // 3. Mark tickets as MATCHED
      ticketA.status = 'MATCHED';
      ticketB.status = 'MATCHED';
      await this.ticketRepo.save(ticketA);
      await this.ticketRepo.save(ticketB);

      await queryRunner.commitTransaction();
    } catch (err: any) {
      // OCC Lock Collision propagates here
      await queryRunner.rollbackTransaction();

      if (err instanceof OptimisticLockException) {
        // Recovery Loop: re-enqueue both tickets to the front of ZSET queue with score 0
        await this.ticketRepo.requeueWithPriority(ticketAId);
        await this.ticketRepo.requeueWithPriority(ticketBId);
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
