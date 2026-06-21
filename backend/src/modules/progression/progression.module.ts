// src/modules/progression/progression.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeasonEntity } from './adapters/persistence/Season.entity';
import { PlayerRankingEntity } from './adapters/persistence/PlayerRanking.entity';
import { EloLedgerEntity } from './adapters/persistence/EloLedger.entity';
import { EloRatingService } from './domain/services/EloRatingService';
import { MatchFinalizedListener } from './adapters/listeners/MatchFinalizedListener';
import { EventModule } from '../../shared/events/EventModule';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SeasonEntity,
      PlayerRankingEntity,
      EloLedgerEntity,
    ]),
    EventModule,
  ],
  providers: [
    EloRatingService,
    MatchFinalizedListener,
  ],
  exports: [
    EloRatingService,
  ],
})
export class ProgressionModule {}
