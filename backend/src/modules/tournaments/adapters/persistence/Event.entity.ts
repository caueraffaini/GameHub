// src/modules/tournaments/adapters/persistence/Event.entity.ts

import { Entity, PrimaryColumn, Column } from 'typeorm';
import { Event, EventStatus } from '../../domain/models/Event';

@Entity('events')
export class EventEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'creator_id', type: 'uuid', nullable: true })
  creatorId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'start_time' })
  startTime: Date;

  @Column({ name: 'end_time' })
  endTime: Date;

  @Column()
  status: EventStatus;

  static toEntity(model: Event): EventEntity {
    const entity = new EventEntity();
    entity.id = model.id;
    entity.name = model.name;
    entity.creatorId = model.creatorId;
    entity.description = model.description;
    entity.startTime = model.startTime;
    entity.endTime = model.endTime;
    entity.status = model.status;
    return entity;
  }

  toModel(): Event {
    return new Event({
      id: this.id,
      name: this.name,
      creatorId: this.creatorId || undefined,
      description: this.description || undefined,
      startTime: this.startTime,
      endTime: this.endTime,
      status: this.status,
    });
  }
}
