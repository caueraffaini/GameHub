import { User } from '../../domain/models/User';

export interface IUserRepositoryPort {
  findById(id: string): Promise<User | null>;
  findByNusp(nusp: string): Promise<User | null>;
  save(user: User): Promise<User>;
  updateStatus(id: string, status: 'AVAILABLE' | 'MATCHED' | 'OFFLINE'): Promise<void>;
}

export const IUserRepositoryPortToken = Symbol('IUserRepositoryPort');
