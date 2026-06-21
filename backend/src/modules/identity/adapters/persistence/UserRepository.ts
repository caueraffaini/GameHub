import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IUserRepositoryPort } from '../../ports/outbound/IUserRepositoryPort';
import { User } from '../../domain/models/User';
import { UserEntity } from './User.entity';

@Injectable()
export class UserRepository implements IUserRepositoryPort {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<User | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? entity.toModel() : null;
  }

  async findByNusp(nusp: string): Promise<User | null> {
    const entity = await this.repo.findOneBy({ nusp });
    return entity ? entity.toModel() : null;
  }

  async save(user: User): Promise<User> {
    const entity = UserEntity.toEntity(user);
    const saved = await this.repo.save(entity);
    return saved.toModel();
  }

  async updateStatus(id: string, status: 'AVAILABLE' | 'MATCHED' | 'OFFLINE'): Promise<void> {
    await this.repo.update(id, { availabilityStatus: status });
  }
}
