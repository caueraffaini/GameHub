// src/modules/tournaments/adapters/persistence/EventScore.entity.ts

import { Entity, PrimaryColumn, Column } from 'typeorm';
import { EventScore } from '../../domain/models/EventScore';

@Entity('event_scores')
export class EventScoreEntity {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'score_value', type: 'int', default: 0 })
  scoreValue: number;

  @Column({ name: 'last_updated_at', default: () => 'CURRENT_TIMESTAMP' })
  lastUpdatedAt: Date;

  static toEntity(model: EventScore): EventScoreEntity {
    const entity = new EventScoreEntity();
    entity.eventId = model.eventId;
    entity.userId = model.userId;
    entity.scoreValue = model.scoreValue;
    entity.lastUpdatedAt = model.lastUpdatedAt;
    return entity;
  }

  toModel(): EventScore {
    return new EventScore({
      eventId: this.eventId,
      userId: this.userId,
      scoreValue: this.scoreValue,
      lastUpdatedAt: this.lastUpdatedAt,
    });
  }
}
