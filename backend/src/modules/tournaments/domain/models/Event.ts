// src/modules/tournaments/domain/models/Event.ts

export type EventStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED';

export class Event {
  id: string;
  name: string;
  creatorId: string;
  description: string;
  startTime: Date;
  endTime: Date;
  status: EventStatus;

  constructor(init?: Partial<Event>) {
    Object.assign(this, init);
  }
}
