// src/modules/tournaments/adapters/workers/TournamentStandingsProcessor.ts

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { TournamentMatchSlotEntity } from '../persistence/TournamentMatchSlot.entity';
import { TournamentEntity } from '../persistence/Tournament.entity';
import { GroupStandingEntity } from '../persistence/GroupStanding.entity';
import { EventEntity } from '../persistence/Event.entity';
import { EventScoreEntity } from '../persistence/EventScore.entity';
import { MatchEntity } from '../../../matches/adapters/persistence/Match.entity';
import { TeamRosterEntity } from '../../../identity/adapters/persistence/TeamRoster.entity';
import { randomUUID } from 'crypto';

interface MatchFinalizedJobData {
  matchId: string;
  gameType: string;
  player1Id: string;
  player2Id: string;
  player1Score: number;
  player2Score: number;
  winnerId: string;
  forfeitedUserId: string | null;
}

@Processor('tournament-updates')
@Injectable()
export class TournamentStandingsProcessor extends WorkerHost {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async process(job: Job<MatchFinalizedJobData>): Promise<void> {
    const data = job.data;

    await this.dataSource.transaction('SERIALIZABLE', async (entityManager) => {
      // 1. Find the match slot
      const slot = await entityManager.findOne(TournamentMatchSlotEntity, {
        where: { matchId: data.matchId },
      });

      if (!slot) {
        // Match is not part of a tournament
        return;
      }

      // 2. Find the tournament
      const tournament = await entityManager.findOne(TournamentEntity, {
        where: { id: slot.tournamentId },
      });

      if (!tournament) {
        return;
      }

      // 3. Process according to format
      if (tournament.format === 'ROUND_ROBIN') {
        await this.calculateStanding(entityManager, tournament, data);
      } else {
        await this.advanceWinner(entityManager, tournament, slot, data);
      }

      // 4. Update event scores if tournament is associated with an event (sharing the same ID or name)
      const event = await entityManager.findOne(EventEntity, {
        where: { id: tournament.id },
      });

      if (event) {
        await this.updateEventScores(entityManager, event.id, data);
      }
    });
  }

  private async calculateStanding(
    entityManager: any,
    tournament: TournamentEntity,
    data: MatchFinalizedJobData,
  ): Promise<void> {
    // Look up team associations in TeamRoster
    const roster1 = await entityManager.findOne(TeamRosterEntity, {
      where: { userId: data.player1Id },
    });
    const roster2 = await entityManager.findOne(TeamRosterEntity, {
      where: { userId: data.player2Id },
    });

    const team1Id = roster1 ? roster1.teamId : data.player1Id; // fallback to userId if no team
    const team2Id = roster2 ? roster2.teamId : data.player2Id;

    // Get or create standing for Team 1
    let standing1 = await entityManager.findOne(GroupStandingEntity, {
      where: { tournamentId: tournament.id, teamId: team1Id },
    });
    if (!standing1) {
      standing1 = new GroupStandingEntity();
      standing1.tournamentId = tournament.id;
      standing1.teamId = team1Id;
      standing1.points = 0;
      standing1.matchesWon = 0;
      standing1.matchesLost = 0;
      standing1.scoreDifferential = 0;
    }

    // Get or create standing for Team 2
    let standing2 = await entityManager.findOne(GroupStandingEntity, {
      where: { tournamentId: tournament.id, teamId: team2Id },
    });
    if (!standing2) {
      standing2 = new GroupStandingEntity();
      standing2.tournamentId = tournament.id;
      standing2.teamId = team2Id;
      standing2.points = 0;
      standing2.matchesWon = 0;
      standing2.matchesLost = 0;
      standing2.scoreDifferential = 0;
    }

    // Update stats
    const diff = (data.player1Score || 0) - (data.player2Score || 0);

    if (data.winnerId === data.player1Id) {
      standing1.points += 3;
      standing1.matchesWon += 1;
      standing1.scoreDifferential += diff;

      standing2.matchesLost += 1;
      standing2.scoreDifferential -= diff;
    } else if (data.winnerId === data.player2Id) {
      standing2.points += 3;
      standing2.matchesWon += 1;
      standing2.scoreDifferential -= diff;

      standing1.matchesLost += 1;
      standing1.scoreDifferential += diff;
    } else {
      // Draw (if supported)
      standing1.points += 1;
      standing2.points += 1;
      standing1.scoreDifferential += diff;
      standing2.scoreDifferential -= diff;
    }

    await entityManager.save(GroupStandingEntity, standing1);
    await entityManager.save(GroupStandingEntity, standing2);
  }

  private async advanceWinner(
    entityManager: any,
    tournament: TournamentEntity,
    slot: TournamentMatchSlotEntity,
    data: MatchFinalizedJobData,
  ): Promise<void> {
    const winnerId = data.winnerId;

    if (!slot.parentSlotId) {
      // Final round slot completed. Conclude tournament.
      tournament.status = 'CONCLUDED';
      await entityManager.save(TournamentEntity, tournament);
      return;
    }

    // Locate matching parentSlotId structure
    const parentSlot = await entityManager.findOne(TournamentMatchSlotEntity, {
      where: { id: slot.parentSlotId },
    });

    if (!parentSlot) {
      return;
    }

    if (parentSlot.matchId) {
      // Parent match already created, set empty player slot
      const parentMatch = await entityManager.findOne(MatchEntity, {
        where: { id: parentSlot.matchId },
      });

      if (parentMatch) {
        if (!parentMatch.player1Id) {
          parentMatch.player1Id = winnerId;
        } else if (!parentMatch.player2Id) {
          parentMatch.player2Id = winnerId;
        }

        if (parentMatch.player1Id && parentMatch.player2Id) {
          parentMatch.status = 'PENDING_RESOURCE_ALLOCATION';
        }
        await entityManager.save(MatchEntity, parentMatch);
      }
    } else {
      // Parent match not created yet, create it with winnerId as player1
      const newMatch = new MatchEntity();
      newMatch.id = randomUUID();
      newMatch.playAreaReservationId = null;
      newMatch.player1Id = winnerId;
      newMatch.player2Id = null;
      newMatch.player1Score = null;
      newMatch.player2Score = null;
      newMatch.winnerId = null;
      newMatch.forfeitedUserId = null;
      newMatch.gameType = data.gameType as any;
      newMatch.status = 'PENDING_RESOURCE_ALLOCATION';
      newMatch.startedAt = new Date();
      newMatch.endedAt = null;

      await entityManager.save(MatchEntity, newMatch);

      parentSlot.matchId = newMatch.id;
      await entityManager.save(TournamentMatchSlotEntity, parentSlot);
    }

    // Double Elimination Loser Drop-down
    if (tournament.format === 'DOUBLE_ELIMINATION' && slot.roundNumber < 10) {
      const loserId = data.player1Id === winnerId ? data.player2Id : data.player1Id;
      if (loserId) {
        // Find Winners slots in this round to locate index
        const winnersSlots = await entityManager.find(TournamentMatchSlotEntity, {
          where: { tournamentId: tournament.id, roundNumber: slot.roundNumber },
          order: { id: 'ASC' },
        });

        const idx = winnersSlots.findIndex((s: any) => s.id === slot.id);
        const targetLoserRound = 10 + slot.roundNumber;

        const losersSlots = await entityManager.find(TournamentMatchSlotEntity, {
          where: { tournamentId: tournament.id, roundNumber: targetLoserRound },
          order: { id: 'ASC' },
        });

        if (losersSlots.length > 0) {
          // If counts are equal, map 1-1. If half, map floor(idx/2).
          const targetSlot =
            losersSlots.length === winnersSlots.length
              ? losersSlots[idx]
              : losersSlots[Math.floor(idx / 2)];

          if (targetSlot) {
            if (targetSlot.matchId) {
              const loserMatch = await entityManager.findOne(MatchEntity, {
                where: { id: targetSlot.matchId },
              });
              if (loserMatch) {
                if (!loserMatch.player1Id) {
                  loserMatch.player1Id = loserId;
                } else if (!loserMatch.player2Id) {
                  loserMatch.player2Id = loserId;
                }

                if (loserMatch.player1Id && loserMatch.player2Id) {
                  loserMatch.status = 'PENDING_RESOURCE_ALLOCATION';
                }
                await entityManager.save(MatchEntity, loserMatch);
              }
            } else {
              const newLoserMatch = new MatchEntity();
              newLoserMatch.id = randomUUID();
              newLoserMatch.playAreaReservationId = null;
              newLoserMatch.player1Id = loserId;
              newLoserMatch.player2Id = null;
              newLoserMatch.player1Score = null;
              newLoserMatch.player2Score = null;
              newLoserMatch.winnerId = null;
              newLoserMatch.forfeitedUserId = null;
              newLoserMatch.gameType = data.gameType as any;
              newLoserMatch.status = 'PENDING_RESOURCE_ALLOCATION';
              newLoserMatch.startedAt = new Date();
              newLoserMatch.endedAt = null;

              await entityManager.save(MatchEntity, newLoserMatch);

              targetSlot.matchId = newLoserMatch.id;
              await entityManager.save(TournamentMatchSlotEntity, targetSlot);
            }
          }
        }
      }
    }
  }

  private async updateEventScores(
    entityManager: any,
    eventId: string,
    data: MatchFinalizedJobData,
  ): Promise<void> {
    const winnerId = data.winnerId;
    const loserId = data.player1Id === winnerId ? data.player2Id : data.player1Id;

    // Winner gets 10 points
    if (winnerId) {
      let winnerScore = await entityManager.findOne(EventScoreEntity, {
        where: { eventId, userId: winnerId },
      });
      if (!winnerScore) {
        winnerScore = new EventScoreEntity();
        winnerScore.eventId = eventId;
        winnerScore.userId = winnerId;
        winnerScore.scoreValue = 0;
      }
      winnerScore.scoreValue += 10;
      winnerScore.lastUpdatedAt = new Date();
      await entityManager.save(EventScoreEntity, winnerScore);
    }

    // Loser gets 2 participation points
    if (loserId) {
      let loserScore = await entityManager.findOne(EventScoreEntity, {
        where: { eventId, userId: loserId },
      });
      if (!loserScore) {
        loserScore = new EventScoreEntity();
        loserScore.eventId = eventId;
        loserScore.userId = loserId;
        loserScore.scoreValue = 0;
      }
      loserScore.scoreValue += 2;
      loserScore.lastUpdatedAt = new Date();
      await entityManager.save(EventScoreEntity, loserScore);
    }
  }
}
