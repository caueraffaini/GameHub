// src/modules/matchmaking/adapters/workers/HeartbeatTimeoutProcessor.ts

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { IUserRepositoryPort, IUserRepositoryPortToken } from '../../../identity/ports/outbound/IUserRepositoryPort';
import { ITicketRepositoryPort, ITicketRepositoryPortToken } from '../../ports/outbound/ITicketRepositoryPort';
import { IMatchRepositoryPort, IMatchRepositoryPortToken } from '../../../matches/ports/outbound/IMatchRepositoryPort';
import { IPlayAreaReservationRepositoryPort, IPlayAreaReservationRepositoryPortToken } from '../../../facilities/ports/outbound/IPlayAreaReservationRepositoryPort';
import { IDeviceTokenRepositoryPort, IDeviceTokenRepositoryPortToken } from '../../ports/outbound/IDeviceTokenRepositoryPort';
import { INotificationServicePort, INotificationServicePortToken } from '../../ports/outbound/INotificationServicePort';
import { IForfeitMatchUseCase, IForfeitMatchUseCaseToken } from '../../../matches/ports/inbound/IForfeitMatchUseCase';

@Processor('heartbeat-timeout-handler')
export class HeartbeatTimeoutProcessor extends WorkerHost {
  constructor(
    @Inject(IUserRepositoryPortToken)
    private readonly userRepo: IUserRepositoryPort,
    @Inject(ITicketRepositoryPortToken)
    private readonly ticketRepo: ITicketRepositoryPort,
    @Inject(IMatchRepositoryPortToken)
    private readonly matchRepo: IMatchRepositoryPort,
    @Inject(IPlayAreaReservationRepositoryPortToken)
    private readonly reservationRepo: IPlayAreaReservationRepositoryPort,
    @Inject(IDeviceTokenRepositoryPortToken)
    private readonly deviceTokenRepo: IDeviceTokenRepositoryPort,
    @Inject(INotificationServicePortToken)
    private readonly notificationPort: INotificationServicePort,
    @Inject(IForfeitMatchUseCaseToken)
    private readonly forfeitUseCase: IForfeitMatchUseCase,
  ) {
    super();
  }

  async process(job: Job<{ userId: string }>): Promise<void> {
    const { userId } = job.data;

    // 1. Set availability to OFFLINE
    await this.userRepo.updateStatus(userId, 'OFFLINE');

    // 2. Cancel active MatchmakingTickets
    await this.ticketRepo.cancelActiveByUser(userId);

    // 3. Apply forfeit to any in-progress match
    const activeMatch = await this.matchRepo.findActiveByUser(userId);
    if (activeMatch) {
      await this.forfeitUseCase.execute({
        matchId: activeMatch.id,
        forfeitingUserId: userId,
      });
    }

    // 4. Release PlayArea reservation
    await this.reservationRepo.cancelUpcomingByUser(userId);

    // 5. Dispatch silent push via FCM/APNs Output Adapter to alert the mobile device immediately
    try {
      const tokens = await this.deviceTokenRepo.findByUser(userId);
      for (const dt of tokens) {
        await this.notificationPort.sendPush(
          dt.tokenString,
          dt.platform,
          {
            event: 'HEARTBEAT_EXPIRED',
            matchId: activeMatch?.id,
            priority: 'HIGH',
          },
        );
      }
    } catch {
      // Gracefully catch push dispatch errors to prevent worker failure
    }
  }
}
