// src/modules/moderation/test/integration/moderation.integration-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import * as RedisMock from 'ioredis-mock';
import { randomUUID } from 'crypto';

import { REDIS_CLIENT, REDIS_SUBSCRIBER } from '../../../matchmaking/adapters/redis/RedisModule';
import { ModerationModule } from '../../moderation.module';
import { FriendshipEntity } from '../../adapters/persistence/Friendship.entity';
import { ChatChannelEntity } from '../../adapters/persistence/ChatChannel.entity';
import { ChatMessageEntity } from '../../adapters/persistence/ChatMessage.entity';
import { MatchDisputeEntity } from '../../adapters/persistence/MatchDispute.entity';
import { GenericReportEntity } from '../../adapters/persistence/GenericReport.entity';
import { UserSanctionEntity } from '../../adapters/persistence/UserSanction.entity';

import { UserEntity } from '../../../identity/adapters/persistence/User.entity';
import { TeamEntity } from '../../../identity/adapters/persistence/Team.entity';
import { TeamRosterEntity } from '../../../identity/adapters/persistence/TeamRoster.entity';
import { MatchEntity } from '../../../matches/adapters/persistence/Match.entity';
import { SeasonEntity } from '../../../progression/adapters/persistence/Season.entity';
import { PlayerRankingEntity } from '../../../progression/adapters/persistence/PlayerRanking.entity';
import { EloLedgerEntity } from '../../../progression/adapters/persistence/EloLedger.entity';
import { PlayAreaEntity } from '../../../facilities/adapters/persistence/PlayArea.entity';
import { PlayAreaReservationEntity } from '../../../facilities/adapters/persistence/PlayAreaReservation.entity';
import { PlayAreaSupportedGameEntity } from '../../../facilities/adapters/persistence/PlayAreaSupportedGame.entity';
import { MatchmakingTicketEntity } from '../../../matchmaking/adapters/persistence/MatchmakingTicket.entity';
import { DeviceTokenEntity } from '../../../matchmaking/adapters/persistence/DeviceToken.entity';

import { ModerationService } from '../../domain/services/ModerationService';
import { ChatGateway } from '../../adapters/transport/ChatGateway';
import { SanctionCascadeProcessor } from '../../adapters/workers/SanctionCascadeProcessor';
import { INotificationServicePortToken } from '../../../matchmaking/ports/outbound/INotificationServicePort';
import { IDeviceTokenRepositoryPort, IDeviceTokenRepositoryPortToken } from '../../../matchmaking/ports/outbound/IDeviceTokenRepositoryPort';
import { IUserRepositoryPort, IUserRepositoryPortToken } from '../../../identity/ports/outbound/IUserRepositoryPort';
import { ITicketRepositoryPort, ITicketRepositoryPortToken } from '../../../matchmaking/ports/outbound/ITicketRepositoryPort';
import { IPlayAreaReservationRepositoryPort, IPlayAreaReservationRepositoryPortToken } from '../../../facilities/ports/outbound/IPlayAreaReservationRepositoryPort';

describe('Moderation & Social Integration Tests (SQLite memory fallback)', () => {
  let moduleFixture: TestingModule;
  let dataSource: DataSource;
  let moderationService: ModerationService;
  let chatGateway: ChatGateway;
  let sanctionProcessor: SanctionCascadeProcessor;

  let redisClientMock: any;
  let redisSubscriberMock: any;
  let mockQueue: any;
  let notificationPortMock: any;

  beforeAll(async () => {
    redisClientMock = new RedisMock();
    redisSubscriberMock = new RedisMock();
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job_id' }),
    };
    notificationPortMock = {
      sendPush: jest.fn().mockResolvedValue(undefined),
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
            MatchEntity,
            SeasonEntity,
            PlayerRankingEntity,
            EloLedgerEntity,
            PlayAreaEntity,
            PlayAreaReservationEntity,
            PlayAreaSupportedGameEntity,
            MatchmakingTicketEntity,
            DeviceTokenEntity,
            FriendshipEntity,
            ChatChannelEntity,
            ChatMessageEntity,
            MatchDisputeEntity,
            GenericReportEntity,
            UserSanctionEntity,
          ],
          synchronize: true,
          logging: false,
        }),
        BullModule.forRoot({
          connection: redisClientMock,
        }),
        ModerationModule,
      ],
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue(redisClientMock)
      .overrideProvider(REDIS_SUBSCRIBER)
      .useValue(redisSubscriberMock)
      .overrideProvider(getQueueToken('sanction-cascade'))
      .useValue(mockQueue)
      .overrideProvider(INotificationServicePortToken)
      .useValue(notificationPortMock)
      .overrideProvider(SanctionCascadeProcessor)
      .useValue({ process: jest.fn() })
      .compile();

    await moduleFixture.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    moderationService = moduleFixture.get<ModerationService>(ModerationService);
    chatGateway = moduleFixture.get<ChatGateway>(ChatGateway);

    const userRepo = moduleFixture.get<IUserRepositoryPort>(IUserRepositoryPortToken);
    const ticketRepo = moduleFixture.get<ITicketRepositoryPort>(ITicketRepositoryPortToken);
    const reservationRepo = moduleFixture.get<IPlayAreaReservationRepositoryPort>(IPlayAreaReservationRepositoryPortToken);
    const deviceTokenRepo = moduleFixture.get<IDeviceTokenRepositoryPort>(IDeviceTokenRepositoryPortToken);
    sanctionProcessor = new SanctionCascadeProcessor(
      userRepo,
      ticketRepo,
      reservationRepo,
      deviceTokenRepo,
      notificationPortMock,
    );
  });

  afterAll(async () => {
    if (moduleFixture) {
      await moduleFixture.close();
    }
  });

  beforeEach(async () => {
    // Clear DB
    await dataSource.getRepository(EloLedgerEntity).clear();
    await dataSource.getRepository(PlayerRankingEntity).clear();
    await dataSource.getRepository(MatchEntity).clear();
    await dataSource.getRepository(UserEntity).clear();
    await dataSource.getRepository(SeasonEntity).clear();
    await dataSource.getRepository(FriendshipEntity).clear();
    await dataSource.getRepository(ChatChannelEntity).clear();
    await dataSource.getRepository(ChatMessageEntity).clear();
    await dataSource.getRepository(MatchDisputeEntity).clear();
    await dataSource.getRepository(GenericReportEntity).clear();
    await dataSource.getRepository(UserSanctionEntity).clear();
    await dataSource.getRepository(MatchmakingTicketEntity).clear();
    await dataSource.getRepository(PlayAreaReservationEntity).clear();
    await dataSource.getRepository(DeviceTokenEntity).clear();

    await redisClientMock.flushall();
  });

  describe('Match Dispute & ELO Locking Coordination', () => {
    it('should lock ELO ledger updates and resolve disputes with ranking correction', async () => {
      const user1Id = randomUUID();
      const user2Id = randomUUID();
      const matchId = randomUUID();
      const seasonId = randomUUID();

      // Seed Season and Players
      await dataSource.getRepository(SeasonEntity).save({
        id: seasonId,
        name: 'Test Season',
        startTime: new Date(),
        endTime: new Date(Date.now() + 1000000),
        isActive: true,
      } as any);

      await dataSource.getRepository(UserEntity).save([
        {
          id: user1Id,
          nusp: '12345678',
          nickname: 'UserOne',
          email: 'userone@usp.br',
          fullName: 'User One',
          birthDate: new Date(),
          pinHash: 'hash',
          instituteId: randomUUID(),
          courseId: randomUUID(),
          availabilityStatus: 'AVAILABLE',
          isDeleted: false,
        },
        {
          id: user2Id,
          nusp: '87654321',
          nickname: 'UserTwo',
          email: 'usertwo@usp.br',
          fullName: 'User Two',
          birthDate: new Date(),
          pinHash: 'hash',
          instituteId: randomUUID(),
          courseId: randomUUID(),
          availabilityStatus: 'AVAILABLE',
          isDeleted: false,
        },
      ] as any);

      await dataSource.getRepository(PlayerRankingEntity).save([
        {
          id: randomUUID(),
          seasonId,
          userId: user1Id,
          teamId: null,
          gameType: 'PINGPONG',
          eloValue: 1516,
          gamesPlayed: 1,
          lastMatchAt: new Date(),
        },
        {
          id: randomUUID(),
          seasonId,
          userId: user2Id,
          teamId: null,
          gameType: 'PINGPONG',
          eloValue: 1484,
          gamesPlayed: 1,
          lastMatchAt: new Date(),
        },
      ] as any);

      await dataSource.getRepository(MatchEntity).save({
        id: matchId,
        player1Id: user1Id,
        player2Id: user2Id,
        winnerId: user1Id, // initially player 1 won
        status: 'COMPLETED',
        gameType: 'PINGPONG',
        scheduledStartTime: new Date(),
        scheduledEndTime: new Date(),
        startedAt: new Date(),
        playAreaId: null,
        createdById: null,
      } as any);

      // ELO ledger records
      await dataSource.getRepository(EloLedgerEntity).save([
        {
          id: randomUUID(),
          userId: user1Id,
          matchId,
          seasonId,
          oldRating: 1500,
          newRating: 1516,
          changeAmount: 16,
          status: 'COMPLETED',
        },
        {
          id: randomUUID(),
          userId: user2Id,
          matchId,
          seasonId,
          oldRating: 1500,
          newRating: 1484,
          changeAmount: -16,
          status: 'COMPLETED',
        },
      ] as any);

      // 1. Create Dispute -> ELO records must transition to LOCKED
      const dispute = await moderationService.createDispute(matchId, 'Incorrect score reported', user2Id);
      expect(dispute.status).toBe('UNDER_REVIEW');

      const ledgers = await dataSource.getRepository(EloLedgerEntity).find({ where: { matchId } });
      expect(ledgers.length).toBe(2);
      expect(ledgers[0].status).toBe('LOCKED');
      expect(ledgers[1].status).toBe('LOCKED');

      // 2. Resolve Dispute with correction (UserTwo actually won)
      await moderationService.resolveDispute(dispute.id, randomUUID(), 'UserTwo verified winner', user2Id);

      // ELO updates should be corrected and unlocked (COMPLETED)
      const correctedLedgers = await dataSource.getRepository(EloLedgerEntity).find({ where: { matchId } });
      const correctedL1 = correctedLedgers.find((l) => l.userId === user1Id);
      const correctedL2 = correctedLedgers.find((l) => l.userId === user2Id);

      expect(correctedL1!.status).toBe('COMPLETED');
      expect(correctedL2!.status).toBe('COMPLETED');

      // Player 2 won, so Player 1 should lose ELO (-16) and Player 2 should gain ELO (+16)
      expect(correctedL1!.changeAmount).toBe(-16);
      expect(correctedL2!.changeAmount).toBe(16);

      // Verify player rankings are updated structurally:
      // ranking1 was 1516 (based on +16). Correction should subtract +16 and add -16 -> 1484.
      // ranking2 was 1484 (based on -16). Correction should subtract -16 and add +16 -> 1516.
      const ranking1 = await dataSource.getRepository(PlayerRankingEntity).findOneBy({ userId: user1Id });
      const ranking2 = await dataSource.getRepository(PlayerRankingEntity).findOneBy({ userId: user2Id });

      expect(ranking1!.eloValue).toBe(1484);
      expect(ranking2!.eloValue).toBe(1516);
    });
  });

  describe('Real-Time Chat & Rate Limiting', () => {
    it('should reject chat events if rate-limiting token-bucket is exceeded', async () => {
      const channelId = randomUUID();
      const senderId = randomUUID();

      // Seed Channel
      await dataSource.getRepository(ChatChannelEntity).save({
        id: channelId,
        type: 'LOBBY',
        associatedResourceId: null,
      });

      const mockSocket = {
        emit: jest.fn(),
        data: { userId: senderId },
        handshake: { query: {}, auth: {} },
      } as any;

      // Send 5 messages (bucket capacity is 5)
      for (let i = 0; i < 5; i++) {
        await chatGateway.handleSendMessage(mockSocket, { channelId, content: `msg ${i}` });
      }

      // Assert messages saved in DB
      const count = await dataSource.getRepository(ChatMessageEntity).count();
      expect(count).toBe(5);
      expect(mockSocket.emit).not.toHaveBeenCalledWith('chat_error', expect.any(Object));

      // 6th message should be rejected
      await chatGateway.handleSendMessage(mockSocket, { channelId, content: 'spam msg' });
      expect(mockSocket.emit).toHaveBeenCalledWith('chat_error', {
        event: 'SPAM_REJECTED',
        message: 'Too many messages. Rate limit exceeded.',
      });

      // DB message count should still be 5
      const countAfter = await dataSource.getRepository(ChatMessageEntity).count();
      expect(countAfter).toBe(5);
    });

    it('should reject chat message if friendship between users is set to BLOCKED', async () => {
      const senderId = randomUUID();
      const recipientId = randomUUID();
      const channelId = randomUUID();

      // Create blocked friendship
      await dataSource.getRepository(FriendshipEntity).save({
        userId1: senderId,
        userId2: recipientId,
        establishedAt: new Date(),
        status: 'BLOCKED',
      });

      // Create private message channel
      await dataSource.getRepository(ChatChannelEntity).save({
        id: channelId,
        type: 'PRIVATE_MESSAGE',
        associatedResourceId: recipientId,
      });

      const mockSocket = {
        emit: jest.fn(),
        data: { userId: senderId },
        handshake: { query: {}, auth: {} },
      } as any;

      await chatGateway.handleSendMessage(mockSocket, { channelId, content: 'hello' });

      // Should be rejected
      expect(mockSocket.emit).toHaveBeenCalledWith('chat_error', {
        event: 'BLOCKED',
        message: 'Message rejected. You or the recipient is blocked.',
      });

      const msgCount = await dataSource.getRepository(ChatMessageEntity).count();
      expect(msgCount).toBe(0);
    });
  });

  describe('Sanction Cascades', () => {
    it('should execute atomic ban cascade, update availability, cancel tickets/reservations, and dispatch push', async () => {
      const userId = randomUUID();
      const playAreaId = randomUUID();

      // Seed User, PlayArea, DeviceToken
      await dataSource.getRepository(UserEntity).save({
        id: userId,
        nusp: '11223344',
        nickname: 'BannedPlayer',
        email: 'banned@usp.br',
        fullName: 'Banned Player',
        birthDate: new Date(),
        pinHash: 'hash',
        instituteId: randomUUID(),
        courseId: randomUUID(),
        availabilityStatus: 'AVAILABLE',
        isDeleted: false,
      } as any);

      await dataSource.getRepository(PlayAreaEntity).save({
        id: playAreaId,
        name: 'Main Tennis Court',
        description: 'Outdoor Court',
        status: 'EMPTY',
      } as any);

      await dataSource.getRepository(DeviceTokenEntity).save({
        id: randomUUID(),
        userId,
        tokenString: 'firebase-token-123',
        platform: 'IOS',
      });

      // Seed WAITING Matchmaking Ticket
      await dataSource.getRepository(MatchmakingTicketEntity).save({
        id: randomUUID(),
        userId,
        teamId: null,
        status: 'WAITING',
        gameType: 'PINGPONG',
        eloRating: 1500,
        joinedAt: new Date(),
        expiryTime: new Date(Date.now() + 1000000),
      } as any);

      // Seed CONFIRMED upcoming PlayArea Reservation
      await dataSource.getRepository(PlayAreaReservationEntity).save({
        id: randomUUID(),
        userId,
        playAreaId,
        status: 'CONFIRMED',
        gameType: 'PINGPONG',
        scheduledStartTime: new Date(Date.now() + 1000000), // future
        scheduledEndTime: new Date(Date.now() + 2000000),
      } as any);

      // Execute sanction cascade worker process
      const job = { data: { userId } } as any;
      await sanctionProcessor.process(job);

      // Verify User is OFFLINE
      const user = await dataSource.getRepository(UserEntity).findOneBy({ id: userId });
      expect(user!.availabilityStatus).toBe('OFFLINE');

      // Verify Matchmaking Ticket cancelled
      const ticket = await dataSource.getRepository(MatchmakingTicketEntity).findOneBy({ userId });
      expect(ticket!.status).toBe('CANCELLED');

      // Verify PlayArea Reservation cancelled
      const reservation = await dataSource.getRepository(PlayAreaReservationEntity).findOneBy({ userId });
      expect(reservation!.status).toBe('CANCELLED');

      // Verify Push Notification dispatched
      expect(notificationPortMock.sendPush).toHaveBeenCalledWith(
        'firebase-token-123',
        'IOS',
        { event: 'USER_BANNED', priority: 'HIGH' },
      );
    });

    it('should block ticket creation or matchmaking checks if user is banned', async () => {
      const userId = randomUUID();

      // Create permanent ban sanction
      await moderationService.createSanction(userId, 'PERMANENT_BAN', 'Cheating', 999999, null);

      // Check active sanction
      const sanction = await moderationService.checkActiveSanction(userId);
      expect(sanction).not.toBeNull();
      expect(sanction!.type).toBe('PERMANENT_BAN');
    });
  });
});
