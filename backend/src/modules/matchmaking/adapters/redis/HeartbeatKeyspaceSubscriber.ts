// src/modules/matchmaking/adapters/redis/HeartbeatKeyspaceSubscriber.ts

import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_CLIENT, REDIS_SUBSCRIBER } from './RedisModule';

@Injectable()
export class HeartbeatKeyspaceSubscriber implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    @Inject(REDIS_SUBSCRIBER) private readonly redisSubscriber: Redis,
    @InjectQueue('heartbeat-timeout-handler') private readonly heartbeatQueue: Queue,
  ) {}

  async onModuleInit() {
    // 1. Try to activate KEA notifications on the main Redis instance
    try {
      await this.redisClient.config('SET', 'notify-keyspace-events', 'KEA');
    } catch {
      // Ignore if CONFIG command is not supported (e.g. cloud environments or ioredis-mock)
    }

    // 2. Subscribe to the keyspace expiration channel
    const channelName = '__keyevent@0__:expired';
    await this.redisSubscriber.subscribe(channelName);

    // 3. Listen to notifications
    this.redisSubscriber.on('message', (channel, key) => {
      if (channel === channelName && key.startsWith('gamehub:heartbeat:')) {
        const parts = key.split(':');
        const userId = parts[2];
        if (userId) {
          this.heartbeatQueue.add('timeout', { userId }).catch(() => {
            // Silence queue enqueue errors in keyspace subscriber
          });
        }
      }
    });
  }

  async onModuleDestroy() {
    try {
      await this.redisSubscriber.unsubscribe('__keyevent@0__:expired');
    } catch {
      // Ignore unsubscribe errors
    }
  }
}
