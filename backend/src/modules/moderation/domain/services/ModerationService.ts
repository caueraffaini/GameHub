// src/modules/moderation/domain/services/ModerationService.ts

import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';

import { MatchDispute } from '../models/MatchDispute';
import { MatchDisputeEntity } from '../../adapters/persistence/MatchDispute.entity';
import { GenericReport } from '../models/GenericReport';
import { GenericReportEntity } from '../../adapters/persistence/GenericReport.entity';
import { UserSanction, SanctionType } from '../models/UserSanction';
import { UserSanctionEntity } from '../../adapters/persistence/UserSanction.entity';
import { Friendship, FriendshipStatus } from '../models/Friendship';
import { FriendshipEntity } from '../../adapters/persistence/Friendship.entity';

import { EloLedgerEntity } from '../../../progression/adapters/persistence/EloLedger.entity';
import { PlayerRankingEntity } from '../../../progression/adapters/persistence/PlayerRanking.entity';
import { MatchEntity } from '../../../matches/adapters/persistence/Match.entity';
import { EloRatingService } from '../../../progression/domain/services/EloRatingService';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(MatchDisputeEntity)
    private readonly disputeRepo: Repository<MatchDisputeEntity>,
    @InjectRepository(GenericReportEntity)
    private readonly reportRepo: Repository<GenericReportEntity>,
    @InjectRepository(UserSanctionEntity)
    private readonly sanctionRepo: Repository<UserSanctionEntity>,
    @InjectRepository(FriendshipEntity)
    private readonly friendshipRepo: Repository<FriendshipEntity>,
    @InjectQueue('sanction-cascade')
    private readonly sanctionQueue: Queue,
    private readonly eloRatingService: EloRatingService,
  ) {}

  async createDispute(matchId: string, reason: string, raisedById: string): Promise<MatchDispute> {
    return await this.dataSource.transaction('SERIALIZABLE', async (entityManager) => {
      // 1. Find and transition associated ELO ledger records to LOCKED status
      const ledgers = await entityManager.find(EloLedgerEntity, { where: { matchId } });
      for (const ledger of ledgers) {
        ledger.status = 'LOCKED';
        await entityManager.save(EloLedgerEntity, ledger);
      }

      // 2. Create the dispute entry
      const dispute = new MatchDispute({
        id: randomUUID(),
        matchId,
        raisedById,
        reason,
        status: 'UNDER_REVIEW',
        resolvedAt: null,
        resolvedById: null,
        resolutionNotes: null,
      });
      const saved = await entityManager.save(MatchDisputeEntity, MatchDisputeEntity.toEntity(dispute));

      // 3. Fire admin alert
      this.logger.error(`[ADMIN ALERT] Match dispute raised for match ${matchId}. ELO updates locked.`);

      return saved.toModel();
    });
  }

  async resolveDispute(
    disputeId: string,
    resolvedById: string,
    resolutionNotes: string,
    correctWinnerId?: string,
  ): Promise<MatchDispute> {
    return await this.dataSource.transaction('SERIALIZABLE', async (entityManager) => {
      const disputeEntity = await entityManager.findOne(MatchDisputeEntity, { where: { id: disputeId } });
      if (!disputeEntity) {
        throw new Error('Dispute not found');
      }
      if (disputeEntity.status !== 'UNDER_REVIEW') {
        throw new Error('Dispute is already resolved');
      }

      const matchId = disputeEntity.matchId;
      const match = await entityManager.findOne(MatchEntity, { where: { id: matchId } });
      const ledgers = await entityManager.find(EloLedgerEntity, { where: { matchId } });

      if (correctWinnerId && match && ledgers.length === 2) {
        const player1Id = match.player1Id;
        const player2Id = match.player2Id;

        const ledger1 = ledgers.find((l) => l.userId === player1Id);
        const ledger2 = ledgers.find((l) => l.userId === player2Id);

        if (ledger1 && ledger2 && player1Id && player2Id) {
          const originalChange1 = ledger1.changeAmount;
          const originalChange2 = ledger2.changeAmount;

          // Recalculate ELO based on original rating before the match
          const winnerSide = correctWinnerId === player1Id ? 'A' : 'B';
          const outcome = this.eloRatingService.calculate(
            { rating: ledger1.oldRating },
            { rating: ledger2.oldRating },
            { winner: winnerSide },
          );

          // Update ELO ledger entries with corrected new values
          ledger1.newRating = ledger1.oldRating + outcome.playerADelta;
          ledger1.changeAmount = outcome.playerADelta;
          ledger1.status = 'COMPLETED';

          ledger2.newRating = ledger2.oldRating + outcome.playerBDelta;
          ledger2.changeAmount = outcome.playerBDelta;
          ledger2.status = 'COMPLETED';

          await entityManager.save(EloLedgerEntity, ledger1);
          await entityManager.save(EloLedgerEntity, ledger2);

          // Structurally correct Player Ranking entries
          const ranking1 = await entityManager.findOne(PlayerRankingEntity, {
            where: { userId: player1Id, seasonId: ledger1.seasonId },
          });
          if (ranking1) {
            ranking1.eloValue = ranking1.eloValue - originalChange1 + outcome.playerADelta;
            await entityManager.save(PlayerRankingEntity, ranking1);
          }

          const ranking2 = await entityManager.findOne(PlayerRankingEntity, {
            where: { userId: player2Id, seasonId: ledger2.seasonId },
          });
          if (ranking2) {
            ranking2.eloValue = ranking2.eloValue - originalChange2 + outcome.playerBDelta;
            await entityManager.save(PlayerRankingEntity, ranking2);
          }

          // Update Match winner
          match.winnerId = correctWinnerId;
          await entityManager.save(MatchEntity, match);
        }
      } else {
        // Unlock ledger updates by returning status to COMPLETED
        for (const ledger of ledgers) {
          ledger.status = 'COMPLETED';
          await entityManager.save(EloLedgerEntity, ledger);
        }
      }

      // Complete dispute resolution
      disputeEntity.status = 'RESOLVED';
      disputeEntity.resolvedAt = new Date();
      disputeEntity.resolvedById = resolvedById;
      disputeEntity.resolutionNotes = resolutionNotes;
      const saved = await entityManager.save(MatchDisputeEntity, disputeEntity);

      return saved.toModel();
    });
  }

  async createReport(reportedByUserId: string, targetUserId: string, reason: string, details: string): Promise<GenericReport> {
    const report = new GenericReport({
      id: randomUUID(),
      reportedByUserId,
      targetUserId,
      reason,
      details,
      reportedAt: new Date(),
      status: 'OPEN',
    });
    const saved = await this.reportRepo.save(GenericReportEntity.toEntity(report));
    return saved.toModel();
  }

  async createSanction(userId: string, type: SanctionType, reason: string, durationSeconds: number, createdById: string | null): Promise<UserSanction> {
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + durationSeconds * 1000);
    const sanction = new UserSanction({
      id: randomUUID(),
      userId,
      type,
      reason,
      startedAt,
      expiresAt,
      isActive: true,
      createdById,
    });
    const saved = await this.sanctionRepo.save(UserSanctionEntity.toEntity(sanction));

    // If TEMP_BAN or PERMANENT_BAN, enqueue BullMQ worker job
    if (type === 'TEMP_BAN' || type === 'PERMANENT_BAN') {
      await this.sanctionQueue.add('enforce-ban', { userId });
    }

    return saved.toModel();
  }

  async checkActiveSanction(userId: string): Promise<UserSanction | null> {
    const now = new Date();
    const active = await this.sanctionRepo.findOne({
      where: {
        userId,
        isActive: true,
      },
    });

    if (active && active.expiresAt.getTime() > now.getTime()) {
      return active.toModel();
    }

    if (active) {
      // Clean up expired sanction
      active.isActive = false;
      await this.sanctionRepo.save(active);
    }

    return null;
  }

  async createFriendship(userId1: string, userId2: string, status: FriendshipStatus): Promise<Friendship> {
    const establishedAt = new Date();
    const friendship = new Friendship({
      userId1,
      userId2,
      establishedAt,
      status,
    });
    const saved = await this.friendshipRepo.save(FriendshipEntity.toEntity(friendship));
    return saved.toModel();
  }

  async checkFriendshipBlock(userA: string, userB: string): Promise<boolean> {
    const block = await this.friendshipRepo.findOne({
      where: [
        { userId1: userA, userId2: userB, status: 'BLOCKED' },
        { userId1: userB, userId2: userA, status: 'BLOCKED' },
      ],
    });
    return !!block;
  }
}
