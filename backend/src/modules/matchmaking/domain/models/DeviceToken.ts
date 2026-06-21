// src/modules/matchmaking/domain/models/DeviceToken.ts

export class DeviceToken {
  userId: string;
  tokenString: string;
  platform: 'IOS' | 'ANDROID';

  constructor(init?: Partial<DeviceToken>) {
    Object.assign(this, init);
  }
}
