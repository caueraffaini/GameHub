// src/modules/matchmaking/adapters/persistence/DeviceToken.entity.ts

import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { DeviceToken } from '../../domain/models/DeviceToken';

@Entity('device_tokens')
export class DeviceTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'token_string', unique: true })
  tokenString: string;

  @Column()
  platform: 'IOS' | 'ANDROID';

  static toEntity(model: DeviceToken): DeviceTokenEntity {
    const entity = new DeviceTokenEntity();
    entity.userId = model.userId;
    entity.tokenString = model.tokenString;
    entity.platform = model.platform;
    return entity;
  }

  toModel(): DeviceToken {
    return new DeviceToken({
      userId: this.userId,
      tokenString: this.tokenString,
      platform: this.platform,
    });
  }
}
