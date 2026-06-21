// src/modules/progression/test/unit/elo-rating.spec.ts

import { EloRatingService } from '../../domain/services/EloRatingService';

describe('EloRatingService', () => {
  let eloService: EloRatingService;

  beforeEach(() => {
    eloService = new EloRatingService();
  });

  it('should calculate correct rating changes for balanced matches', () => {
    const playerA = { rating: 1500 };
    const playerB = { rating: 1500 };

    // Player A wins
    const outcomeA = eloService.calculate(playerA, playerB, { winner: 'A' });
    expect(outcomeA.playerADelta).toBe(16);
    expect(outcomeA.playerBDelta).toBe(-16);

    // Player B wins
    const outcomeB = eloService.calculate(playerA, playerB, { winner: 'B' });
    expect(outcomeB.playerADelta).toBe(-16);
    expect(outcomeB.playerBDelta).toBe(16);
  });

  it('should calculate correct rating changes for unbalanced matches (A stronger)', () => {
    const playerA = { rating: 1600 };
    const playerB = { rating: 1400 };

    // Stronger player A wins: wins less ELO
    const outcomeA = eloService.calculate(playerA, playerB, { winner: 'A' });
    expect(outcomeA.playerADelta).toBe(8);
    expect(outcomeA.playerBDelta).toBe(-8);

    // Weaker player B wins: wins more ELO
    const outcomeB = eloService.calculate(playerA, playerB, { winner: 'B' });
    expect(outcomeB.playerADelta).toBe(-24);
    expect(outcomeB.playerBDelta).toBe(24);
  });

  it('should calculate correct rating changes for unbalanced matches (B stronger)', () => {
    const playerA = { rating: 1400 };
    const playerB = { rating: 1600 };

    // Stronger player B wins: wins less ELO
    const outcomeB = eloService.calculate(playerA, playerB, { winner: 'B' });
    expect(outcomeB.playerADelta).toBe(-8);
    expect(outcomeB.playerBDelta).toBe(8);

    // Weaker player A wins: wins more ELO
    const outcomeA = eloService.calculate(playerA, playerB, { winner: 'A' });
    expect(outcomeA.playerADelta).toBe(24);
    expect(outcomeA.playerBDelta).toBe(-24);
  });

  it('should enforce anti-inflation caps of +/- 32 ELO points', () => {
    // Extreme ELO differences should not exceed 32 ELO point changes
    const playerA = { rating: 3000 };
    const playerB = { rating: 1000 };

    // Stronger player A loses to extreme underdog: cap at -32
    const outcomeB = eloService.calculate(playerA, playerB, { winner: 'B' });
    expect(outcomeB.playerADelta).toBe(-32);
    expect(outcomeB.playerBDelta).toBe(32);

    // Underdog loses: wins 0 ELO (or rounded to 0), stronger wins 0
    const outcomeA = eloService.calculate(playerA, playerB, { winner: 'A' });
    expect(outcomeA.playerADelta).toBe(0);
    expect(outcomeA.playerBDelta).toBe(0);
  });
});
