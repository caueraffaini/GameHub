// src/modules/tournaments/test/integration/tournaments.integration-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { TournamentsModule } from '../../tournaments.module';
import { EventModule } from '../../../../shared/events/EventModule';
import { EventBus } from '../../../../shared/events/EventBus';
import { TournamentEntity } from '../../adapters/persistence/Tournament.entity';
import { TournamentMatchSlotEntity } from '../../adapters/persistence/TournamentMatchSlot.entity';
import { GroupStandingEntity } from '../../adapters/persistence/GroupStanding.entity';
import { EventEntity } from '../../adapters/persistence/Event.entity';
import { EventScoreEntity } from '../../adapters/persistence/EventScore.entity';
import { UserEntity } from '../../../identity/adapters/persistence/User.entity';
import { TeamEntity } from '../../../identity/adapters/persistence/Team.entity';
import { TeamRosterEntity } from '../../../identity/adapters/persistence/TeamRoster.entity';
import { MatchEntity } from '../../../matches/adapters/persistence/Match.entity';
import { MatchFinalizedEvent } from '../../../matches/domain/events/MatchFinalizedEvent';
import { TournamentStandingsProcessor } from '../../adapters/workers/TournamentStandingsProcessor';
import { TournamentsController } from '../../adapters/transport/TournamentsController';
import { BullModule } from '@nestjs/bullmq';
import * as RedisMock from 'ioredis-mock';
import { randomUUID } from 'crypto';

describe('Tournaments Integration Tests (SQLite Fallback)', () => {
  let moduleFixture: TestingModule;
  let dataSource: DataSource;
  let eventBus: EventBus;
  let processor: TournamentStandingsProcessor;

  // Mock queue to immediately process job
  const mockQueue = {
    add: jest.fn().mockImplementation(async (name, data) => {
      // Direct call to processor
      await processor.process({ data } as any);
      return { id: 'job-id' };
    }),
  };

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [
            UserEntity,
            TeamEntity,
            TeamRosterEntity,
            MatchEntity,
            EventEntity,
            EventScoreEntity,
            TournamentEntity,
            TournamentMatchSlotEntity,
            GroupStandingEntity,
          ],
          synchronize: true,
          logging: false,
        }),
        BullModule.forRoot({
          connection: new RedisMock(),
        }),
        EventModule,
        TournamentsModule,
      ],
    })
      .overrideProvider(getQueueToken('tournament-updates'))
      .useValue(mockQueue)
      .overrideProvider(TournamentStandingsProcessor)
      .useValue({ process: jest.fn() })
      .compile();

    await moduleFixture.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    eventBus = moduleFixture.get<EventBus>(EventBus);
    processor = new TournamentStandingsProcessor(dataSource);
  });

  afterAll(async () => {
    if (moduleFixture) {
      await moduleFixture.close();
    }
  });

  beforeEach(async () => {
    await dataSource.getRepository(GroupStandingEntity).clear();
    await dataSource.getRepository(TournamentMatchSlotEntity).clear();
    await dataSource.getRepository(TournamentEntity).clear();
    await dataSource.getRepository(EventScoreEntity).clear();
    await dataSource.getRepository(EventEntity).clear();
    await dataSource.getRepository(MatchEntity).clear();
    await dataSource.getRepository(TeamRosterEntity).clear();
    await dataSource.getRepository(UserEntity).clear();
  });

  it('should process MatchFinalizedEvent and advance winner in single-elimination', async () => {
    const user1Id = randomUUID();
    const user2Id = randomUUID();
    const user3Id = randomUUID();
    const user4Id = randomUUID();

    // 1. Seed Users
    await dataSource.getRepository(UserEntity).save([
      {
        id: user1Id,
        nusp: '11112222',
        nickname: 'PlayerA',
        email: 'playera@usp.br',
        fullName: 'Player One',
        birthDate: new Date('2000-01-01'),
        pinHash: 'hashedpin',
        instituteId: randomUUID(),
        courseId: randomUUID(),
        availabilityStatus: 'AVAILABLE',
        isDeleted: false,
      },
      {
        id: user2Id,
        nusp: '22223333',
        nickname: 'PlayerB',
        email: 'playerb@usp.br',
        fullName: 'Player Two',
        birthDate: new Date('2000-01-01'),
        pinHash: 'hashedpin',
        instituteId: randomUUID(),
        courseId: randomUUID(),
        availabilityStatus: 'AVAILABLE',
        isDeleted: false,
      },
      {
        id: user3Id,
        nusp: '33334444',
        nickname: 'PlayerC',
        email: 'playerc@usp.br',
        fullName: 'Player Three',
        birthDate: new Date('2000-01-01'),
        pinHash: 'hashedpin',
        instituteId: randomUUID(),
        courseId: randomUUID(),
        availabilityStatus: 'AVAILABLE',
        isDeleted: false,
      },
      {
        id: user4Id,
        nusp: '44445555',
        nickname: 'PlayerD',
        email: 'playerd@usp.br',
        fullName: 'Player Four',
        birthDate: new Date('2000-01-01'),
        pinHash: 'hashedpin',
        instituteId: randomUUID(),
        courseId: randomUUID(),
        availabilityStatus: 'AVAILABLE',
        isDeleted: false,
      },
    ]);

    // 2. Create Tournament
    const tournamentsController = moduleFixture.get(TournamentsController);
    
    const result = await tournamentsController.createTournament({
      name: 'Single Elimination Test',
      format: 'SINGLE_ELIMINATION',
      gameType: 'PINGPONG',
      registrationStartTime: new Date().toISOString(),
      registrationEndTime: new Date().toISOString(),
      participantIds: [user1Id, user2Id, user3Id, user4Id],
    });

    const tournamentId = result.tournamentId;

    // 3. Get generated slots
    const { slots, matches } = await tournamentsController.getBracket(tournamentId);
    expect(slots).toHaveLength(3);
    expect(matches).toHaveLength(2);

    const matchA = matches.find((m: any) => m.player1Id === user1Id && m.player2Id === user2Id);
    const matchB = matches.find((m: any) => m.player1Id === user3Id && m.player2Id === user4Id);

    expect(matchA).toBeDefined();
    expect(matchB).toBeDefined();

    // 4. Publish finalize events
    eventBus.publish(
      new MatchFinalizedEvent(
        matchA.id,
        'PINGPONG' as any,
        user1Id,
        user2Id,
        11,
        8,
        user1Id,
      ),
    );

    eventBus.publish(
      new MatchFinalizedEvent(
        matchB.id,
        'PINGPONG' as any,
        user3Id,
        user4Id,
        11,
        7,
        user3Id,
      ),
    );

    // Wait a brief moment to let RxJS process
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 5. Check if parent match has been created and populated with winners
    const parentSlot = slots.find((s: any) => s.roundNumber === 2);
    expect(parentSlot).toBeDefined();

    const parentSlotUpdated = await dataSource.getRepository(TournamentMatchSlotEntity).findOne({
      where: { id: parentSlot.id },
    });

    expect(parentSlotUpdated!.matchId).not.toBeNull();

    const finalMatch = await dataSource.getRepository(MatchEntity).findOne({
      where: { id: parentSlotUpdated!.matchId! },
    });

    expect(finalMatch).toBeDefined();
    expect(finalMatch!.player1Id).toBe(user1Id);
    expect(finalMatch!.player2Id).toBe(user3Id);
    expect(finalMatch!.status).toBe('PENDING_RESOURCE_ALLOCATION');

    // 6. Check Event Scores updated
    const leaderboards = await tournamentsController.getLeaderboard(tournamentId);
    expect(leaderboards).toHaveLength(4);

    const score1 = leaderboards.find((s: any) => s.userId === user1Id);
    expect(score1!.scoreValue).toBe(10); // Winner got 10 points

    const score2 = leaderboards.find((s: any) => s.userId === user2Id);
    expect(score2!.scoreValue).toBe(2); // Loser got 2 points
  });

  it('should process MatchFinalizedEvent and update standings in round-robin', async () => {
    const user1Id = randomUUID();
    const user2Id = randomUUID();
    const team1Id = randomUUID();
    const team2Id = randomUUID();

    // Seed Users & Team Rosters
    await dataSource.getRepository(UserEntity).save([
      {
        id: user1Id,
        nusp: '11112222',
        nickname: 'PlayerA',
        email: 'playera@usp.br',
        fullName: 'Player One',
        birthDate: new Date('2000-01-01'),
        pinHash: 'hashedpin',
        instituteId: randomUUID(),
        courseId: randomUUID(),
        availabilityStatus: 'AVAILABLE',
        isDeleted: false,
      },
      {
        id: user2Id,
        nusp: '22223333',
        nickname: 'PlayerB',
        email: 'playerb@usp.br',
        fullName: 'Player Two',
        birthDate: new Date('2000-01-01'),
        pinHash: 'hashedpin',
        instituteId: randomUUID(),
        courseId: randomUUID(),
        availabilityStatus: 'AVAILABLE',
        isDeleted: false,
      },
    ]);

    await dataSource.getRepository(TeamRosterEntity).save([
      {
        teamId: team1Id,
        userId: user1Id,
        joinedAt: new Date(),
        status: 'ACTIVE',
        seedNumber: 1,
      },
      {
        teamId: team2Id,
        userId: user2Id,
        joinedAt: new Date(),
        status: 'ACTIVE',
        seedNumber: 2,
      },
    ]);

    const tournamentsController = moduleFixture.get(TournamentsController);

    const result = await tournamentsController.createTournament({
      name: 'Round Robin Test',
      format: 'ROUND_ROBIN',
      gameType: 'PINGPONG',
      registrationStartTime: new Date().toISOString(),
      registrationEndTime: new Date().toISOString(),
      participantIds: [team1Id, team2Id],
    });

    const tournamentId = result.tournamentId;

    const { matches } = await tournamentsController.getBracket(tournamentId);
    expect(matches).toHaveLength(1);

    // Finalize match: user1 beats user2 11 to 9
    eventBus.publish(
      new MatchFinalizedEvent(
        matches[0].id,
        'PINGPONG' as any,
        user1Id,
        user2Id,
        11,
        9,
        user1Id,
      ),
    );

    // Wait a brief moment
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Get standings
    const standings = await tournamentsController.getStandings(tournamentId);
    expect(standings).toHaveLength(2);

    const standing1 = standings.find((s: any) => s.teamId === team1Id);
    expect(standing1!.points).toBe(3);
    expect(standing1!.matchesWon).toBe(1);
    expect(standing1!.scoreDifferential).toBe(2);

    const standing2 = standings.find((s: any) => s.teamId === team2Id);
    expect(standing2!.points).toBe(0);
    expect(standing2!.matchesLost).toBe(1);
    expect(standing2!.scoreDifferential).toBe(-2);
  });
});
