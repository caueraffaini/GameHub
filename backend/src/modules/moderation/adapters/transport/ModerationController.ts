// src/modules/moderation/adapters/transport/ModerationController.ts

import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ModerationService } from '../../domain/services/ModerationService';
import { JwtAuthGuard } from '../../../identity/adapters/transport/guards/JwtAuthGuard';
import { SanctionType } from '../../domain/models/UserSanction';
import { FriendshipStatus } from '../../domain/models/Friendship';

@Controller('moderation')
@UseGuards(JwtAuthGuard)
export class ModerationController {
  constructor(
    private readonly moderationService: ModerationService,
  ) {}

  @Post('disputes')
  async createDispute(
    @Body() body: { matchId: string; reason: string; raisedById: string },
  ) {
    const dispute = await this.moderationService.createDispute(
      body.matchId,
      body.reason,
      body.raisedById,
    );
    return { success: true, dispute };
  }

  @Post('disputes/:id/resolve')
  async resolveDispute(
    @Param('id') id: string,
    @Body() body: { resolvedById: string; resolutionNotes: string; correctWinnerId?: string },
  ) {
    const dispute = await this.moderationService.resolveDispute(
      id,
      body.resolvedById,
      body.resolutionNotes,
      body.correctWinnerId,
    );
    return { success: true, dispute };
  }

  @Post('reports')
  async createReport(
    @Body() body: { reportedByUserId: string; targetUserId: string; reason: string; details: string },
  ) {
    const report = await this.moderationService.createReport(
      body.reportedByUserId,
      body.targetUserId,
      body.reason,
      body.details,
    );
    return { success: true, report };
  }

  @Post('sanctions')
  async createSanction(
    @Body() body: { userId: string; type: SanctionType; reason: string; durationSeconds: number; createdById?: string },
  ) {
    const sanction = await this.moderationService.createSanction(
      body.userId,
      body.type,
      body.reason,
      body.durationSeconds,
      body.createdById || null,
    );
    return { success: true, sanction };
  }

  @Post('friendships')
  async createFriendship(
    @Body() body: { userId1: string; userId2: string; status: FriendshipStatus },
  ) {
    const friendship = await this.moderationService.createFriendship(
      body.userId1,
      body.userId2,
      body.status,
    );
    return { success: true, friendship };
  }
}
