import { Entity, PrimaryColumn, Column } from 'typeorm';
import { MatchmakingTicket, TicketStatus } from '../../domain/models/MatchmakingTicket';
import { GameType } from '../../../facilities/domain/models/PlayArea';

@Entity('matchmaking_tickets')
export class MatchmakingTicketEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @Column({ name: 'elo_rating', type: 'int' })
  eloRating: number;

  @Column({ name: 'game_type' })
  gameType: GameType;

  @Column({ name: 'joined_at' })
  joinedAt: Date;

  @Column({ name: 'expiry_time' })
  expiryTime: Date;

  @Column()
  status: TicketStatus;

  static toEntity(model: MatchmakingTicket): MatchmakingTicketEntity {
    const entity = new MatchmakingTicketEntity();
    entity.id = model.id;
    entity.userId = model.userId;
    entity.teamId = model.teamId;
    entity.eloRating = model.eloRating;
    entity.gameType = model.gameType;
    entity.joinedAt = model.joinedAt;
    entity.expiryTime = model.expiryTime;
    entity.status = model.status;
    return entity;
  }

  toModel(): MatchmakingTicket {
    return new MatchmakingTicket({
      id: this.id,
      userId: this.userId,
      teamId: this.teamId,
      eloRating: this.eloRating,
      gameType: this.gameType,
      joinedAt: this.joinedAt,
      expiryTime: this.expiryTime,
      status: this.status,
    });
  }
}
