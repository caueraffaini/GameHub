// src/modules/moderation/adapters/transport/ChatGateway.ts

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { REDIS_CLIENT } from '../../../matchmaking/adapters/redis/RedisModule';
import { ModerationService } from '../../domain/services/ModerationService';
import { ChatChannelEntity } from '../persistence/ChatChannel.entity';
import { ChatMessageEntity } from '../persistence/ChatMessage.entity';
import { ChatMessage } from '../../domain/models/ChatMessage';

@WebSocketGateway({ namespace: '/chat', cors: true })
@Injectable()
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly moderationService: ModerationService,
    @InjectRepository(ChatChannelEntity)
    private readonly channelRepo: Repository<ChatChannelEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly messageRepo: Repository<ChatMessageEntity>,
  ) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.query?.userId || client.handshake.auth?.userId;
    if (userId) {
      client.data = client.data || {};
      client.data.userId = userId;
      this.logger.log(`User ${userId} connected to /chat namespace`);
    }
  }

  @SubscribeMessage('join_channel')
  async handleJoinChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { channelId: string },
  ) {
    if (payload?.channelId) {
      await client.join(`channel:${payload.channelId}`);
      this.logger.log(`Client ${client.data?.userId} joined channel:${payload.channelId}`);
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { channelId: string; content: string; recipientId?: string },
  ) {
    const senderId = client.data?.userId;
    if (!senderId) {
      client.emit('chat_error', { event: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    const { channelId, content, recipientId } = payload;
    if (!channelId || !content) {
      client.emit('chat_error', { event: 'BAD_REQUEST', message: 'Channel ID and content are required' });
      return;
    }

    // 1. Redis-backed token bucket rate limiter
    const rateLimitKey = `chat:rate:bucket:${senderId}`;
    const now = Date.now();
    const capacity = 5;
    const refillRate = 1; // 1 token per second
    let tokens = capacity;
    let lastRefill = now;

    try {
      const stored = await this.redis.get(rateLimitKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        const elapsedSeconds = (now - parsed.lastRefill) / 1000;
        tokens = Math.min(capacity, parsed.tokens + elapsedSeconds * refillRate);
        lastRefill = now;
      }
    } catch (err: any) {
      this.logger.error(`Failed to read rate limit for user ${senderId}: ${err.message}`);
    }

    if (tokens < 1) {
      // Save current state and reject
      try {
        await this.redis.set(rateLimitKey, JSON.stringify({ tokens, lastRefill }), 'EX', 60);
      } catch {}
      client.emit('chat_error', {
        event: 'SPAM_REJECTED',
        message: 'Too many messages. Rate limit exceeded.',
      });
      return;
    }

    // Consume 1 token and save
    tokens -= 1;
    try {
      await this.redis.set(rateLimitKey, JSON.stringify({ tokens, lastRefill }), 'EX', 60);
    } catch {}

    // 2. Fetch channel to evaluate block status
    const channel = await this.channelRepo.findOne({ where: { id: channelId } });
    if (!channel) {
      client.emit('chat_error', { event: 'NOT_FOUND', message: 'Channel not found' });
      return;
    }

    // 3. Evaluate Block constraint filters
    let targetUserId: string | null = recipientId || null;
    if (!targetUserId && channel.type === 'PRIVATE_MESSAGE') {
      targetUserId = channel.associatedResourceId;
    }

    if (targetUserId) {
      const isBlocked = await this.moderationService.checkFriendshipBlock(senderId, targetUserId);
      if (isBlocked) {
        client.emit('chat_error', {
          event: 'BLOCKED',
          message: 'Message rejected. You or the recipient is blocked.',
        });
        return;
      }
    }

    // 4. Save and broadcast message
    const messageModel = new ChatMessage({
      id: randomUUID(),
      channelId,
      senderId,
      content,
      sentAt: new Date(),
    });

    const entity = ChatMessageEntity.toEntity(messageModel);
    const saved = await this.messageRepo.save(entity);

    if (this.server) {
      this.server.to(`channel:${channelId}`).emit('message', saved.toModel());
    }
  }
}
