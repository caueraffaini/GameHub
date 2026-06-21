import { Entity, PrimaryColumn } from 'typeorm';
import { GameType } from '../../domain/models/PlayArea';

@Entity('play_area_supported_games')
export class PlayAreaSupportedGameEntity {
  @PrimaryColumn({ name: 'play_area_id', type: 'uuid' })
  playAreaId: string;

  @PrimaryColumn({ name: 'game_type' })
  gameType: GameType;
}
