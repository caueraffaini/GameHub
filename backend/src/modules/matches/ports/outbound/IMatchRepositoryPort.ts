// src/modules/matches/ports/outbound/IMatchRepositoryPort.ts

import { Match } from '../../domain/models/Match';

export const IMatchRepositoryPortToken = Symbol('IMatchRepositoryPort');

export interface IMatchRepositoryPort {
  save(match: Match): Promise<Match>;
  findById(id: string): Promise<Match | null>;
  findActiveByUser(userId: string): Promise<Match | null>;
}
