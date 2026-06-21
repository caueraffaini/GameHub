// src/modules/matches/ports/inbound/ISubmitScoreUseCase.ts

export interface SubmitScoreDto {
  matchId: string;
  player1Score: number;
  player2Score: number;
}

export const ISubmitScoreUseCaseToken = Symbol('ISubmitScoreUseCase');

export interface ISubmitScoreUseCase {
  execute(dto: SubmitScoreDto): Promise<void>;
}
