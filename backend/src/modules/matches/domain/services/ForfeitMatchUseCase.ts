// src/modules/matches/domain/services/ForfeitMatchUseCase.ts

import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IForfeitMatchUseCase, ForfeitMatchDto } from '../../ports/inbound/IForfeitMatchUseCase';
import { IMatchRepositoryPort, IMatchRepositoryPortToken } from '../../ports/outbound/IMatchRepositoryPort';
import { IUserRepositoryPort, IUserRepositoryPortToken } from '../../../identity/ports/outbound/IUserRepositoryPort';
import { EventBus } from '../../../../shared/events/EventBus';
import { MatchFinalizedEvent } from '../events/MatchFinalizedEvent';

@Injectable()
export class ForfeitMatchUseCase implements IForfeitMatchUseCase {
  constructor(
    @Inject(IMatchRepositoryPortToken)
    private readonly matchRepo: IMatchRepositoryPort,
    @Inject(IUserRepositoryPortToken)
    private readonly userRepo: IUserRepositoryPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(dto: ForfeitMatchDto): Promise<void> {
    const match = await this.matchRepo.findById(dto.matchId);
    if (!match) {
      throw new NotFoundException(`Match ${dto.matchId} not found`);
    }

    if (match.status === 'COMPLETED' || match.status === 'CANCELLED') {
      return;
    }

    const maxScore = ['TRUCO', 'BURACO'].includes(match.gameType) ? 2 : 11;

    match.status = 'COMPLETED';
    match.endedAt = new Date();
    match.forfeitedUserId = dto.forfeitingUserId;

    if (match.player1Id === dto.forfeitingUserId) {
      match.player1Score = 0;
      match.player2Score = maxScore;
      match.winnerId = match.player2Id;
    } else {
      match.player2Score = 0;
      match.player1Score = maxScore;
      match.winnerId = match.player1Id;
    }

    await this.matchRepo.save(match);

    // Set non-forfeiting user back to AVAILABLE
    const otherUserId = match.player1Id === dto.forfeitingUserId ? match.player2Id : match.player1Id;
    if (otherUserId) {
      await this.userRepo.updateStatus(otherUserId, 'AVAILABLE');
    }

    // Publish event
    if (match.player1Id && match.player2Id && match.winnerId) {
      this.eventBus.publish(
        new MatchFinalizedEvent(
          match.id,
          match.gameType,
          match.player1Id,
          match.player2Id,
          match.player1Score,
          match.player2Score,
          match.winnerId,
          dto.forfeitingUserId,
        ),
      );
    }
  }
}
