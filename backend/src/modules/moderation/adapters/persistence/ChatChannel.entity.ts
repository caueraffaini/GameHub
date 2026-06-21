// src/modules/moderation/adapters/persistence/ChatChannel.entity.ts

import { Entity, PrimaryColumn, Column } from 'typeorm';
import { ChatChannel, ChannelType } from '../../domain/models/ChatChannel';

@Entity('chat_channels')
export class ChatChannelEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  type: ChannelType;

  @Column({ name: 'associated_resource_id', type: 'uuid', nullable: true })
  associatedResourceId: string | null;

  static toEntity(model: ChatChannel): ChatChannelEntity {
    const entity = new ChatChannelEntity();
    entity.id = model.id;
    entity.type = model.type;
    entity.associatedResourceId = model.associatedResourceId;
    return entity;
  }

  toModel(): ChatChannel {
    return new ChatChannel({
      id: this.id,
      type: this.type,
      associatedResourceId: this.associatedResourceId,
    });
  }
}
