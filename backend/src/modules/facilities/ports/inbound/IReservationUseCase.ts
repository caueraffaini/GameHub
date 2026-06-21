import { PlayAreaReservation } from '../../domain/models/PlayAreaReservation';
import { GameType } from '../../domain/models/PlayArea';

export const IReservationUseCaseToken = Symbol('IReservationUseCase');

export interface IReservationUseCase {
  reserve(
    playAreaId: string,
    userId: string,
    gameType: GameType,
    startTime: Date,
    endTime: Date,
    expectedVersion?: number,
  ): Promise<PlayAreaReservation>;

  activate(reservationId: string): Promise<void>;

  complete(reservationId: string): Promise<void>;

  cancel(reservationId: string): Promise<void>;
}
