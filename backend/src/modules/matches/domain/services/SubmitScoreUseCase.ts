// src/modules/matches/domain/services/SubmitScoreUseCase.ts

import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { ISubmitScoreUseCase, SubmitScoreDto } from '../../ports/inbound/ISubmitScoreUseCase';
import { IMatchRepositoryPort, IMatchRepositoryPortToken } from '../../ports/outbound/IMatchRepositoryPort';
import { IUserRepositoryPort, IUserRepositoryPortToken } from '../../../identity/ports/outbound/IUserRepositoryPort';
import { EventBus } from '../../../../shared/events/EventBus';
import { MatchFinalizedEvent } from '../events/MatchFinalizedEvent';

@Injectable()
export class SubmitScoreUseCase implements ISubmitScoreUseCase {
  constructor(
    @Inject(IMatchRepositoryPortToken)
    private readonly matchRepo: IMatchRepositoryPort,
    @Inject(IUserRepositoryPortToken)
    private readonly userRepo: IUserRepositoryPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(dto: SubmitScoreDto): Promise<void> {
    const match = await this.matchRepo.findById(dto.matchId);
    if (!match) {
      throw new NotFoundException(`Match with ID ${dto.matchId} not found`);
    }

    if (match.status === 'COMPLETED' || match.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot submit score for a match that is already ${match.status}`);
    }

    this.validateScores(match.gameType, dto.player1Score, dto.player2Score);

    match.player1Score = dto.player1Score;
    match.player2Score = dto.player2Score;
    match.winnerId = dto.player1Score > dto.player2Score ? match.player1Id : match.player2Id;
    match.status = 'COMPLETED';
    match.endedAt = new Date();

    await this.matchRepo.save(match);

    // Set players back to AVAILABLE
    if (match.player1Id) {
      await this.userRepo.updateStatus(match.player1Id, 'AVAILABLE');
    }
    if (match.player2Id) {
      await this.userRepo.updateStatus(match.player2Id, 'AVAILABLE');
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
          null,
        ),
      );
    }
  }

  private validateScores(gameType: string, score1: number, score2: number): void {
    if (score1 < 0 || score2 < 0) {
      throw new BadRequestException('Scores must be non-negative integers');
    }
    if (score1 === score2) {
      throw new BadRequestException('Matches cannot end in a draw');
    }

    if (gameType === 'PINGPONG') {
      if (score1 < 11 && score2 < 11) {
        throw new BadRequestException('Pingpong games require at least 11 points');
      }
      const max = Math.max(score1, score2);
      const min = Math.min(score1, score2);
      if (max > 11 && (max - min) !== 2) {
        throw new BadRequestException('Pingpong winner must win by exactly 2 points if score exceeds 11');
      }
      if (max === 11 && min > 9) {
        throw new BadRequestException('Pingpong winner must win by at least 2 points');
      }
    } else if (gameType === 'PEBOLIM') {
      if (score1 < 5 && score2 < 5) {
        throw new BadRequestException('Pebolim games require at least 5 points');
      }
    } else if (gameType === 'TRUCO') {
      if (score1 < 12 && score2 < 12) {
        throw new BadRequestException('Truco games require at least 12 points');
      }
    }
  }
}
