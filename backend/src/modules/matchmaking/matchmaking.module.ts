// src/modules/matchmaking/matchmaking.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { MatchEntity } from './adapters/persistence/Match.entity';
import { MatchmakingTicketEntity } from './adapters/persistence/MatchmakingTicket.entity';
import { DeviceTokenEntity } from './adapters/persistence/DeviceToken.entity';
import { TicketRepository } from './adapters/persistence/TicketRepository';
import { MatchRepository } from './adapters/persistence/MatchRepository';
import { DeviceTokenRepository } from './adapters/persistence/DeviceTokenRepository';
import { ConsoleNotificationAdapter } from './adapters/notification/ConsoleNotificationAdapter';
import { ForfeitMatchUseCase } from './domain/services/ForfeitMatchUseCase';
import { HeartbeatTimeoutProcessor } from './adapters/workers/HeartbeatTimeoutProcessor';
import { HeartbeatKeyspaceSubscriber } from './adapters/redis/HeartbeatKeyspaceSubscriber';
import { MatchGateway } from './adapters/transport/MatchGateway';
import { RedisModule } from './adapters/redis/RedisModule';
import { FacilitiesModule } from '../facilities/facilities.module';
import { IdentityModule } from '../identity/identity.module';

import { ITicketRepositoryPortToken } from './ports/outbound/ITicketRepositoryPort';
import { IMatchRepositoryPortToken } from './ports/outbound/IMatchRepositoryPort';
import { IDeviceTokenRepositoryPortToken } from './ports/outbound/IDeviceTokenRepositoryPort';
import { INotificationServicePortToken } from './ports/outbound/INotificationServicePort';
import { IForfeitMatchUseCaseToken } from './ports/inbound/IForfeitMatchUseCase';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MatchEntity,
      MatchmakingTicketEntity,
      DeviceTokenEntity,
    ]),
    BullModule.registerQueue({
      name: 'heartbeat-timeout-handler',
    }),
    RedisModule,
    FacilitiesModule,
    IdentityModule,
  ],
  providers: [
    {
      provide: ITicketRepositoryPortToken,
      useClass: TicketRepository,
    },
    {
      provide: IMatchRepositoryPortToken,
      useClass: MatchRepository,
    },
    {
      provide: IDeviceTokenRepositoryPortToken,
      useClass: DeviceTokenRepository,
    },
    {
      provide: INotificationServicePortToken,
      useClass: ConsoleNotificationAdapter,
    },
    {
      provide: IForfeitMatchUseCaseToken,
      useClass: ForfeitMatchUseCase,
    },
    HeartbeatKeyspaceSubscriber,
    HeartbeatTimeoutProcessor,
    MatchGateway,
  ],
  exports: [
    ITicketRepositoryPortToken,
    IMatchRepositoryPortToken,
    IDeviceTokenRepositoryPortToken,
    INotificationServicePortToken,
    IForfeitMatchUseCaseToken,
    MatchGateway,
  ],
})
export class MatchmakingModule {}
