import { PlayAreaReservation } from '../../domain/models/PlayAreaReservation';

export const IPlayAreaReservationRepositoryPortToken = Symbol('IPlayAreaReservationRepositoryPort');

export interface IPlayAreaReservationRepositoryPort {
  findById(id: string): Promise<PlayAreaReservation | null>;
  save(reservation: PlayAreaReservation): Promise<PlayAreaReservation>;
  findOverlappingReservations(playAreaId: string, startTime: Date, endTime: Date): Promise<PlayAreaReservation[]>;
  findActiveReservationsForUser(userId: string): Promise<PlayAreaReservation[]>;
}
