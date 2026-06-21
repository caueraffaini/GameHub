import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';
import { OfficialTeam, TemporaryEventTeam, Team } from '../../domain/models/Team';

@Entity('teams')
export class TeamEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'captain_id', type: 'uuid' })
  captainId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column()
  type: 'OFFICIAL' | 'TEMPORARY';

  @Column({ name: 'institute_id', type: 'uuid', nullable: true })
  instituteId: string;

  @Column({ name: 'is_active_competition_team', nullable: true })
  isActiveCompetitionTeam: boolean;

  @Column({ name: 'associated_event_id', type: 'uuid', nullable: true })
  associatedEventId: string;

  @Column({ name: 'expires_at', nullable: true })
  expiresAt: Date;

  static toEntity(model: Team): TeamEntity {
    const entity = new TeamEntity();
    entity.id = model.id;
    entity.name = model.name;
    entity.captainId = model.captainId;
    entity.createdAt = model.createdAt;

    if (model instanceof OfficialTeam) {
      entity.type = 'OFFICIAL';
      entity.instituteId = model.instituteId;
      entity.isActiveCompetitionTeam = model.isActiveCompetitionTeam;
    } else if (model instanceof TemporaryEventTeam) {
      entity.type = 'TEMPORARY';
      entity.associatedEventId = model.associatedEventId;
      entity.expiresAt = model.expiresAt;
    }
    return entity;
  }

  toModel(): Team {
    if (this.type === 'OFFICIAL') {
      return new OfficialTeam({
        id: this.id,
        name: this.name,
        captainId: this.captainId,
        createdAt: this.createdAt,
        instituteId: this.instituteId,
        isActiveCompetitionTeam: this.isActiveCompetitionTeam,
      });
    } else {
      return new TemporaryEventTeam({
        id: this.id,
        name: this.name,
        captainId: this.captainId,
        createdAt: this.createdAt,
        associatedEventId: this.associatedEventId,
        expiresAt: this.expiresAt,
      });
    }
  }
}
