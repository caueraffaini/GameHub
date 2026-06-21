// src/modules/tournaments/adapters/persistence/TournamentMatchSlot.entity.ts

import { Entity, PrimaryColumn, Column } from 'typeorm';
import { TournamentMatchSlot } from '../../domain/models/TournamentMatchSlot';

@Entity('tournament_match_slots')
export class TournamentMatchSlotEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'tournament_id', type: 'uuid' })
  tournamentId: string;

  @Column({ name: 'round_number', type: 'int' })
  roundNumber: number;

  @Column({ name: 'match_id', type: 'uuid', nullable: true })
  matchId: string | null;

  @Column({ name: 'parent_slot_id', type: 'uuid', nullable: true })
  parentSlotId: string | null;

  static toEntity(model: TournamentMatchSlot): TournamentMatchSlotEntity {
    const entity = new TournamentMatchSlotEntity();
    entity.id = model.id;
    entity.tournamentId = model.tournamentId;
    entity.roundNumber = model.roundNumber;
    entity.matchId = model.matchId;
    entity.parentSlotId = model.parentSlotId;
    return entity;
  }

  toModel(): TournamentMatchSlot {
    return new TournamentMatchSlot({
      id: this.id,
      tournamentId: this.tournamentId,
      roundNumber: this.roundNumber,
      matchId: this.matchId,
      parentSlotId: this.parentSlotId,
    });
  }
}
