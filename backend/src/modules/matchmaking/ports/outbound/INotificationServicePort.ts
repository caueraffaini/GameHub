// src/modules/matchmaking/ports/outbound/INotificationServicePort.ts

export interface PushPayload {
  event: string;
  matchId?: string;
  priority: 'HIGH' | 'NORMAL';
}

export const INotificationServicePortToken = Symbol('INotificationServicePort');

export interface INotificationServicePort {
  sendPush(
    token: string,
    platform: 'IOS' | 'ANDROID',
    payload: PushPayload,
  ): Promise<void>;
}
