// src/modules/progression/adapters/persistence/Season.entity.ts

import { Entity, PrimaryColumn, Column } from 'typeorm';
import { Season } from '../../domain/models/Season';

@Entity('seasons')
export class SeasonEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'start_time' })
  startTime: Date;

  @Column({ name: 'end_time' })
  endTime: Date;

  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  static toEntity(model: Season): SeasonEntity {
    const entity = new SeasonEntity();
    entity.id = model.id;
    entity.name = model.name;
    entity.startTime = model.startTime;
    entity.endTime = model.endTime;
    entity.isActive = model.isActive;
    return entity;
  }

  toModel(): Season {
    return new Season({
      id: this.id,
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime,
      isActive: this.isActive,
    });
  }
}
