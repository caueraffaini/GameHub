// src/modules/tournaments/adapters/persistence/GroupStanding.entity.ts

import { Entity, PrimaryColumn, Column } from 'typeorm';
import { GroupStanding } from '../../domain/models/GroupStanding';

@Entity('group_standings')
export class GroupStandingEntity {
  @PrimaryColumn({ name: 'tournament_id', type: 'uuid' })
  tournamentId: string;

  @PrimaryColumn({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @Column({ type: 'int', default: 0 })
  points: number;

  @Column({ name: 'matches_won', type: 'int', default: 0 })
  matchesWon: number;

  @Column({ name: 'matches_lost', type: 'int', default: 0 })
  matchesLost: number;

  @Column({ name: 'score_differential', type: 'int', default: 0 })
  scoreDifferential: number;

  static toEntity(model: GroupStanding): GroupStandingEntity {
    const entity = new GroupStandingEntity();
    entity.tournamentId = model.tournamentId;
    entity.teamId = model.teamId;
    entity.points = model.points;
    entity.matchesWon = model.matchesWon;
    entity.matchesLost = model.matchesLost;
    entity.scoreDifferential = model.scoreDifferential;
    return entity;
  }

  toModel(): GroupStanding {
    return new GroupStanding({
      tournamentId: this.tournamentId,
      teamId: this.teamId,
      points: this.points,
      matchesWon: this.matchesWon,
      matchesLost: this.matchesLost,
      scoreDifferential: this.scoreDifferential,
    });
  }
}
