// src/modules/moderation/domain/models/ChatMessage.ts

export class ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  content: string;
  sentAt: Date;

  constructor(init?: Partial<ChatMessage>) {
    Object.assign(this, init);
  }
}
