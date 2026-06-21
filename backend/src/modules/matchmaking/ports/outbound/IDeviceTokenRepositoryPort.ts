// src/modules/matchmaking/ports/outbound/IDeviceTokenRepositoryPort.ts

import { DeviceToken } from '../../domain/models/DeviceToken';

export const IDeviceTokenRepositoryPortToken = Symbol('IDeviceTokenRepositoryPort');

export interface IDeviceTokenRepositoryPort {
  findByUser(userId: string): Promise<DeviceToken[]>;
  save(userId: string, token: DeviceToken): Promise<void>;
}
