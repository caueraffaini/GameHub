// src/modules/moderation/adapters/workers/SanctionCascadeProcessor.ts

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

import { UserEntity } from '../../../identity/adapters/persistence/User.entity';
import { MatchmakingTicketEntity } from '../../../matchmaking/adapters/persistence/MatchmakingTicket.entity';
import { PlayAreaReservationEntity } from '../../../facilities/adapters/persistence/PlayAreaReservation.entity';

import { IDeviceTokenRepositoryPort, IDeviceTokenRepositoryPortToken } from '../../../matchmaking/ports/outbound/IDeviceTokenRepositoryPort';
import { INotificationServicePort, INotificationServicePortToken } from '../../../matchmaking/ports/outbound/INotificationServicePort';

@Processor('sanction-cascade')
export class SanctionCascadeProcessor extends WorkerHost {
  private readonly logger = new Logger(SanctionCascadeProcessor.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
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

    // Atomic transaction for database modifications
    await this.dataSource.transaction('SERIALIZABLE', async (entityManager) => {
      // 1. Override availabilityStatus to OFFLINE
      await entityManager.createQueryBuilder()
        .update(UserEntity)
        .set({ availabilityStatus: 'OFFLINE' })
        .where('id = :id', { id: userId })
        .execute();

      // 2. Purge active matchmaking tickets (status WAITING)
      const tickets = await entityManager.find(MatchmakingTicketEntity, {
        where: { userId, status: 'WAITING' },
      });
      for (const ticket of tickets) {
        ticket.status = 'CANCELLED';
        await entityManager.save(MatchmakingTicketEntity, ticket);
      }

      // 3. Cancel upcoming play area reservations (status CONFIRMED and startTime > now)
      const now = new Date();
      const reservations = await entityManager.find(PlayAreaReservationEntity, {
        where: { userId, status: 'CONFIRMED' },
      });
      const upcoming = reservations.filter(
        (r) => new Date(r.scheduledStartTime).getTime() > now.getTime(),
      );
      for (const res of upcoming) {
        res.status = 'CANCELLED';
        await entityManager.save(PlayAreaReservationEntity, res);
      }
    });

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
