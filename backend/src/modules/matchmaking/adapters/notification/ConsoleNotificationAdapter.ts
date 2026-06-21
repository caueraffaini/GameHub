// src/modules/matchmaking/adapters/notification/ConsoleNotificationAdapter.ts

import { Injectable } from '@nestjs/common';
import { INotificationServicePort, PushPayload } from '../../ports/outbound/INotificationServicePort';

@Injectable()
export class ConsoleNotificationAdapter implements INotificationServicePort {
  async sendPush(
    token: string,
    platform: 'IOS' | 'ANDROID',
    payload: PushPayload,
  ): Promise<void> {
    console.log(`[Push Notification] Token: ${token}, Platform: ${platform}, Payload:`, payload);
  }
}
