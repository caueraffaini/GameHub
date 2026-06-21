// src/modules/moderation/adapters/persistence/Friendship.entity.ts

import { Entity, PrimaryColumn, Column } from 'typeorm';
import { Friendship, FriendshipStatus } from '../../domain/models/Friendship';

@Entity('friendships')
export class FriendshipEntity {
  @PrimaryColumn({ name: 'user_id1', type: 'uuid' })
  userId1: string;

  @PrimaryColumn({ name: 'user_id2', type: 'uuid' })
  userId2: string;

  @Column({ name: 'established_at', default: () => 'CURRENT_TIMESTAMP' })
  establishedAt: Date;

  @Column()
  status: FriendshipStatus;

  static toEntity(model: Friendship): FriendshipEntity {
    const entity = new FriendshipEntity();
    entity.userId1 = model.userId1;
    entity.userId2 = model.userId2;
    entity.establishedAt = model.establishedAt;
    entity.status = model.status;
    return entity;
  }

  toModel(): Friendship {
    return new Friendship({
      userId1: this.userId1,
      userId2: this.userId2,
      establishedAt: this.establishedAt,
      status: this.status,
    });
  }
}
