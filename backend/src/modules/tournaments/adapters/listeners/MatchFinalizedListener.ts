// src/modules/tournaments/adapters/listeners/MatchFinalizedListener.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Subscription, from } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { EventBus } from '../../../../shared/events/EventBus';
import { MatchFinalizedEvent } from '../../../matches/domain/events/MatchFinalizedEvent';

@Injectable()
export class MatchFinalizedListener implements OnModuleInit, OnModuleDestroy {
  private subscription: Subscription;

  constructor(
    private readonly eventBus: EventBus,
    @InjectQueue('tournament-updates')
    private readonly tournamentQueue: Queue,
  ) {}

  onModuleInit() {
    this.subscription = this.eventBus
      .get$()
      .pipe(
        concatMap((event) => {
          if (event instanceof MatchFinalizedEvent) {
            return from(
              this.handleMatchFinalized(event).catch((err) => {
                console.error('Error queuing MatchFinalizedEvent:', err);
              }),
            );
          }
          return from(Promise.resolve());
        }),
      )
      .subscribe();
  }

  onModuleDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  async handleMatchFinalized(event: MatchFinalizedEvent): Promise<void> {
    await this.tournamentQueue.add('process-match-finalized', {
      matchId: event.matchId,
      gameType: event.gameType,
      player1Id: event.player1Id,
      player2Id: event.player2Id,
      player1Score: event.player1Score,
      player2Score: event.player2Score,
      winnerId: event.winnerId,
      forfeitedUserId: event.forfeitedUserId,
    });
  }
}
