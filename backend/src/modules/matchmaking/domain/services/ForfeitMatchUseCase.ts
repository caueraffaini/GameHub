// src/modules/matchmaking/domain/services/ForfeitMatchUseCase.ts

import { Injectable, Inject } from '@nestjs/common';
import { IForfeitMatchUseCase, ForfeitMatchDto } from '../../ports/inbound/IForfeitMatchUseCase';
import { IMatchRepositoryPort, IMatchRepositoryPortToken } from '../../ports/outbound/IMatchRepositoryPort';
import { IUserRepositoryPort, IUserRepositoryPortToken } from '../../../identity/ports/outbound/IUserRepositoryPort';

@Injectable()
export class ForfeitMatchUseCase implements IForfeitMatchUseCase {
  constructor(
    @Inject(IMatchRepositoryPortToken)
    private readonly matchRepo: IMatchRepositoryPort,
    @Inject(IUserRepositoryPortToken)
    private readonly userRepo: IUserRepositoryPort,
  ) {}

  async execute(dto: ForfeitMatchDto): Promise<void> {
    const match = await this.matchRepo.findById(dto.matchId);
    if (!match) return;

    match.status = 'COMPLETED';
    match.endedAt = new Date();
    await this.matchRepo.save(match);

    const otherUserId = match.player1Id === dto.forfeitingUserId ? match.player2Id : match.player1Id;
    if (otherUserId) {
      await this.userRepo.updateStatus(otherUserId, 'AVAILABLE');
    }
  }
}
