// src/modules/matches/adapters/persistence/Match.entity.ts

import { Entity, PrimaryColumn, Column } from 'typeorm';
import { Match, MatchStatus } from '../../domain/models/Match';
import { GameType } from '../../../facilities/domain/models/PlayArea';

@Entity('matches')
export class MatchEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'play_area_reservation_id', type: 'uuid', nullable: true })
  playAreaReservationId: string | null;

  @Column({ name: 'player1_id', type: 'uuid', nullable: true })
  player1Id: string | null;

  @Column({ name: 'player2_id', type: 'uuid', nullable: true })
  player2Id: string | null;

  @Column({ name: 'player1_score', type: 'int', nullable: true })
  player1Score: number | null;

  @Column({ name: 'player2_score', type: 'int', nullable: true })
  player2Score: number | null;

  @Column({ name: 'winner_id', type: 'uuid', nullable: true })
  winnerId: string | null;

  @Column({ name: 'forfeited_user_id', type: 'uuid', nullable: true })
  forfeitedUserId: string | null;

  @Column({ name: 'game_type' })
  gameType: GameType;

  @Column()
  status: MatchStatus;

  @Column({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'ended_at', nullable: true })
  endedAt: Date | null;

  static toEntity(model: Match): MatchEntity {
    const entity = new MatchEntity();
    entity.id = model.id;
    entity.playAreaReservationId = model.playAreaReservationId;
    entity.player1Id = model.player1Id;
    entity.player2Id = model.player2Id;
    entity.player1Score = model.player1Score;
    entity.player2Score = model.player2Score;
    entity.winnerId = model.winnerId;
    entity.forfeitedUserId = model.forfeitedUserId;
    entity.gameType = model.gameType;
    entity.status = model.status;
    entity.startedAt = model.startedAt;
    entity.endedAt = model.endedAt;
    return entity;
  }

  toModel(): Match {
    return new Match({
      id: this.id,
      playAreaReservationId: this.playAreaReservationId,
      player1Id: this.player1Id,
      player2Id: this.player2Id,
      player1Score: this.player1Score,
      player2Score: this.player2Score,
      winnerId: this.winnerId,
      forfeitedUserId: this.forfeitedUserId,
      gameType: this.gameType,
      status: this.status,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
    });
  }
}
