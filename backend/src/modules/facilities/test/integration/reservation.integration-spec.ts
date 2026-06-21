import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { StartedTestContainer } from 'testcontainers';
import { FacilitiesModule } from '../../facilities.module';
import { ReservationService } from '../../domain/services/ReservationService';
import { PlayAreaEntity } from '../../adapters/persistence/PlayArea.entity';
import { PlayAreaReservationEntity } from '../../adapters/persistence/PlayAreaReservation.entity';
import { PlayAreaSupportedGameEntity } from '../../adapters/persistence/PlayAreaSupportedGame.entity';
import { UserEntity } from '../../../identity/adapters/persistence/User.entity';
import { TeamEntity } from '../../../identity/adapters/persistence/Team.entity';
import { TeamRosterEntity } from '../../../identity/adapters/persistence/TeamRoster.entity';
import { IPlayAreaRepositoryPort, IPlayAreaRepositoryPortToken } from '../../ports/outbound/IPlayAreaRepositoryPort';
import { PlayArea } from '../../domain/models/PlayArea';
import { User } from '../../../identity/domain/models/User';
import { IUserRepositoryPort, IUserRepositoryPortToken } from '../../../identity/ports/outbound/IUserRepositoryPort';
import { IdentityModule } from '../../../identity/identity.module';
import { ConflictException } from '@nestjs/common';
import { IReservationUseCaseToken } from '../../ports/inbound/IReservationUseCase';
import { OptimisticLockException } from '../../domain/exceptions/OptimisticLockException';

describe('Facilities & Reservations Integration Test (Testcontainers PG / SQLite Fallback)', () => {
  jest.setTimeout(60000); // Concurrency and containers can take time
  
  let moduleFixture: TestingModule;
  let service: ReservationService;
  let playAreaPort: IPlayAreaRepositoryPort;
  let userPort: IUserRepositoryPort;
  
  let container: StartedTestContainer | null = null;
  let playAreaRepo: Repository<PlayAreaEntity>;
  let userRepo: Repository<UserEntity>;

  beforeAll(async () => {
    let connectionOptions: any;

    try {
      const { GenericContainer } = await import('testcontainers');
      // Attempt to initialize PostgreSQL Testcontainer
      console.log('Attempting to initialize Testcontainers PostgreSQL...');
      container = await new GenericContainer('postgres:15-alpine')
        .withEnvironment({
          POSTGRES_DB: 'gamehub_test',
          POSTGRES_USER: 'test_user',
          POSTGRES_PASSWORD: 'test_password',
        })
        .withExposedPorts(5432)
        .start();

      const port = container.getMappedPort(5432);
      const host = container.getHost();
      console.log(`Testcontainers PostgreSQL started at ${host}:${port}`);

      connectionOptions = {
        type: 'postgres',
        host,
        port,
        username: 'test_user',
        password: 'test_password',
        database: 'gamehub_test',
        entities: [
          PlayAreaEntity,
          PlayAreaReservationEntity,
          PlayAreaSupportedGameEntity,
          UserEntity,
          TeamEntity,
          TeamRosterEntity,
        ],
        synchronize: true,
        logging: false,
      };
    } catch (err: any) {
      console.warn(
        `Docker or Testcontainers not available. Falling back to SQLite in-memory database. Error: ${err.message}`
      );
      connectionOptions = {
        type: 'sqlite',
        database: ':memory:',
        entities: [
          PlayAreaEntity,
          PlayAreaReservationEntity,
          PlayAreaSupportedGameEntity,
          UserEntity,
          TeamEntity,
          TeamRosterEntity,
        ],
        synchronize: true,
        logging: false,
      };
    }

    moduleFixture = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(connectionOptions),
        IdentityModule,
        FacilitiesModule,
      ],
    }).compile();

    service = moduleFixture.get<ReservationService>(IReservationUseCaseToken);
    playAreaPort = moduleFixture.get<IPlayAreaRepositoryPort>(IPlayAreaRepositoryPortToken);
    userPort = moduleFixture.get<IUserRepositoryPort>(IUserRepositoryPortToken);
    
    playAreaRepo = moduleFixture.get<Repository<PlayAreaEntity>>(getRepositoryToken(PlayAreaEntity));
    userRepo = moduleFixture.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
  });

  afterAll(async () => {
    if (moduleFixture) {
      await moduleFixture.close();
    }
    if (container) {
      await container.stop();
      console.log('Testcontainers PostgreSQL stopped.');
    }
  });

  beforeEach(async () => {
    // Clean database tables to ensure test isolation
    await playAreaRepo.query('DELETE FROM play_area_reservations;');
    await playAreaRepo.query('DELETE FROM play_area_supported_games;');
    await playAreaRepo.query('DELETE FROM play_areas;');
    await userRepo.query('DELETE FROM users;');
  });

  describe('Conflict Blocking & Validation', () => {
    let playArea: PlayArea;
    let user1: User;
    let user2: User;

    beforeEach(async () => {
      // Seed users
      user1 = new User({
        id: '11111111-1111-1111-1111-111111111111',
        nusp: '11111111',
        nickname: 'user1',
        email: 'user1@usp.br',
        fullName: 'User One',
        birthDate: new Date('2000-01-01'),
        instituteId: '77777777-7777-7777-7777-777777777777',
        courseId: '88888888-8888-8888-8888-888888888888',
        availabilityStatus: 'OFFLINE',
        isDeleted: false,
      });
      await user1.updatePin('1111');
      await userPort.save(user1);

      user2 = new User({
        id: '22222222-2222-2222-2222-222222222222',
        nusp: '22222222',
        nickname: 'user2',
        email: 'user2@usp.br',
        fullName: 'User Two',
        birthDate: new Date('2000-01-01'),
        instituteId: '77777777-7777-7777-7777-777777777777',
        courseId: '88888888-8888-8888-8888-888888888888',
        availabilityStatus: 'OFFLINE',
        isDeleted: false,
      });
      await user2.updatePin('2222');
      await userPort.save(user2);

      // Seed physical play area: Billiard Table supporting BOLA_8 and SNOOKER
      playArea = new PlayArea({
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Billiard Table 01',
        status: 'EMPTY',
        isActive: true,
        isVirtual: false,
        supportedGameTypes: ['BOLA_8', 'SNOOKER'],
      });
      await playAreaPort.save(playArea);
    });

    it('should successfully reserve a timeslot on a physical play area', async () => {
      const start = new Date();
      start.setHours(start.getHours() + 2); // 2 hours in future
      const end = new Date(start.getTime() + 3600000); // + 1 hour

      const reservation = await service.reserve(playArea.id, user1.id, 'BOLA_8', start, end);
      expect(reservation).toBeDefined();
      expect(reservation.status).toBe('CONFIRMED');
      expect(reservation.gameType).toBe('BOLA_8');
    });

    it('should block overlapping bookings on the same play area (Conflict Blocking Policy)', async () => {
      const start = new Date();
      start.setHours(start.getHours() + 3);
      const end = new Date(start.getTime() + 3600000);

      // Successful first booking
      await service.reserve(playArea.id, user1.id, 'BOLA_8', start, end);

      // Overlapping second booking for a different supported game (SNOOKER)
      const overlapStart = new Date(start.getTime() + 1800000); // 30 minutes offset
      const overlapEnd = new Date(overlapStart.getTime() + 3600000);

      await expect(
        service.reserve(playArea.id, user2.id, 'SNOOKER', overlapStart, overlapEnd),
      ).rejects.toThrow(ConflictException);
    });

    it('should block bookings within the 15-minute buffer padding window', async () => {
      const start = new Date();
      start.setHours(start.getHours() + 4);
      const end = new Date(start.getTime() + 3600000); // e.g. 14:00 - 15:00

      await service.reserve(playArea.id, user1.id, 'BOLA_8', start, end);

      // Attempt to book e.g. 15:10 - 16:10 (within 15 minute padding window: 15:00 - 15:15)
      const paddedStart = new Date(end.getTime() + 10 * 60 * 1000); // +10 minutes after end
      const paddedEnd = new Date(paddedStart.getTime() + 3600000);

      await expect(
        service.reserve(playArea.id, user2.id, 'BOLA_8', paddedStart, paddedEnd),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Optimistic Concurrency Control (OCC) & Serializable Race Conditions', () => {
    let playArea: PlayArea;
    let user1: User;

    beforeEach(async () => {
      user1 = new User({
        id: '11111111-1111-1111-1111-111111111111',
        nusp: '11111111',
        nickname: 'user1',
        email: 'user1@usp.br',
        fullName: 'User One',
        birthDate: new Date('2000-01-01'),
        instituteId: '77777777-7777-7777-7777-777777777777',
        courseId: '88888888-8888-8888-8888-888888888888',
        availabilityStatus: 'OFFLINE',
        isDeleted: false,
      });
      await user1.updatePin('1111');
      await userPort.save(user1);

      playArea = new PlayArea({
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Billiard Table 01',
        status: 'EMPTY',
        isActive: true,
        isVirtual: false,
        supportedGameTypes: ['BOLA_8'],
      });
      await playAreaPort.save(playArea);
    });

    it('should throw OptimisticLockException if expectedVersion is outdated (OCC check)', async () => {
      const start = new Date();
      start.setHours(start.getHours() + 5);
      const end = new Date(start.getTime() + 3600000);

      const dbPlayArea = await playAreaPort.findById(playArea.id);
      expect(dbPlayArea).toBeDefined();
      const currentVersion = dbPlayArea!.version!;

      // Attempt to save with an outdated version check
      await expect(
        service.reserve(playArea.id, user1.id, 'BOLA_8', start, end, currentVersion - 1),
      ).rejects.toThrow(OptimisticLockException);
    });

    it('should handle highly concurrent booking requests, permitting exactly one and throwing lock/conflict errors on others', async () => {
      const start = new Date();
      start.setHours(start.getHours() + 6);
      const end = new Date(start.getTime() + 3600000);

      const dbPlayArea = await playAreaPort.findById(playArea.id);
      const currentVersion = dbPlayArea!.version!;

      // Fire 5 concurrent reservation promises with a tiny staggered delay
      // to let one transaction establish its lock first in single-threaded SQLite.
      const promises = Array.from({ length: 5 }).map(async (_, index) => {
        if (index > 0) {
          await new Promise((resolve) => setTimeout(resolve, index * 10));
        }
        return service.reserve(playArea.id, user1.id, 'BOLA_8', start, end, currentVersion);
      });

      const results = await Promise.allSettled(promises);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Assert that exactly one reservation succeeded
      expect(fulfilled.length).toBe(1);
      
      // Assert that the rest failed due to either ConflictException or OptimisticLockException
      expect(rejected.length).toBe(4);
      rejected.forEach((r: any) => {
        expect(
          r.reason instanceof ConflictException || 
          r.reason instanceof OptimisticLockException
        ).toBe(true);
      });
    });
  });
});
