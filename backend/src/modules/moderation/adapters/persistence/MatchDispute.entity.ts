// src/modules/moderation/adapters/persistence/MatchDispute.entity.ts

import { Entity, PrimaryColumn, Column } from 'typeorm';
import { MatchDispute, DisputeStatus } from '../../domain/models/MatchDispute';

@Entity('match_disputes')
export class MatchDisputeEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'match_id', type: 'uuid' })
  matchId: string;

  @Column({ name: 'raised_by_id', type: 'uuid' })
  raisedById: string;

  @Column('text')
  reason: string;

  @Column()
  status: DisputeStatus;

  @Column({ name: 'resolved_at', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by_id', type: 'uuid', nullable: true })
  resolvedById: string | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  static toEntity(model: MatchDispute): MatchDisputeEntity {
    const entity = new MatchDisputeEntity();
    entity.id = model.id;
    entity.matchId = model.matchId;
    entity.raisedById = model.raisedById;
    entity.reason = model.reason;
    entity.status = model.status;
    entity.resolvedAt = model.resolvedAt;
    entity.resolvedById = model.resolvedById;
    entity.resolutionNotes = model.resolutionNotes;
    return entity;
  }

  toModel(): MatchDispute {
    return new MatchDispute({
      id: this.id,
      matchId: this.matchId,
      raisedById: this.raisedById,
      reason: this.reason,
      status: this.status,
      resolvedAt: this.resolvedAt,
      resolvedById: this.resolvedById,
      resolutionNotes: this.resolutionNotes,
    });
  }
}
