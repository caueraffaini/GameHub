// src/modules/matches/ports/inbound/IForfeitMatchUseCase.ts

export interface ForfeitMatchDto {
  matchId: string;
  forfeitingUserId: string;
}

export const IForfeitMatchUseCaseToken = Symbol('IForfeitMatchUseCase');

export interface IForfeitMatchUseCase {
  execute(dto: ForfeitMatchDto): Promise<void>;
}
