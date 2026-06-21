// src/modules/moderation/domain/models/UserSanction.ts

export type SanctionType = 'WARNING' | 'TEMP_BAN' | 'PERMANENT_BAN';

export class UserSanction {
  id: string;
  userId: string;
  type: SanctionType;
  reason: string;
  startedAt: Date;
  expiresAt: Date;
  isActive: boolean;
  createdById: string | null;

  constructor(init?: Partial<UserSanction>) {
    Object.assign(this, init);
  }
}
