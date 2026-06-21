import * as argon2 from 'argon2';

export type AvailabilityStatus = 'AVAILABLE' | 'MATCHED' | 'OFFLINE';

export class User {
  id: string;
  nusp: string;
  nickname: string;
  email: string;
  fullName: string;
  birthDate: Date;
  pinHash: string; // Securely hashed 4-digit numerical PIN
  avatarUrl?: string; // Optional avatar image URL
  instituteId: string;
  courseId: string;
  availabilityStatus: AvailabilityStatus;
  isDeleted: boolean;

  constructor(init?: Partial<User>) {
    Object.assign(this, init);
  }

  async validatePin(pin: string): Promise<boolean> {
    if (!/^\d{4}$/.test(pin)) return false;
    try {
      return await argon2.verify(this.pinHash, pin);
    } catch {
      return false;
    }
  }

  async updatePin(newPin: string): Promise<void> {
    if (!/^\d{4}$/.test(newPin)) {
      throw new Error('PIN must be exactly 4 digits');
    }
    this.pinHash = await argon2.hash(newPin);
  }

  updateAvatar(url: string): void {
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('Invalid URL format for avatar');
    }
    this.avatarUrl = url;
  }

  scrubIdentity(anonymizedId: string): void {
    this.isDeleted = true;
    this.nusp = `deleted_nusp_${anonymizedId}`;
    this.nickname = `deleted_user_${anonymizedId}`;
    this.email = `deleted_email_${anonymizedId}@anonymized.usp.br`;
    this.fullName = 'Deleted User';
    this.avatarUrl = undefined;
    this.availabilityStatus = 'OFFLINE';
  }
}

export class PublicUserDTO {
  id: string;
  nickname: string;
  instituteId: string;
  courseId: string;
  avatarUrl?: string;

  static fromEntity(user: User): PublicUserDTO {
    return {
      id: user.id,
      nickname: user.nickname,
      instituteId: user.instituteId,
      courseId: user.courseId,
      avatarUrl: user.avatarUrl,
    };
  }
}

export class PrivateUserDTO {
  id: string;
  nusp: string;
  nickname: string;
  email: string;
  fullName: string;
  birthDate: Date;
  avatarUrl?: string;
  instituteId: string;
  courseId: string;
  availabilityStatus: AvailabilityStatus;

  static fromEntity(user: User): PrivateUserDTO {
    return {
      id: user.id,
      nusp: user.nusp,
      nickname: user.nickname,
      email: user.email,
      fullName: user.fullName,
      birthDate: user.birthDate,
      avatarUrl: user.avatarUrl,
      instituteId: user.instituteId,
      courseId: user.courseId,
      availabilityStatus: user.availabilityStatus,
    };
  }
}
