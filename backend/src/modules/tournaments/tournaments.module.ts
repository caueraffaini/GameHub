// src/modules/tournaments/tournaments.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { EventEntity } from './adapters/persistence/Event.entity';
import { EventScoreEntity } from './adapters/persistence/EventScore.entity';
import { TournamentEntity } from './adapters/persistence/Tournament.entity';
import { TournamentMatchSlotEntity } from './adapters/persistence/TournamentMatchSlot.entity';
import { GroupStandingEntity } from './adapters/persistence/GroupStanding.entity';
import { BracketEngine } from './domain/services/BracketEngine';
import { MatchFinalizedListener } from './adapters/listeners/MatchFinalizedListener';
import { TournamentStandingsProcessor } from './adapters/workers/TournamentStandingsProcessor';
import { TournamentsController } from './adapters/transport/TournamentsController';
import { EventModule } from '../../shared/events/EventModule';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventEntity,
      EventScoreEntity,
      TournamentEntity,
      TournamentMatchSlotEntity,
      GroupStandingEntity,
    ]),
    BullModule.registerQueue({
      name: 'tournament-updates',
    }),
    EventModule,
  ],
  controllers: [TournamentsController],
  providers: [
    BracketEngine,
    MatchFinalizedListener,
    TournamentStandingsProcessor,
  ],
  exports: [
    BracketEngine,
  ],
})
export class TournamentsModule {}
