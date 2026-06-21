// src/modules/matches/adapters/transport/MatchesController.ts

import { Controller, Post, Body, Param, Inject, UseGuards } from '@nestjs/common';
import { ISubmitScoreUseCase, ISubmitScoreUseCaseToken, SubmitScoreDto } from '../../ports/inbound/ISubmitScoreUseCase';
import { JwtAuthGuard } from '../../../identity/adapters/transport/guards/JwtAuthGuard';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(
    @Inject(ISubmitScoreUseCaseToken)
    private readonly submitScoreUseCase: ISubmitScoreUseCase,
  ) {}

  @Post(':id/score')
  async submitScore(
    @Param('id') id: string,
    @Body() body: Omit<SubmitScoreDto, 'matchId'>,
  ) {
    await this.submitScoreUseCase.execute({
      matchId: id,
      player1Score: body.player1Score,
      player2Score: body.player2Score,
    });
    return { success: true };
  }
}
