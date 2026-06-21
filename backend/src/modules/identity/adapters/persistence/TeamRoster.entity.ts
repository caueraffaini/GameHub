import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';
import { TeamRoster, RosterStatus } from '../../domain/models/Team';

@Entity('team_rosters')
export class TeamRosterEntity {
  @PrimaryColumn({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @Column({ default: 'ACTIVE' })
  status: RosterStatus;

  @Column({ name: 'seed_number', default: 0 })
  seedNumber: number;

  static toEntity(model: TeamRoster): TeamRosterEntity {
    const entity = new TeamRosterEntity();
    entity.teamId = model.teamId;
    entity.userId = model.userId;
    entity.joinedAt = model.joinedAt;
    entity.status = model.status;
    entity.seedNumber = model.seedNumber;
    return entity;
  }

  toModel(): TeamRoster {
    return new TeamRoster({
      teamId: this.teamId,
      userId: this.userId,
      joinedAt: this.joinedAt,
      status: this.status,
      seedNumber: this.seedNumber,
    });
  }
}
