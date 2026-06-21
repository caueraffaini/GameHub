// src/modules/progression/adapters/persistence/PlayerRanking.entity.ts

import { Entity, PrimaryColumn, Column, Unique } from 'typeorm';
import { PlayerRanking } from '../../domain/models/PlayerRanking';
import { GameType } from '../../../facilities/domain/models/PlayArea';

@Entity('player_rankings')
@Unique(['seasonId', 'userId', 'gameType'])
export class PlayerRankingEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'season_id', type: 'uuid' })
  seasonId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @Column({ name: 'game_type' })
  gameType: GameType;

  @Column({ name: 'elo_value', type: 'int', default: 1500 })
  eloValue: number;

  @Column({ name: 'games_played', type: 'int', default: 0 })
  gamesPlayed: number;

  @Column({ name: 'last_match_at', nullable: true })
  lastMatchAt: Date | null;

  static toEntity(model: PlayerRanking): PlayerRankingEntity {
    const entity = new PlayerRankingEntity();
    entity.id = model.id;
    entity.seasonId = model.seasonId;
    entity.userId = model.userId;
    entity.teamId = model.teamId;
    entity.gameType = model.gameType;
    entity.eloValue = model.eloValue;
    entity.gamesPlayed = model.gamesPlayed;
    entity.lastMatchAt = model.lastMatchAt;
    return entity;
  }

  toModel(): PlayerRanking {
    return new PlayerRanking({
      id: this.id,
      seasonId: this.seasonId,
      userId: this.userId,
      teamId: this.teamId,
      gameType: this.gameType,
      eloValue: this.eloValue,
      gamesPlayed: this.gamesPlayed,
      lastMatchAt: this.lastMatchAt,
    });
  }
}
