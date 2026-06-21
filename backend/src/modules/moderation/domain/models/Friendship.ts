// src/modules/moderation/domain/models/Friendship.ts

export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED';

export class Friendship {
  userId1: string;
  userId2: string;
  establishedAt: Date;
  status: FriendshipStatus;

  constructor(init?: Partial<Friendship>) {
    Object.assign(this, init);
  }
}
