// src/modules/moderation/adapters/persistence/UserSanction.entity.ts

import { Entity, PrimaryColumn, Column } from 'typeorm';
import { UserSanction, SanctionType } from '../../domain/models/UserSanction';

@Entity('user_sanctions')
export class UserSanctionEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  type: SanctionType;

  @Column('text')
  reason: string;

  @Column({ name: 'started_at', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  static toEntity(model: UserSanction): UserSanctionEntity {
    const entity = new UserSanctionEntity();
    entity.id = model.id;
    entity.userId = model.userId;
    entity.type = model.type;
    entity.reason = model.reason;
    entity.startedAt = model.startedAt;
    entity.expiresAt = model.expiresAt;
    entity.isActive = model.isActive;
    entity.createdById = model.createdById;
    return entity;
  }

  toModel(): UserSanction {
    return new UserSanction({
      id: this.id,
      userId: this.userId,
      type: this.type,
      reason: this.reason,
      startedAt: this.startedAt,
      expiresAt: this.expiresAt,
      isActive: this.isActive,
      createdById: this.createdById,
    });
  }
}
