// src/modules/progression/adapters/listeners/MatchFinalizedListener.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Subscription, from } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { EventBus } from '../../../../shared/events/EventBus';
import { MatchFinalizedEvent } from '../../../matches/domain/events/MatchFinalizedEvent';
import { EloRatingService } from '../../domain/services/EloRatingService';
import { SeasonEntity } from '../persistence/Season.entity';
import { PlayerRankingEntity } from '../persistence/PlayerRanking.entity';
import { EloLedgerEntity } from '../persistence/EloLedger.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class MatchFinalizedListener implements OnModuleInit, OnModuleDestroy {
  private subscription: Subscription;

  constructor(
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBus,
    private readonly eloRatingService: EloRatingService,
  ) {}

  onModuleInit() {
    this.subscription = this.eventBus
      .get$()
      .pipe(
        concatMap((event) => {
          if (event instanceof MatchFinalizedEvent) {
            return from(
              this.handleMatchFinalized(event).catch((err) => {
                console.error('Error handling MatchFinalizedEvent:', err);
              }),
            );
          }
          return from(Promise.resolve());
        }),
      )
      .subscribe();
  }

  onModuleDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  async handleMatchFinalized(event: MatchFinalizedEvent): Promise<void> {
    await this.dataSource.transaction('SERIALIZABLE', async (entityManager) => {
      // 1. Get or create active season
      let activeSeason = await entityManager.findOne(SeasonEntity, {
        where: { isActive: true },
      });

      if (!activeSeason) {
        activeSeason = new SeasonEntity();
        activeSeason.id = randomUUID();
        activeSeason.name = 'Default Season';
        activeSeason.startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        activeSeason.endTime = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        activeSeason.isActive = true;
        await entityManager.save(SeasonEntity, activeSeason);
      }

      // 2. Get or create player rankings
      let ranking1 = await entityManager.findOne(PlayerRankingEntity, {
        where: { seasonId: activeSeason.id, userId: event.player1Id, gameType: event.gameType },
      });
      if (!ranking1) {
        ranking1 = new PlayerRankingEntity();
        ranking1.id = randomUUID();
        ranking1.seasonId = activeSeason.id;
        ranking1.userId = event.player1Id;
        ranking1.teamId = null;
        ranking1.gameType = event.gameType;
        ranking1.eloValue = 1500;
        ranking1.gamesPlayed = 0;
        ranking1.lastMatchAt = null;
        await entityManager.save(PlayerRankingEntity, ranking1);
      }

      let ranking2 = await entityManager.findOne(PlayerRankingEntity, {
        where: { seasonId: activeSeason.id, userId: event.player2Id, gameType: event.gameType },
      });
      if (!ranking2) {
        ranking2 = new PlayerRankingEntity();
        ranking2.id = randomUUID();
        ranking2.seasonId = activeSeason.id;
        ranking2.userId = event.player2Id;
        ranking2.teamId = null;
        ranking2.gameType = event.gameType;
        ranking2.eloValue = 1500;
        ranking2.gamesPlayed = 0;
        ranking2.lastMatchAt = null;
        await entityManager.save(PlayerRankingEntity, ranking2);
      }

      // 3. Calculate ELO changes
      const winnerSide = event.winnerId === event.player1Id ? 'A' : 'B';
      const outcome = this.eloRatingService.calculate(
        { rating: ranking1.eloValue },
        { rating: ranking2.eloValue },
        { winner: winnerSide },
      );

      const oldRating1 = ranking1.eloValue;
      const oldRating2 = ranking2.eloValue;

      const newRating1 = oldRating1 + outcome.playerADelta;
      const newRating2 = oldRating2 + outcome.playerBDelta;

      // 4. Update rankings
      ranking1.eloValue = newRating1;
      ranking1.gamesPlayed += 1;
      ranking1.lastMatchAt = new Date();
      await entityManager.save(PlayerRankingEntity, ranking1);

      ranking2.eloValue = newRating2;
      ranking2.gamesPlayed += 1;
      ranking2.lastMatchAt = new Date();
      await entityManager.save(PlayerRankingEntity, ranking2);

      // 5. Append immutable EloLedger entries
      const ledger1 = new EloLedgerEntity();
      ledger1.id = randomUUID();
      ledger1.userId = event.player1Id;
      ledger1.teamId = null;
      ledger1.matchId = event.matchId;
      ledger1.seasonId = activeSeason.id;
      ledger1.oldRating = oldRating1;
      ledger1.newRating = newRating1;
      ledger1.changeAmount = outcome.playerADelta;
      ledger1.calculatedAt = new Date();
      await entityManager.save(EloLedgerEntity, ledger1);

      const ledger2 = new EloLedgerEntity();
      ledger2.id = randomUUID();
      ledger2.userId = event.player2Id;
      ledger2.teamId = null;
      ledger2.matchId = event.matchId;
      ledger2.seasonId = activeSeason.id;
      ledger2.oldRating = oldRating2;
      ledger2.newRating = newRating2;
      ledger2.changeAmount = outcome.playerBDelta;
      ledger2.calculatedAt = new Date();
      await entityManager.save(EloLedgerEntity, ledger2);
    });
  }
}
