// src/modules/tournaments/test/unit/bracket.spec.ts

import { BracketEngine } from '../../domain/services/BracketEngine';

describe('BracketEngine (Unit Tests)', () => {
  let bracketEngine: BracketEngine;

  beforeEach(() => {
    bracketEngine = new BracketEngine();
  });

  describe('Single Elimination Format', () => {
    it('should generate bracket for 2 participants', () => {
      const tournamentId = 't1';
      const participantIds = ['user1', 'user2'];
      const { slots, matches } = bracketEngine.generateBracket(
        tournamentId,
        'SINGLE_ELIMINATION',
        participantIds,
        'PINGPONG' as any,
      );

      // 2 players means 1 round, 1 match slot (final)
      expect(slots).toHaveLength(1);
      expect(slots[0].roundNumber).toBe(1);
      expect(slots[0].parentSlotId).toBeNull();

      expect(matches).toHaveLength(1);
      expect(matches[0].player1Id).toBe('user1');
      expect(matches[0].player2Id).toBe('user2');
      expect(matches[0].status).toBe('PENDING_RESOURCE_ALLOCATION');
    });

    it('should generate bracket for 4 participants', () => {
      const tournamentId = 't2';
      const participantIds = ['user1', 'user2', 'user3', 'user4'];
      const { slots, matches } = bracketEngine.generateBracket(
        tournamentId,
        'SINGLE_ELIMINATION',
        participantIds,
        'PINGPONG' as any,
      );

      // 4 players means 2 rounds: 2 in round 1, 1 in round 2 (final) -> total 3 slots
      expect(slots).toHaveLength(3);

      const round1Slots = slots.filter((s) => s.roundNumber === 1);
      const round2Slots = slots.filter((s) => s.roundNumber === 2);

      expect(round1Slots).toHaveLength(2);
      expect(round2Slots).toHaveLength(1);

      expect(round2Slots[0].parentSlotId).toBeNull();
      expect(round1Slots[0].parentSlotId).toBe(round2Slots[0].id);
      expect(round1Slots[1].parentSlotId).toBe(round2Slots[0].id);

      expect(matches).toHaveLength(2); // Round 1 matches
      expect(matches[0].status).toBe('PENDING_RESOURCE_ALLOCATION');
      expect(matches[1].status).toBe('PENDING_RESOURCE_ALLOCATION');
    });

    it('should handle byes for 3 participants correctly', () => {
      const tournamentId = 't3';
      const participantIds = ['user1', 'user2', 'user3'];
      const { slots, matches } = bracketEngine.generateBracket(
        tournamentId,
        'SINGLE_ELIMINATION',
        participantIds,
        'PINGPONG' as any,
      );

      // 3 players means 2 rounds: 2 slots in round 1 (one normal, one bye), 1 slot in round 2.
      expect(slots).toHaveLength(3);

      const round1Slots = slots.filter((s) => s.roundNumber === 1);
      const round2Slots = slots.filter((s) => s.roundNumber === 2);

      expect(round1Slots).toHaveLength(2);
      expect(round2Slots).toHaveLength(1);

      // We expect 3 matches: one normal (user1 vs user2), one completed bye (user3 vs null), and the parent match
      expect(matches).toHaveLength(3);

      const byeMatch = matches.find((m) => m.player2Id === null);
      expect(byeMatch).toBeDefined();
      expect(byeMatch!.player1Id).toBe('user3');
      expect(byeMatch!.status).toBe('COMPLETED');
      expect(byeMatch!.winnerId).toBe('user3');

      // The bye should propagate user3 to the parent match slot (round 2)
      const parentMatch = matches.find((m) => m.id === round2Slots[0].matchId);
      expect(parentMatch).toBeDefined();
      expect(parentMatch!.player1Id).toBe('user3');
      expect(parentMatch!.player2Id).toBeNull();
      expect(parentMatch!.status).toBe('PENDING_RESOURCE_ALLOCATION');
    });
  });

  describe('Double Elimination Format', () => {
    it('should generate double elimination slots', () => {
      const tournamentId = 't_double';
      const participantIds = ['user1', 'user2', 'user3', 'user4'];
      const { slots } = bracketEngine.generateBracket(
        tournamentId,
        'DOUBLE_ELIMINATION',
        participantIds,
        'PINGPONG' as any,
      );

      // Winners bracket: 2 rounds (2 slots in R1, 1 slot in R2).
      // Losers bracket: 1 round (1 slot R11, 1 slot R12).
      // Grand Final: 1 slot (R20).
      expect(slots.length).toBeGreaterThanOrEqual(5);

      const grandFinal = slots.find((s) => s.roundNumber === 20);
      expect(grandFinal).toBeDefined();
      expect(grandFinal!.parentSlotId).toBeNull();

      const winnersFinal = slots.find((s) => s.roundNumber === 2);
      expect(winnersFinal!.parentSlotId).toBe(grandFinal!.id);

      const losersFinal = slots.find((s) => s.roundNumber === 11);
      expect(losersFinal!.parentSlotId).toBe(grandFinal!.id);
    });
  });

  describe('Round Robin Format', () => {
    it('should generate round robin pairings', () => {
      const tournamentId = 't_rr';
      const participantIds = ['user1', 'user2', 'user3', 'user4'];
      const { slots, matches } = bracketEngine.generateBracket(
        tournamentId,
        'ROUND_ROBIN',
        participantIds,
        'PINGPONG' as any,
      );

      // For 4 participants: 3 rounds, 2 matches per round -> 6 matches total
      expect(slots).toHaveLength(6);
      expect(matches).toHaveLength(6);

      // Check rounds
      const rounds = slots.map((s) => s.roundNumber);
      expect(new Set(rounds).size).toBe(3); // 3 distinct rounds (1, 2, 3)

      // Check unique pairings
      const pairings = matches.map((m) => {
        const sorted = [m.player1Id, m.player2Id].sort();
        return `${sorted[0]}-${sorted[1]}`;
      });
      expect(new Set(pairings).size).toBe(6); // All 6 pairings must be unique
    });
  });
});
