import { ConflictException } from '@nestjs/common';

export class OptimisticLockException extends ConflictException {
  constructor(message?: string) {
    super(message || 'Optimistic lock failed');
  }
}
