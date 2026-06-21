import { Entity, PrimaryColumn, Column, VersionColumn } from 'typeorm';
import { PlayArea, PlayAreaStatus, GameType } from '../../domain/models/PlayArea';

@Entity('play_areas')
export class PlayAreaEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 'EMPTY' })
  status: PlayAreaStatus;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_virtual', default: false })
  isVirtual: boolean;

  @VersionColumn({ default: 1 })
  version: number;

  static toEntity(model: PlayArea): PlayAreaEntity {
    const entity = new PlayAreaEntity();
    entity.id = model.id;
    entity.name = model.name;
    entity.status = model.status;
    entity.isActive = model.isActive !== false;
    entity.isVirtual = model.isVirtual === true;
    if (model.version !== undefined) {
      entity.version = model.version;
    }
    return entity;
  }

  toModel(supportedGameTypes: GameType[]): PlayArea {
    return new PlayArea({
      id: this.id,
      name: this.name,
      status: this.status,
      isVirtual: this.isVirtual,
      isActive: this.isActive,
      version: this.version,
      supportedGameTypes: supportedGameTypes || [],
    });
  }
}
