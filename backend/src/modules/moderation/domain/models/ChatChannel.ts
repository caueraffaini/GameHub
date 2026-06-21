// src/modules/moderation/domain/models/ChatChannel.ts

export type ChannelType = 'PRIVATE_MESSAGE' | 'LOBBY' | 'MATCH_ROOM';

export class ChatChannel {
  id: string;
  type: ChannelType;
  associatedResourceId: string | null;

  constructor(init?: Partial<ChatChannel>) {
    Object.assign(this, init);
  }
}
