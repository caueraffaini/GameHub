// src/modules/matchmaking/adapters/transport/MatchGateway.ts

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/RedisModule';

@WebSocketGateway({ namespace: '/match', cors: true })
export class MatchGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.query?.userId || client.handshake.auth?.userId;
    if (userId) {
      client.data = client.data || {};
      client.data.userId = userId;
    }
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      await this.redis.set(`gamehub:heartbeat:${userId}`, '1', 'EX', 15);
    }
  }

  @SubscribeMessage('minimize_presence')
  async handleMinimizePresence(@ConnectedSocket() client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      await this.redis.set(`gamehub:heartbeat:${userId}`, '1', 'EX', 60);
    }
  }

  @SubscribeMessage('join_match')
  async handleJoinMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string },
  ) {
    if (payload?.matchId) {
      await client.join(`match:${payload.matchId}`);
    }
  }
}
