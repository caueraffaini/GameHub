// src/modules/matchmaking/matchmaking.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { MatchmakingTicketEntity } from './adapters/persistence/MatchmakingTicket.entity';
import { DeviceTokenEntity } from './adapters/persistence/DeviceToken.entity';
import { TicketRepository } from './adapters/persistence/TicketRepository';
import { DeviceTokenRepository } from './adapters/persistence/DeviceTokenRepository';
import { ConsoleNotificationAdapter } from './adapters/notification/ConsoleNotificationAdapter';
import { HeartbeatTimeoutProcessor } from './adapters/workers/HeartbeatTimeoutProcessor';
import { HeartbeatKeyspaceSubscriber } from './adapters/redis/HeartbeatKeyspaceSubscriber';
import { MatchGateway } from './adapters/transport/MatchGateway';
import { RedisModule } from './adapters/redis/RedisModule';
import { FacilitiesModule } from '../facilities/facilities.module';
import { IdentityModule } from '../identity/identity.module';
import { MatchesModule } from '../matches/matches.module';

import { ITicketRepositoryPortToken } from './ports/outbound/ITicketRepositoryPort';
import { IDeviceTokenRepositoryPortToken } from './ports/outbound/IDeviceTokenRepositoryPort';
import { INotificationServicePortToken } from './ports/outbound/INotificationServicePort';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MatchmakingTicketEntity,
      DeviceTokenEntity,
    ]),
    BullModule.registerQueue({
      name: 'heartbeat-timeout-handler',
    }),
    RedisModule,
    FacilitiesModule,
    IdentityModule,
    MatchesModule,
  ],
  providers: [
    {
      provide: ITicketRepositoryPortToken,
      useClass: TicketRepository,
    },
    {
      provide: IDeviceTokenRepositoryPortToken,
      useClass: DeviceTokenRepository,
    },
    {
      provide: INotificationServicePortToken,
      useClass: ConsoleNotificationAdapter,
    },
    HeartbeatKeyspaceSubscriber,
    HeartbeatTimeoutProcessor,
    MatchGateway,
  ],
  exports: [
    ITicketRepositoryPortToken,
    IDeviceTokenRepositoryPortToken,
    INotificationServicePortToken,
    MatchesModule,
    MatchGateway,
  ],
})
export class MatchmakingModule {}
