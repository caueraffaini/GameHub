// src/modules/matchmaking/adapters/persistence/DeviceTokenRepository.ts

import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IDeviceTokenRepositoryPort } from '../../ports/outbound/IDeviceTokenRepositoryPort';
import { DeviceToken } from '../../domain/models/DeviceToken';
import { DeviceTokenEntity } from './DeviceToken.entity';

@Injectable()
export class DeviceTokenRepository implements IDeviceTokenRepositoryPort {
  constructor(
    @InjectRepository(DeviceTokenEntity)
    private readonly repo: Repository<DeviceTokenEntity>,
  ) {}

  async findByUser(userId: string): Promise<DeviceToken[]> {
    const entities = await this.repo.findBy({ userId });
    return entities.map((entity) => entity.toModel());
  }

  async save(userId: string, token: DeviceToken): Promise<void> {
    const existing = await this.repo.findOneBy({ tokenString: token.tokenString });
    if (existing) {
      existing.userId = userId;
      existing.platform = token.platform;
      await this.repo.save(existing);
    } else {
      const entity = DeviceTokenEntity.toEntity(token);
      entity.userId = userId;
      await this.repo.save(entity);
    }
  }
}
