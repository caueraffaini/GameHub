// src/modules/tournaments/adapters/transport/TournamentsController.ts

import { Controller, Post, Get, Body, Param, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BracketEngine } from '../../domain/services/BracketEngine';
import { TournamentEntity } from '../persistence/Tournament.entity';
import { TournamentMatchSlotEntity } from '../persistence/TournamentMatchSlot.entity';
import { GroupStandingEntity } from '../persistence/GroupStanding.entity';
import { EventEntity } from '../persistence/Event.entity';
import { EventScoreEntity } from '../persistence/EventScore.entity';
import { MatchEntity } from '../../../matches/adapters/persistence/Match.entity';
import { randomUUID } from 'crypto';

class CreateTournamentDto {
  name: string;
  format: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN';
  gameId?: string;
  gameType: string;
  registrationStartTime: string;
  registrationEndTime: string;
  participantIds: string[];
}

@Controller()
export class TournamentsController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly bracketEngine: BracketEngine,
  ) {}

  @Post('/tournaments')
  async createTournament(@Body() dto: CreateTournamentDto) {
    const tournamentId = randomUUID();
    const { slots, matches } = this.bracketEngine.generateBracket(
      tournamentId,
      dto.format,
      dto.participantIds,
      dto.gameType as any,
    );

    const tournament = new TournamentEntity();
    tournament.id = tournamentId;
    tournament.name = dto.name;
    tournament.gameId = dto.gameId || null;
    tournament.format = dto.format;
    tournament.registrationStartTime = new Date(dto.registrationStartTime);
    tournament.registrationEndTime = new Date(dto.registrationEndTime);
    tournament.status = 'ACTIVE';

    // Create a corresponding event
    const event = new EventEntity();
    event.id = tournamentId;
    event.name = dto.name;
    event.creatorId = null;
    event.description = `Tournament Event for ${dto.name}`;
    event.startTime = new Date(dto.registrationStartTime);
    event.endTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    event.status = 'ACTIVE';

    await this.dataSource.transaction('SERIALIZABLE', async (entityManager) => {
      await entityManager.save(TournamentEntity, tournament);
      await entityManager.save(EventEntity, event);

      // Save matches first (since match slots refer to matches)
      for (const m of matches) {
        // Map to entity
        const matchEntity = MatchEntity.toEntity(m);
        await entityManager.save(MatchEntity, matchEntity);
      }

      // Save match slots
      for (const s of slots) {
        const slotEntity = TournamentMatchSlotEntity.toEntity(s);
        await entityManager.save(TournamentMatchSlotEntity, slotEntity);
      }

      // If ROUND_ROBIN, initialize empty GroupStanding for each participant/team
      if (dto.format === 'ROUND_ROBIN') {
        for (const teamId of dto.participantIds) {
          const standing = new GroupStandingEntity();
          standing.tournamentId = tournamentId;
          standing.teamId = teamId;
          standing.points = 0;
          standing.matchesWon = 0;
          standing.matchesLost = 0;
          standing.scoreDifferential = 0;
          await entityManager.save(GroupStandingEntity, standing);
        }
      }
    });

    return {
      tournamentId,
      name: tournament.name,
      format: tournament.format,
      status: tournament.status,
      slotsCount: slots.length,
      matchesCount: matches.length,
    };
  }

  @Get('/tournaments/:id/bracket')
  async getBracket(@Param('id') id: string) {
    const slots = await this.dataSource.getRepository(TournamentMatchSlotEntity).find({
      where: { tournamentId: id },
    });

    if (!slots || slots.length === 0) {
      throw new NotFoundException('Tournament bracket not found');
    }

    const matches: MatchEntity[] = [];
    for (const slot of slots) {
      if (slot.matchId) {
        const match = await this.dataSource.getRepository(MatchEntity).findOne({
          where: { id: slot.matchId },
        });
        if (match) {
          matches.push(match);
        }
      }
    }

    return { slots, matches };
  }

  @Get('/tournaments/:id/standings')
  async getStandings(@Param('id') id: string) {
    const standings = await this.dataSource.getRepository(GroupStandingEntity).find({
      where: { tournamentId: id },
      order: { points: 'DESC', scoreDifferential: 'DESC' },
    });

    return standings;
  }

  @Get('/events/:id/leaderboard')
  async getLeaderboard(@Param('id') id: string) {
    const scores = await this.dataSource.getRepository(EventScoreEntity).find({
      where: { eventId: id },
      order: { scoreValue: 'DESC' },
    });

    return scores;
  }
}
