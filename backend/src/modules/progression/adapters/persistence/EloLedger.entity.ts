// src/modules/progression/adapters/persistence/EloLedger.entity.ts

import { Entity, PrimaryColumn, Column } from 'typeorm';
import { EloLedger } from '../../domain/models/EloLedger';

@Entity('elo_ledger')
export class EloLedgerEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @Column({ name: 'match_id', type: 'uuid' })
  matchId: string;

  @Column({ name: 'season_id', type: 'uuid' })
  seasonId: string;

  @Column({ name: 'old_rating', type: 'int' })
  oldRating: number;

  @Column({ name: 'new_rating', type: 'int' })
  newRating: number;

  @Column({ name: 'change_amount', type: 'int' })
  changeAmount: number;

  @Column({ name: 'calculated_at', default: () => 'CURRENT_TIMESTAMP' })
  calculatedAt: Date;

  @Column({ default: 'COMPLETED' })
  status: string;

  static toEntity(model: EloLedger): EloLedgerEntity {
    const entity = new EloLedgerEntity();
    entity.id = model.id;
    entity.userId = model.userId;
    entity.teamId = model.teamId;
    entity.matchId = model.matchId;
    entity.seasonId = model.seasonId;
    entity.oldRating = model.oldRating;
    entity.newRating = model.newRating;
    entity.changeAmount = model.changeAmount;
    if (model.calculatedAt) {
      entity.calculatedAt = model.calculatedAt;
    }
    entity.status = model.status || 'COMPLETED';
    return entity;
  }

  toModel(): EloLedger {
    return new EloLedger({
      id: this.id,
      userId: this.userId,
      teamId: this.teamId,
      matchId: this.matchId,
      seasonId: this.seasonId,
      oldRating: this.oldRating,
      newRating: this.newRating,
      changeAmount: this.changeAmount,
      calculatedAt: this.calculatedAt,
      status: this.status,
    });
  }
}
