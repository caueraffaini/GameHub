// src/modules/moderation/moderation.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { FriendshipEntity } from './adapters/persistence/Friendship.entity';
import { ChatChannelEntity } from './adapters/persistence/ChatChannel.entity';
import { ChatMessageEntity } from './adapters/persistence/ChatMessage.entity';
import { MatchDisputeEntity } from './adapters/persistence/MatchDispute.entity';
import { GenericReportEntity } from './adapters/persistence/GenericReport.entity';
import { UserSanctionEntity } from './adapters/persistence/UserSanction.entity';

import { ModerationService } from './domain/services/ModerationService';
import { ModerationController } from './adapters/transport/ModerationController';
import { ChatGateway } from './adapters/transport/ChatGateway';
import { SanctionCascadeProcessor } from './adapters/workers/SanctionCascadeProcessor';

import { IdentityModule } from '../identity/identity.module';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';
import { FacilitiesModule } from '../facilities/facilities.module';
import { ProgressionModule } from '../progression/progression.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FriendshipEntity,
      ChatChannelEntity,
      ChatMessageEntity,
      MatchDisputeEntity,
      GenericReportEntity,
      UserSanctionEntity,
    ]),
    BullModule.registerQueue({
      name: 'sanction-cascade',
    }),
    IdentityModule,
    MatchmakingModule,
    FacilitiesModule,
    ProgressionModule,
  ],
  controllers: [
    ModerationController,
  ],
  providers: [
    ModerationService,
    ChatGateway,
    SanctionCascadeProcessor,
  ],
  exports: [
    ModerationService,
    ChatGateway,
    SanctionCascadeProcessor,
  ],
})
export class ModerationModule {}
