// src/modules/identity/domain/models/User.ts

export type AvailabilityStatus = 'AVAILABLE' | 'MATCHED' | 'OFFLINE';

export class User {
  id: string;
  nusp: string;
  nickname: string;
  email: string;
  fullName: string;
  birthDate: Date;
  pinHash: string; // Securely hashed 4-digit numerical authentication PIN
  avatarUrl?: string; // Optional avatar URL tracking field
  instituteId: string;
  courseId: string;
  availabilityStatus: AvailabilityStatus;
  isDeleted: boolean;

  constructor(init?: Partial<User>) {
    Object.assign(this, init);
  }
}
