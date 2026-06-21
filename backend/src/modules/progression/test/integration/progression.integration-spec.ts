// src/modules/progression/test/integration/progression.integration-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventModule } from '../../../../shared/events/EventModule';
import { EventBus } from '../../../../shared/events/EventBus';
import { ProgressionModule } from '../../progression.module';
import { SeasonEntity } from '../../adapters/persistence/Season.entity';
import { PlayerRankingEntity } from '../../adapters/persistence/PlayerRanking.entity';
import { EloLedgerEntity } from '../../adapters/persistence/EloLedger.entity';
import { UserEntity } from '../../../identity/adapters/persistence/User.entity';
import { TeamEntity } from '../../../identity/adapters/persistence/Team.entity';
import { TeamRosterEntity } from '../../../identity/adapters/persistence/TeamRoster.entity';
import { MatchEntity } from '../../../matches/adapters/persistence/Match.entity';
import { MatchFinalizedEvent } from '../../../matches/domain/events/MatchFinalizedEvent';
import { randomUUID } from 'crypto';

describe('Progression & ELO Transactional Integration Tests (SQLite Fallback)', () => {
  let moduleFixture: TestingModule;
  let dataSource: DataSource;
  let eventBus: EventBus;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [
            SeasonEntity,
            PlayerRankingEntity,
            EloLedgerEntity,
            UserEntity,
            TeamEntity,
            TeamRosterEntity,
            MatchEntity,
          ],
          synchronize: true,
          logging: false,
        }),
        EventModule,
        ProgressionModule,
      ],
    }).compile();

    await moduleFixture.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    eventBus = moduleFixture.get<EventBus>(EventBus);
  });

  afterAll(async () => {
    if (moduleFixture) {
      await moduleFixture.close();
    }
  });

  beforeEach(async () => {
    // Clear databases
    await dataSource.getRepository(EloLedgerEntity).clear();
    await dataSource.getRepository(PlayerRankingEntity).clear();
    await dataSource.getRepository(SeasonEntity).clear();
    await dataSource.getRepository(UserEntity).clear();
  });

  it('should process MatchFinalizedEvent and update rankings atomically in transaction', async () => {
    const user1Id = randomUUID();
    const user2Id = randomUUID();

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
    ]);

    // 2. Publish match finalized event (User 1 wins against User 2)
    const matchId = randomUUID();
    eventBus.publish(
      new MatchFinalizedEvent(
        matchId,
        'BOLA_8',
        user1Id,
        user2Id,
        11,
        5,
        user1Id,
        null,
      ),
    );

    // Give asynchronous subscription handler time to execute
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 3. Verify PlayerRankings are created with correct ELO updates
    const rankings = await dataSource.getRepository(PlayerRankingEntity).find();
    expect(rankings).toHaveLength(2);

    const r1 = rankings.find((r) => r.userId === user1Id);
    const r2 = rankings.find((r) => r.userId === user2Id);

    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
    expect(r1!.eloValue).toBe(1516); // 1500 + 16 ELO
    expect(r2!.eloValue).toBe(1484); // 1500 - 16 ELO
    expect(r1!.gamesPlayed).toBe(1);
    expect(r2!.gamesPlayed).toBe(1);

    // 4. Verify EloLedger has immutable trace records
    const ledgers = await dataSource.getRepository(EloLedgerEntity).find();
    expect(ledgers).toHaveLength(2);

    const l1 = ledgers.find((l) => l.userId === user1Id);
    const l2 = ledgers.find((l) => l.userId === user2Id);

    expect(l1).toBeDefined();
    expect(l1!.oldRating).toBe(1500);
    expect(l1!.newRating).toBe(1516);
    expect(l1!.changeAmount).toBe(16);
    expect(l1!.matchId).toBe(matchId);

    expect(l2).toBeDefined();
    expect(l2!.oldRating).toBe(1500);
    expect(l2!.newRating).toBe(1484);
    expect(l2!.changeAmount).toBe(-16);
    expect(l2!.matchId).toBe(matchId);
  });

  it('should process concurrent MatchFinalizedEvents sequentially and safely', async () => {
    const user1Id = randomUUID();
    const user2Id = randomUUID();

    await dataSource.getRepository(UserEntity).save([
      {
        id: user1Id,
        nusp: '12121212',
        nickname: 'PlayerX',
        email: 'playerx@usp.br',
        fullName: 'Player X',
        birthDate: new Date('2000-01-01'),
        pinHash: 'hashedpin',
        instituteId: randomUUID(),
        courseId: randomUUID(),
        availabilityStatus: 'AVAILABLE',
        isDeleted: false,
      },
      {
        id: user2Id,
        nusp: '34343434',
        nickname: 'PlayerY',
        email: 'playery@usp.br',
        fullName: 'Player Y',
        birthDate: new Date('2000-01-01'),
        pinHash: 'hashedpin',
        instituteId: randomUUID(),
        courseId: randomUUID(),
        availabilityStatus: 'AVAILABLE',
        isDeleted: false,
      },
    ]);

    // Publish three match finalizations concurrently for the same two players
    eventBus.publish(new MatchFinalizedEvent(randomUUID(), 'PINGPONG', user1Id, user2Id, 11, 8, user1Id, null));
    eventBus.publish(new MatchFinalizedEvent(randomUUID(), 'PINGPONG', user1Id, user2Id, 11, 7, user1Id, null));
    eventBus.publish(new MatchFinalizedEvent(randomUUID(), 'PINGPONG', user1Id, user2Id, 11, 9, user1Id, null));

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify PlayerRankings values are updated sequentially
    const rankings = await dataSource.getRepository(PlayerRankingEntity).find();
    const r1 = rankings.find((r) => r.userId === user1Id);
    const r2 = rankings.find((r) => r.userId === user2Id);

    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
    // After 3 consecutive wins, Player 1's ELO should be 1500 -> 1516 -> 1531 -> 1545 (or similar depending on changing odds)
    expect(r1!.gamesPlayed).toBe(3);
    expect(r2!.gamesPlayed).toBe(3);
    expect(r1!.eloValue).toBeGreaterThan(1500);
    expect(r2!.eloValue).toBeLessThan(1500);

    // Verify EloLedger entries are strictly appended as immutable rows
    const ledgers = await dataSource.getRepository(EloLedgerEntity).find();
    expect(ledgers).toHaveLength(6); // 2 players * 3 matches
  });
});
