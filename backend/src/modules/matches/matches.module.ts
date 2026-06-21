// src/modules/matches/matches.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchEntity } from './adapters/persistence/Match.entity';
import { MatchRepository } from './adapters/persistence/MatchRepository';
import { SubmitScoreUseCase } from './domain/services/SubmitScoreUseCase';
import { ForfeitMatchUseCase } from './domain/services/ForfeitMatchUseCase';
import { MatchesController } from './adapters/transport/MatchesController';
import { IdentityModule } from '../identity/identity.module';
import { EventModule } from '../../shared/events/EventModule';

import { IMatchRepositoryPortToken } from './ports/outbound/IMatchRepositoryPort';
import { ISubmitScoreUseCaseToken } from './ports/inbound/ISubmitScoreUseCase';
import { IForfeitMatchUseCaseToken } from './ports/inbound/IForfeitMatchUseCase';

@Module({
  imports: [
    TypeOrmModule.forFeature([MatchEntity]),
    IdentityModule,
    EventModule,
  ],
  controllers: [MatchesController],
  providers: [
    {
      provide: IMatchRepositoryPortToken,
      useClass: MatchRepository,
    },
    {
      provide: ISubmitScoreUseCaseToken,
      useClass: SubmitScoreUseCase,
    },
    {
      provide: IForfeitMatchUseCaseToken,
      useClass: ForfeitMatchUseCase,
    },
  ],
  exports: [
    IMatchRepositoryPortToken,
    ISubmitScoreUseCaseToken,
    IForfeitMatchUseCaseToken,
  ],
})
export class MatchesModule {}
