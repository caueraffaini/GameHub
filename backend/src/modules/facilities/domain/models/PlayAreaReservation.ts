import { GameType } from './PlayArea';

export type ReservationStatus = 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export class PlayAreaReservation {
  id: string;
  playAreaId: string;
  userId: string;
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  bufferPaddingMinutes: number;
  status: ReservationStatus;
  gameType: GameType;
  version: number;

  constructor(init?: Partial<PlayAreaReservation>) {
    Object.assign(this, init);
    if (this.bufferPaddingMinutes === undefined) {
      this.bufferPaddingMinutes = 15;
    }
    if (this.version === undefined) {
      this.version = 1;
    }
  }

  // State transitions
  confirm(): void {
    if (this.status !== 'CONFIRMED') {
      throw new Error(`Cannot confirm reservation in status: ${this.status}`);
    }
  }

  activate(): void {
    if (this.status !== 'CONFIRMED') {
      throw new Error(`Cannot activate reservation from status: ${this.status}`);
    }
    this.status = 'ACTIVE';
  }

  complete(): void {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot complete reservation from status: ${this.status}`);
    }
    this.status = 'COMPLETED';
  }

  cancel(): void {
    if (this.status === 'COMPLETED') {
      throw new Error('Cannot cancel a completed reservation');
    }
    this.status = 'CANCELLED';
  }
}
