// src/modules/moderation/adapters/workers/SanctionCascadeProcessor.ts

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger, Injectable } from '@nestjs/common';

import { IUserRepositoryPort, IUserRepositoryPortToken } from '../../../identity/ports/outbound/IUserRepositoryPort';
import { ITicketRepositoryPort, ITicketRepositoryPortToken } from '../../../matchmaking/ports/outbound/ITicketRepositoryPort';
import { IPlayAreaReservationRepositoryPort, IPlayAreaReservationRepositoryPortToken } from '../../../facilities/ports/outbound/IPlayAreaReservationRepositoryPort';
import { IDeviceTokenRepositoryPort, IDeviceTokenRepositoryPortToken } from '../../../matchmaking/ports/outbound/IDeviceTokenRepositoryPort';
import { INotificationServicePort, INotificationServicePortToken } from '../../../matchmaking/ports/outbound/INotificationServicePort';

@Processor('sanction-cascade')
@Injectable()
export class SanctionCascadeProcessor extends WorkerHost {
  private readonly logger = new Logger(SanctionCascadeProcessor.name);

  constructor(
    @Inject(IUserRepositoryPortToken)
    private readonly userRepo: IUserRepositoryPort,
    @Inject(ITicketRepositoryPortToken)
    private readonly ticketRepo: ITicketRepositoryPort,
    @Inject(IPlayAreaReservationRepositoryPortToken)
    private readonly reservationRepo: IPlayAreaReservationRepositoryPort,
    @Inject(IDeviceTokenRepositoryPortToken)
    private readonly deviceTokenRepo: IDeviceTokenRepositoryPort,
    @Inject(INotificationServicePortToken)
    private readonly notificationPort: INotificationServicePort,
  ) {
    super();
  }

  async process(job: Job<{ userId: string }>): Promise<void> {
    const { userId } = job.data;
    this.logger.log(`Processing sanction cascade for user ${userId}`);

    // Boundary rule Section 1.4.2: call ports instead of direct table queries
    // 1. Override availability to OFFLINE
    await this.userRepo.updateStatus(userId, 'OFFLINE');

    // 2. Purge active matchmaking tickets
    await this.ticketRepo.cancelActiveByUser(userId);

    // 3. Cancel upcoming play area reservations
    await this.reservationRepo.cancelUpcomingByUser(userId);

    // 4. Dispatch high-priority native silent push notification
    try {
      const tokens = await this.deviceTokenRepo.findByUser(userId);
      for (const dt of tokens) {
        await this.notificationPort.sendPush(
          dt.tokenString,
          dt.platform,
          {
            event: 'USER_BANNED',
            priority: 'HIGH',
          },
        );
      }
    } catch (err: any) {
      this.logger.error(`Failed to send silent push for banned user ${userId}: ${err.message}`);
    }
  }
}
