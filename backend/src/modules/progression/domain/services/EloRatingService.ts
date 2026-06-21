// src/modules/progression/domain/services/EloRatingService.ts

import { Injectable } from '@nestjs/common';

export interface EloPlayer {
  rating: number;
}

export interface EloOutcome {
  playerADelta: number;
  playerBDelta: number;
}

@Injectable()
export class EloRatingService {
  calculate(playerA: EloPlayer, playerB: EloPlayer, options: { winner: 'A' | 'B' }): EloOutcome {
    const rA = playerA.rating;
    const rB = playerB.rating;

    const eA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
    const eB = 1 / (1 + Math.pow(10, (rA - rB) / 400));

    const sA = options.winner === 'A' ? 1 : 0;
    const sB = options.winner === 'B' ? 1 : 0;

    const K = 32;

    let deltaA = Math.round(K * (sA - eA));
    let deltaB = Math.round(K * (sB - eB));

    if (deltaA === 0) deltaA = 0;
    if (deltaB === 0) deltaB = 0;

    if (deltaA > 32) deltaA = 32;
    if (deltaA < -32) deltaA = -32;
    if (deltaB > 32) deltaB = 32;
    if (deltaB < -32) deltaB = -32;

    return {
      playerADelta: deltaA,
      playerBDelta: deltaB,
    };
  }
}
