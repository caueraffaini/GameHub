// src/modules/matchmaking/test/integration/matchmaking.integration-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { io, Socket as ClientSocket } from 'socket.io-client';
import * as RedisMock from 'ioredis-mock';
import { REDIS_CLIENT, REDIS_SUBSCRIBER } from '../../adapters/redis/RedisModule';
import { MatchmakingModule } from '../../matchmaking.module';
import { UserEntity } from '../../../identity/adapters/persistence/User.entity';
import { TeamEntity } from '../../../identity/adapters/persistence/Team.entity';
import { TeamRosterEntity } from '../../../identity/adapters/persistence/TeamRoster.entity';
import { PlayAreaEntity } from '../../../facilities/adapters/persistence/PlayArea.entity';
import { PlayAreaReservationEntity } from '../../../facilities/adapters/persistence/PlayAreaReservation.entity';
import { PlayAreaSupportedGameEntity } from '../../../facilities/adapters/persistence/PlayAreaSupportedGame.entity';
import { MatchEntity } from '../../adapters/persistence/Match.entity';
import { MatchmakingTicketEntity } from '../../adapters/persistence/MatchmakingTicket.entity';
import { DeviceTokenEntity } from '../../adapters/persistence/DeviceToken.entity';
import { IUserRepositoryPort, IUserRepositoryPortToken } from '../../../identity/ports/outbound/IUserRepositoryPort';
import { ITicketRepositoryPort, ITicketRepositoryPortToken } from '../../ports/outbound/ITicketRepositoryPort';
import { IMatchRepositoryPort, IMatchRepositoryPortToken } from '../../ports/outbound/IMatchRepositoryPort';
import { IPlayAreaReservationRepositoryPort, IPlayAreaReservationRepositoryPortToken } from '../../../facilities/ports/outbound/IPlayAreaReservationRepositoryPort';
import { IDeviceTokenRepositoryPort, IDeviceTokenRepositoryPortToken } from '../../ports/outbound/IDeviceTokenRepositoryPort';
import { INotificationServicePortToken } from '../../ports/outbound/INotificationServicePort';
import { IForfeitMatchUseCaseToken } from '../../ports/inbound/IForfeitMatchUseCase';
import { HeartbeatTimeoutProcessor } from '../../adapters/workers/HeartbeatTimeoutProcessor';
import { Job } from 'bullmq';

describe('Matchmaking & Realtime Integration Tests', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let redisClientMock: any;
  let redisSubscriberMock: any;
  let mockQueue: any;
  let userPort: IUserRepositoryPort;
  let ticketPort: ITicketRepositoryPort;
  let matchPort: IMatchRepositoryPort;
  let reservationPort: IPlayAreaReservationRepositoryPort;
  let deviceTokenPort: IDeviceTokenRepositoryPort;
  let notificationPortMock: any;
  let forfeitMatchUseCaseMock: any;
  let heartbeatProcessor: HeartbeatTimeoutProcessor;

  beforeAll(async () => {
    // 1. Create mock Redis client and subscriber using ioredis-mock
    redisClientMock = new RedisMock();
    redisSubscriberMock = new RedisMock();

    // 2. Create mock BullMQ queue
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job_id' }),
    };

    // 3. Create other mocks
    notificationPortMock = {
      sendPush: jest.fn().mockResolvedValue(undefined),
    };
    forfeitMatchUseCaseMock = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    moduleFixture = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [
            UserEntity,
            TeamEntity,
            TeamRosterEntity,
            PlayAreaEntity,
            PlayAreaReservationEntity,
            PlayAreaSupportedGameEntity,
            MatchEntity,
            MatchmakingTicketEntity,
            DeviceTokenEntity,
          ],
          synchronize: true,
          logging: false,
        }),
        BullModule.forRoot({
          connection: redisClientMock,
        }),
        MatchmakingModule,
      ],
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue(redisClientMock)
      .overrideProvider(REDIS_SUBSCRIBER)
      .useValue(redisSubscriberMock)
      .overrideProvider(getQueueToken('heartbeat-timeout-handler'))
      .useValue(mockQueue)
      .overrideProvider(INotificationServicePortToken)
      .useValue(notificationPortMock)
      .overrideProvider(IForfeitMatchUseCaseToken)
      .useValue(forfeitMatchUseCaseMock)
      .overrideProvider(HeartbeatTimeoutProcessor)
      .useValue({ process: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0);

    userPort = moduleFixture.get<IUserRepositoryPort>(IUserRepositoryPortToken);
    ticketPort = moduleFixture.get<ITicketRepositoryPort>(ITicketRepositoryPortToken);
    matchPort = moduleFixture.get<IMatchRepositoryPort>(IMatchRepositoryPortToken);
    reservationPort = moduleFixture.get<IPlayAreaReservationRepositoryPort>(IPlayAreaReservationRepositoryPortToken);
    deviceTokenPort = moduleFixture.get<IDeviceTokenRepositoryPort>(IDeviceTokenRepositoryPortToken);
    
    heartbeatProcessor = new HeartbeatTimeoutProcessor(
      userPort,
      ticketPort,
      matchPort,
      reservationPort,
      deviceTokenPort,
      notificationPortMock,
      forfeitMatchUseCaseMock,
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WebSocket Gateway /match', () => {
    let clientSocket: ClientSocket;
    const testUserId = 'user-123-abc';

    beforeEach((done) => {
      const address = app.getHttpServer().address();
      const port = (address as any).port;
      clientSocket = io(`http://localhost:${port}/match`, {
        query: { userId: testUserId },
        transports: ['websocket'],
      });
      clientSocket.on('connect', done);
    });

    afterEach(() => {
      if (clientSocket.connected) {
        clientSocket.disconnect();
      }
    });

    it('should set heartbeat in Redis on heartbeat event', (done) => {
      clientSocket.emit('heartbeat');
      setTimeout(async () => {
        const val = await redisClientMock.get(`gamehub:heartbeat:${testUserId}`);
        expect(val).toBe('1');
        done();
      }, 100);
    });

    it('should set extended heartbeat in Redis on minimize_presence event', (done) => {
      clientSocket.emit('minimize_presence');
      setTimeout(async () => {
        const val = await redisClientMock.get(`gamehub:heartbeat:${testUserId}`);
        expect(val).toBe('1');
        done();
      }, 100);
    });
  });

  describe('HeartbeatKeyspaceSubscriber', () => {
    it('should enqueue job in BullMQ on keyspace expired event for heartbeat key', () => {
      // Find the message listener registered by the subscriber
      const listeners = redisSubscriberMock.listeners('message');
      expect(listeners.length).toBeGreaterThan(0);

      // Trigger message event manually to simulate keyspace expiration notification
      listeners[0]('__keyevent@0__:expired', 'gamehub:heartbeat:user-456-expired');

      expect(mockQueue.add).toHaveBeenCalledWith('timeout', {
        userId: 'user-456-expired',
      });
    });
  });

  describe('HeartbeatTimeoutProcessor', () => {
    it('should update user to OFFLINE, cancel active tickets, forfeit match, cancel reservation, and send push', async () => {
      const userId = 'user-789-timeout';

      // 1. Spies/Mocks on repositories and ports
      const updateStatusSpy = jest.spyOn(userPort, 'updateStatus').mockResolvedValue(undefined);
      const cancelActiveByUserSpy = jest.spyOn(ticketPort, 'cancelActiveByUser').mockResolvedValue(undefined);
      const findActiveByUserSpy = jest.spyOn(matchPort, 'findActiveByUser').mockResolvedValue({
        id: 'match-111',
        playAreaReservationId: 'res-222',
        player1Id: userId,
        player2Id: 'user-999-other',
        gameType: 'BOLA_8',
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        endedAt: null,
      } as any);
      const cancelUpcomingByUserSpy = jest.spyOn(reservationPort, 'cancelUpcomingByUser').mockResolvedValue(undefined);
      const findDeviceTokensSpy = jest.spyOn(deviceTokenPort, 'findByUser').mockResolvedValue([
        { userId, tokenString: 'push-token-1', platform: 'IOS' },
        { userId, tokenString: 'push-token-2', platform: 'ANDROID' },
      ]);

      // 2. Build mock Job
      const mockJob = {
        data: { userId },
      } as Job<{ userId: string }>;

      // 3. Process
      await heartbeatProcessor.process(mockJob);

      // 4. Verifications
      expect(updateStatusSpy).toHaveBeenCalledWith(userId, 'OFFLINE');
      expect(cancelActiveByUserSpy).toHaveBeenCalledWith(userId);
      expect(findActiveByUserSpy).toHaveBeenCalledWith(userId);
      expect(forfeitMatchUseCaseMock.execute).toHaveBeenCalledWith({
        matchId: 'match-111',
        forfeitingUserId: userId,
      });
      expect(cancelUpcomingByUserSpy).toHaveBeenCalledWith(userId);
      expect(findDeviceTokensSpy).toHaveBeenCalledWith(userId);
      expect(notificationPortMock.sendPush).toHaveBeenCalledTimes(2);
      expect(notificationPortMock.sendPush).toHaveBeenNthCalledWith(
        1,
        'push-token-1',
        'IOS',
        {
          event: 'HEARTBEAT_EXPIRED',
          matchId: 'match-111',
          priority: 'HIGH',
        },
      );
      expect(notificationPortMock.sendPush).toHaveBeenNthCalledWith(
        2,
        'push-token-2',
        'ANDROID',
        {
          event: 'HEARTBEAT_EXPIRED',
          matchId: 'match-111',
          priority: 'HIGH',
        },
      );
    });
  });
});
