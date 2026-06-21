// src/modules/tournaments/domain/services/BracketEngine.ts

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TournamentMatchSlot } from '../models/TournamentMatchSlot';
import { Match } from '../../../matches/domain/models/Match';
import { TournamentFormat } from '../models/Tournament';
import { GameType } from '../../../facilities/domain/models/PlayArea';

@Injectable()
export class BracketEngine {
  generateBracket(
    tournamentId: string,
    format: TournamentFormat,
    participantIds: string[],
    gameType: GameType,
  ): { slots: TournamentMatchSlot[]; matches: Match[] } {
    if (!participantIds || participantIds.length < 2) {
      throw new Error('Tournament requires at least 2 participants');
    }

    if (format === 'SINGLE_ELIMINATION') {
      return this.generateSingleElimination(tournamentId, participantIds, gameType);
    } else if (format === 'DOUBLE_ELIMINATION') {
      return this.generateDoubleElimination(tournamentId, participantIds, gameType);
    } else if (format === 'ROUND_ROBIN') {
      return this.generateRoundRobin(tournamentId, participantIds, gameType);
    }

    throw new Error(`Unsupported tournament format: ${format}`);
  }

  private generateSingleElimination(
    tournamentId: string,
    participantIds: string[],
    gameType: GameType,
  ): { slots: TournamentMatchSlot[]; matches: Match[] } {
    const N = participantIds.length;
    const R = Math.ceil(Math.log2(N));

    const slots: TournamentMatchSlot[] = [];
    const matches: Match[] = [];

    // Create slots from final round down to round 1
    // Round R (Finals): 1 slot
    const finalSlot = new TournamentMatchSlot({
      id: randomUUID(),
      tournamentId,
      roundNumber: R,
      parentSlotId: null,
      matchId: null,
    });
    slots.push(finalSlot);

    let currentRoundSlots = [finalSlot];

    // Build the tree downwards
    for (let r = R - 1; r >= 1; r--) {
      const nextRoundSlots: TournamentMatchSlot[] = [];
      for (const parent of currentRoundSlots) {
        const child1 = new TournamentMatchSlot({
          id: randomUUID(),
          tournamentId,
          roundNumber: r,
          parentSlotId: parent.id,
          matchId: null,
        });
        const child2 = new TournamentMatchSlot({
          id: randomUUID(),
          tournamentId,
          roundNumber: r,
          parentSlotId: parent.id,
          matchId: null,
        });
        nextRoundSlots.push(child1, child2);
        slots.push(child1, child2);
      }
      currentRoundSlots = nextRoundSlots;
    }

    // Sort round 1 slots so we assign participants deterministically
    const round1Slots = slots.filter((s) => s.roundNumber === 1);

    // Track advanced players for byes
    const advancedToParent = new Map<string, string>();

    // Assign participants to Round 1 slots
    for (let i = 0; i < round1Slots.length; i++) {
      const slot = round1Slots[i];
      const p1 = participantIds[2 * i] || null;
      const p2 = participantIds[2 * i + 1] || null;

      if (!p1 && !p2) {
        continue;
      }

      if (p1 && !p2) {
        // BYE for p1: create completed match, advance p1 to parent
        const match = new Match({
          id: randomUUID(),
          playAreaReservationId: null,
          player1Id: p1,
          player2Id: null,
          player1Score: 1,
          player2Score: 0,
          winnerId: p1,
          forfeitedUserId: null,
          gameType,
          status: 'COMPLETED',
          startedAt: new Date(),
          endedAt: new Date(),
        });
        slot.matchId = match.id;
        matches.push(match);

        if (slot.parentSlotId) {
          advancedToParent.set(slot.parentSlotId, p1);
        }
      } else {
        // Normal match
        const match = new Match({
          id: randomUUID(),
          playAreaReservationId: null,
          player1Id: p1,
          player2Id: p2,
          player1Score: null,
          player2Score: null,
          winnerId: null,
          forfeitedUserId: null,
          gameType,
          status: 'PENDING_RESOURCE_ALLOCATION',
          startedAt: new Date(),
          endedAt: null,
        });
        slot.matchId = match.id;
        matches.push(match);
      }
    }

    // Propagate advanced players to Round 2 slots
    for (const [parentSlotId, playerId] of advancedToParent.entries()) {
      const parentSlot = slots.find((s) => s.id === parentSlotId);
      if (!parentSlot) continue;

      let parentMatch = matches.find((m) => m.id === parentSlot.matchId);
      if (!parentMatch) {
        parentMatch = new Match({
          id: randomUUID(),
          playAreaReservationId: null,
          player1Id: playerId,
          player2Id: null,
          player1Score: null,
          player2Score: null,
          winnerId: null,
          forfeitedUserId: null,
          gameType,
          status: 'PENDING_RESOURCE_ALLOCATION',
          startedAt: new Date(),
          endedAt: null,
        });
        parentSlot.matchId = parentMatch.id;
        matches.push(parentMatch);
      } else {
        if (!parentMatch.player1Id) {
          parentMatch.player1Id = playerId;
        } else {
          parentMatch.player2Id = playerId;
        }
      }
    }

    return { slots, matches };
  }

  private generateDoubleElimination(
    tournamentId: string,
    participantIds: string[],
    gameType: GameType,
  ): { slots: TournamentMatchSlot[]; matches: Match[] } {
    const N = participantIds.length;
    const R = Math.ceil(Math.log2(N));

    const slots: TournamentMatchSlot[] = [];
    const matches: Match[] = [];

    // 1. Grand Final (Round 20)
    const grandFinalSlot = new TournamentMatchSlot({
      id: randomUUID(),
      tournamentId,
      roundNumber: 20,
      parentSlotId: null,
      matchId: null,
    });
    slots.push(grandFinalSlot);

    // 2. Winners Bracket Final (Round R) pointing to Grand Final
    const winnersFinalSlot = new TournamentMatchSlot({
      id: randomUUID(),
      tournamentId,
      roundNumber: R,
      parentSlotId: grandFinalSlot.id,
      matchId: null,
    });
    slots.push(winnersFinalSlot);

    // Build Winners Bracket downwards
    let currentWinnersSlots = [winnersFinalSlot];
    for (let r = R - 1; r >= 1; r--) {
      const nextWinnersSlots: TournamentMatchSlot[] = [];
      for (const parent of currentWinnersSlots) {
        const child1 = new TournamentMatchSlot({
          id: randomUUID(),
          tournamentId,
          roundNumber: r,
          parentSlotId: parent.id,
          matchId: null,
        });
        const child2 = new TournamentMatchSlot({
          id: randomUUID(),
          tournamentId,
          roundNumber: r,
          parentSlotId: parent.id,
          matchId: null,
        });
        nextWinnersSlots.push(child1, child2);
        slots.push(child1, child2);
      }
      currentWinnersSlots = nextWinnersSlots;
    }

    // 3. Losers Bracket Final (Round 10 + R - 1) pointing to Grand Final
    // Note: if R = 1, losers bracket is empty, GF is Winners vs Losers (which is Winners Round 1 vs Loser).
    const losersFinalSlot = new TournamentMatchSlot({
      id: randomUUID(),
      tournamentId,
      roundNumber: 10 + R - 1,
      parentSlotId: grandFinalSlot.id,
      matchId: null,
    });
    slots.push(losersFinalSlot);

    // Build Losers Bracket downwards if R > 1
    if (R > 1) {
      let currentLosersSlots = [losersFinalSlot];
      for (let r = R - 2; r >= 1; r--) {
        const nextLosersSlots: TournamentMatchSlot[] = [];
        for (const parent of currentLosersSlots) {
          const child1 = new TournamentMatchSlot({
            id: randomUUID(),
            tournamentId,
            roundNumber: 10 + r,
            parentSlotId: parent.id,
            matchId: null,
          });
          const child2 = new TournamentMatchSlot({
            id: randomUUID(),
            tournamentId,
            roundNumber: 10 + r,
            parentSlotId: parent.id,
            matchId: null,
          });
          nextLosersSlots.push(child1, child2);
          slots.push(child1, child2);
        }
        currentLosersSlots = nextLosersSlots;
      }
    }

    // Sort Winners round 1 slots so we assign participants
    const round1WinnersSlots = slots.filter((s) => s.roundNumber === 1);

    // Track advanced players for byes in winners round 1
    const advancedToParent = new Map<string, string>();

    // Assign participants to Winners Round 1
    for (let i = 0; i < round1WinnersSlots.length; i++) {
      const slot = round1WinnersSlots[i];
      const p1 = participantIds[2 * i] || null;
      const p2 = participantIds[2 * i + 1] || null;

      if (!p1 && !p2) {
        continue;
      }

      if (p1 && !p2) {
        // Bye
        const match = new Match({
          id: randomUUID(),
          playAreaReservationId: null,
          player1Id: p1,
          player2Id: null,
          player1Score: 1,
          player2Score: 0,
          winnerId: p1,
          forfeitedUserId: null,
          gameType,
          status: 'COMPLETED',
          startedAt: new Date(),
          endedAt: new Date(),
        });
        slot.matchId = match.id;
        matches.push(match);

        if (slot.parentSlotId) {
          advancedToParent.set(slot.parentSlotId, p1);
        }
      } else {
        // Normal
        const match = new Match({
          id: randomUUID(),
          playAreaReservationId: null,
          player1Id: p1,
          player2Id: p2,
          player1Score: null,
          player2Score: null,
          winnerId: null,
          forfeitedUserId: null,
          gameType,
          status: 'PENDING_RESOURCE_ALLOCATION',
          startedAt: new Date(),
          endedAt: null,
        });
        slot.matchId = match.id;
        matches.push(match);
      }
    }

    // Propagate byes in Winners Round 2
    for (const [parentSlotId, playerId] of advancedToParent.entries()) {
      const parentSlot = slots.find((s) => s.id === parentSlotId);
      if (!parentSlot) continue;

      let parentMatch = matches.find((m) => m.id === parentSlot.matchId);
      if (!parentMatch) {
        parentMatch = new Match({
          id: randomUUID(),
          playAreaReservationId: null,
          player1Id: playerId,
          player2Id: null,
          player1Score: null,
          player2Score: null,
          winnerId: null,
          forfeitedUserId: null,
          gameType,
          status: 'PENDING_RESOURCE_ALLOCATION',
          startedAt: new Date(),
          endedAt: null,
        });
        parentSlot.matchId = parentMatch.id;
        matches.push(parentMatch);
      } else {
        if (!parentMatch.player1Id) {
          parentMatch.player1Id = playerId;
        } else {
          parentMatch.player2Id = playerId;
        }
      }
    }

    return { slots, matches };
  }

  private generateRoundRobin(
    tournamentId: string,
    participantIds: string[],
    gameType: GameType,
  ): { slots: TournamentMatchSlot[]; matches: Match[] } {
    const slots: TournamentMatchSlot[] = [];
    const matches: Match[] = [];

    // Berger tables / Circle method
    const list = [...participantIds];
    if (list.length % 2 !== 0) {
      list.push('BYE'); // dummy participant for bye representation
    }

    const N = list.length;
    const roundsCount = N - 1;
    const matchesPerRound = N / 2;

    for (let round = 1; round <= roundsCount; round++) {
      for (let i = 0; i < matchesPerRound; i++) {
        const home = list[i];
        const away = list[N - 1 - i];

        // Skip if either is the dummy BYE (this represents a bye week for that participant)
        if (home === 'BYE' || away === 'BYE') {
          continue;
        }

        const match = new Match({
          id: randomUUID(),
          playAreaReservationId: null,
          player1Id: home,
          player2Id: away,
          player1Score: null,
          player2Score: null,
          winnerId: null,
          forfeitedUserId: null,
          gameType,
          status: 'PENDING_RESOURCE_ALLOCATION',
          startedAt: new Date(),
          endedAt: null,
        });

        const slot = new TournamentMatchSlot({
          id: randomUUID(),
          tournamentId,
          roundNumber: round,
          matchId: match.id,
          parentSlotId: null,
        });

        slots.push(slot);
        matches.push(match);
      }

      // Rotate list (keep first element fixed, rotate others)
      const first = list[0];
      const rest = list.slice(1);
      const last = rest.pop()!;
      list.length = 0;
      list.push(first, last, ...rest);
    }

    return { slots, matches };
  }
}
