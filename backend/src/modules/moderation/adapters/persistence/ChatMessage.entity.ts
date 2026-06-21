// src/modules/moderation/adapters/persistence/ChatMessage.entity.ts

import { Entity, PrimaryColumn, Column } from 'typeorm';
import { ChatMessage } from '../../domain/models/ChatMessage';

@Entity('chat_messages')
export class ChatMessageEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'channel_id', type: 'uuid' })
  channelId: string;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @Column('text')
  content: string;

  @Column({ name: 'sent_at', default: () => 'CURRENT_TIMESTAMP' })
  sentAt: Date;

  static toEntity(model: ChatMessage): ChatMessageEntity {
    const entity = new ChatMessageEntity();
    entity.id = model.id;
    entity.channelId = model.channelId;
    entity.senderId = model.senderId;
    entity.content = model.content;
    entity.sentAt = model.sentAt;
    return entity;
  }

  toModel(): ChatMessage {
    return new ChatMessage({
      id: this.id,
      channelId: this.channelId,
      senderId: this.senderId,
      content: this.content,
      sentAt: this.sentAt,
    });
  }
}
