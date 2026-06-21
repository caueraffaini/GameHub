// src/modules/matchmaking/ports/outbound/ITicketRepositoryPort.ts

import { MatchmakingTicket } from '../../domain/models/MatchmakingTicket';

export const ITicketRepositoryPortToken = Symbol('ITicketRepositoryPort');

export interface ITicketRepositoryPort {
  save(ticket: MatchmakingTicket): Promise<MatchmakingTicket>;
  findById(id: string): Promise<MatchmakingTicket | null>;
  cancelActiveByUser(userId: string): Promise<void>;
  findActiveByUser(userId: string): Promise<MatchmakingTicket | null>;
  requeueWithPriority(ticketId: string): Promise<void>;
  getActiveTicketIds(instituteId: string, gameType: string): Promise<string[]>;
}
