// src/modules/tournaments/domain/models/EventScore.ts

export class EventScore {
  eventId: string;
  userId: string;
  scoreValue: number;
  lastUpdatedAt: Date;

  constructor(init?: Partial<EventScore>) {
    Object.assign(this, init);
  }
}
