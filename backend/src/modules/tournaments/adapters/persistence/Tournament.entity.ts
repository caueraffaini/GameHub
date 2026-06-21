// src/modules/tournaments/adapters/persistence/Tournament.entity.ts

import { Entity, PrimaryColumn, Column } from 'typeorm';
import { Tournament, TournamentFormat, TournamentStatus } from '../../domain/models/Tournament';

@Entity('tournaments')
export class TournamentEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'game_id', type: 'uuid', nullable: true })
  gameId: string | null;

  @Column()
  format: TournamentFormat;

  @Column({ name: 'registration_start_time' })
  registrationStartTime: Date;

  @Column({ name: 'registration_end_time' })
  registrationEndTime: Date;

  @Column()
  status: TournamentStatus;

  static toEntity(model: Tournament): TournamentEntity {
    const entity = new TournamentEntity();
    entity.id = model.id;
    entity.name = model.name;
    entity.gameId = model.gameId;
    entity.format = model.format;
    entity.registrationStartTime = model.registrationStartTime;
    entity.registrationEndTime = model.registrationEndTime;
    entity.status = model.status;
    return entity;
  }

  toModel(): Tournament {
    return new Tournament({
      id: this.id,
      name: this.name,
      gameId: this.gameId || undefined,
      format: this.format,
      registrationStartTime: this.registrationStartTime,
      registrationEndTime: this.registrationEndTime,
      status: this.status,
    });
  }
}
