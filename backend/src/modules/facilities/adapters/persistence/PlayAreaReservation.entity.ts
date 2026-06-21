import { Entity, PrimaryColumn, Column, VersionColumn } from 'typeorm';
import { PlayAreaReservation, ReservationStatus } from '../../domain/models/PlayAreaReservation';
import { GameType } from '../../domain/models/PlayArea';

@Entity('play_area_reservations')
export class PlayAreaReservationEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'play_area_id', type: 'uuid' })
  playAreaId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'scheduled_start_time' })
  scheduledStartTime: Date;

  @Column({ name: 'scheduled_end_time' })
  scheduledEndTime: Date;

  @Column({ name: 'buffer_padding_minutes', default: 15 })
  bufferPaddingMinutes: number;

  @Column()
  status: ReservationStatus;

  @Column({ name: 'game_type' })
  gameType: GameType;

  @VersionColumn({ default: 1 })
  version: number;

  static toEntity(model: PlayAreaReservation): PlayAreaReservationEntity {
    const entity = new PlayAreaReservationEntity();
    entity.id = model.id;
    entity.playAreaId = model.playAreaId;
    entity.userId = model.userId;
    entity.scheduledStartTime = model.scheduledStartTime;
    entity.scheduledEndTime = model.scheduledEndTime;
    entity.bufferPaddingMinutes = model.bufferPaddingMinutes;
    entity.status = model.status;
    entity.gameType = model.gameType;
    if (model.version !== undefined) {
      entity.version = model.version;
    }
    return entity;
  }

  toModel(): PlayAreaReservation {
    return new PlayAreaReservation({
      id: this.id,
      playAreaId: this.playAreaId,
      userId: this.userId,
      scheduledStartTime: this.scheduledStartTime,
      scheduledEndTime: this.scheduledEndTime,
      bufferPaddingMinutes: this.bufferPaddingMinutes,
      status: this.status,
      gameType: this.gameType,
      version: this.version,
    });
  }
}
