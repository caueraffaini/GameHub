import { PlayArea } from '../../domain/models/PlayArea';

export const IPlayAreaRepositoryPortToken = Symbol('IPlayAreaRepositoryPort');

export interface IPlayAreaRepositoryPort {
  findById(id: string): Promise<PlayArea | null>;
  save(playArea: PlayArea): Promise<PlayArea>;
  findAll(): Promise<PlayArea[]>;
}
