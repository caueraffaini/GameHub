import { OfficialTeam, TemporaryEventTeam, TeamRoster } from '../../domain/models/Team';
import { TeamManagementService } from '../../domain/services/TeamManagementService';
import { ITeamRepositoryPort } from '../../ports/outbound/ITeamRepositoryPort';
import { IUserRepositoryPort } from '../../ports/outbound/IUserRepositoryPort';
import { User } from '../../domain/models/User';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('Team & TeamRoster Core Domain Logic & Management Service', () => {
  describe('Domain Models', () => {
    it('should correctly instantiate OfficialTeam', () => {
      const team = new OfficialTeam({
        id: 'team-1',
        name: 'Official Team A',
        captainId: 'captain-1',
        instituteId: 'inst-1',
        isActiveCompetitionTeam: true,
      });

      expect(team.isActiveCompetitionTeam).toBe(true);
      expect(team.name).toBe('Official Team A');
    });

    it('should correctly verify TemporaryEventTeam expiration logic', () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 2);

      const activeTempTeam = new TemporaryEventTeam({
        id: 'temp-1',
        name: 'Temporary Team',
        captainId: 'captain-1',
        associatedEventId: 'event-1',
        expiresAt: futureDate,
      });

      const expiredTempTeam = new TemporaryEventTeam({
        id: 'temp-2',
        name: 'Expired Team',
        captainId: 'captain-2',
        associatedEventId: 'event-1',
        expiresAt: pastDate,
      });

      expect(activeTempTeam.isExpired()).toBe(false);
      expect(expiredTempTeam.isExpired()).toBe(true);
    });

    it('should support TeamRoster fields and statuses', () => {
      const roster = new TeamRoster({
        teamId: 'team-1',
        userId: 'user-1',
        status: 'INVITATION_PENDING',
        joinedAt: new Date(),
        seedNumber: 2,
      });

      expect(roster.status).toBe('INVITATION_PENDING');
      expect(roster.seedNumber).toBe(2);
    });
  });

  describe('TeamManagementService (Unit & Mocked Repository)', () => {
    let service: TeamManagementService;
    let mockTeamRepo: jest.Mocked<ITeamRepositoryPort>;
    let mockUserRepo: jest.Mocked<IUserRepositoryPort>;

    let mockCaptain: User;
    let mockPlayer: User;

    beforeEach(() => {
      mockCaptain = new User({ id: 'captain-1', nusp: '11111111', isDeleted: false });
      mockPlayer = new User({ id: 'player-2', nusp: '22222222', isDeleted: false });

      mockTeamRepo = {
        saveOfficial: jest.fn().mockImplementation(async (t) => {
          mockTeamRepo.findOfficialById.mockResolvedValue(t);
          return t;
        }),
        saveTemporary: jest.fn().mockImplementation(async (t) => {
          mockTeamRepo.findTemporaryById.mockResolvedValue(t);
          return t;
        }),
        findOfficialById: jest.fn(),
        findTemporaryById: jest.fn(),
        saveRoster: jest.fn(),
        findRoster: jest.fn(),
        deleteRoster: jest.fn(),
      } as any;

      mockUserRepo = {
        findById: jest.fn().mockImplementation(async (id) => {
          if (id === 'captain-1') return mockCaptain;
          if (id === 'player-2') return mockPlayer;
          return null;
        }),
        findByNusp: jest.fn(),
        save: jest.fn(),
      } as any;

      service = new TeamManagementService(mockTeamRepo, mockUserRepo);
    });

    describe('createOfficialTeam', () => {
      it('should create an official team and auto-add the captain to its roster', async () => {
        const dto = {
          name: 'Poli FC',
          captainId: 'captain-1',
          instituteId: 'inst-uuid-123',
        };

        const result = await service.createOfficialTeam(dto);

        expect(result).toBeInstanceOf(OfficialTeam);
        expect(result.name).toBe('Poli FC');
        expect(result.captainId).toBe('captain-1');
        expect(result.instituteId).toBe('inst-uuid-123');
        expect(result.isActiveCompetitionTeam).toBe(true);

        expect(mockTeamRepo.saveOfficial).toHaveBeenCalledTimes(1);
        expect(mockTeamRepo.saveRoster).toHaveBeenCalledWith(
          expect.objectContaining({
            teamId: result.id,
            userId: 'captain-1',
            status: 'ACTIVE',
          }),
        );
      });

      it('should throw NotFoundException if captain user does not exist', async () => {
        const dto = {
          name: 'Poli FC',
          captainId: 'unknown-user',
          instituteId: 'inst-uuid-123',
        };

        await expect(service.createOfficialTeam(dto)).rejects.toThrow(
          new NotFoundException('Captain user not found'),
        );
      });
    });

    describe('createTemporaryTeam', () => {
      it('should create a temporary event team with correct expiration and auto-add captain', async () => {
        const dto = {
          name: 'Truco Crew',
          captainId: 'captain-1',
          associatedEventId: 'event-uuid-456',
          durationHours: 4,
        };

        const result = await service.createTemporaryTeam(dto);

        expect(result).toBeInstanceOf(TemporaryEventTeam);
        expect(result.name).toBe('Truco Crew');
        expect(result.captainId).toBe('captain-1');
        expect(result.associatedEventId).toBe('event-uuid-456');
        expect(result.expiresAt.getTime()).toBeGreaterThan(result.createdAt.getTime());

        expect(mockTeamRepo.saveTemporary).toHaveBeenCalledTimes(1);
        expect(mockTeamRepo.saveRoster).toHaveBeenCalledWith(
          expect.objectContaining({
            teamId: result.id,
            userId: 'captain-1',
            status: 'ACTIVE',
          }),
        );
      });
    });

    describe('addPlayerToRoster', () => {
      it('should add player to roster successfully when team and player exist', async () => {
        mockTeamRepo.findOfficialById.mockResolvedValue(new OfficialTeam({ id: 'team-1' }));
        mockTeamRepo.findRoster.mockResolvedValue(null); // No existing roster

        await service.addPlayerToRoster('team-1', 'player-2');

        expect(mockTeamRepo.saveRoster).toHaveBeenCalledWith(
          expect.objectContaining({
            teamId: 'team-1',
            userId: 'player-2',
            status: 'ACTIVE',
          }),
        );
      });

      it('should throw NotFoundException if player user does not exist', async () => {
        await expect(service.addPlayerToRoster('team-1', 'unknown-player')).rejects.toThrow(
          new NotFoundException('User not found'),
        );
      });

      it('should throw NotFoundException if team does not exist', async () => {
        mockTeamRepo.findOfficialById.mockResolvedValue(null);
        mockTeamRepo.findTemporaryById.mockResolvedValue(null);

        await expect(service.addPlayerToRoster('team-1', 'player-2')).rejects.toThrow(
          new NotFoundException('Team not found'),
        );
      });

      it('should throw BadRequestException if player is already active in team', async () => {
        mockTeamRepo.findOfficialById.mockResolvedValue(new OfficialTeam({ id: 'team-1' }));
        mockTeamRepo.findRoster.mockResolvedValue(new TeamRoster({ teamId: 'team-1', userId: 'player-2', status: 'ACTIVE' }));

        await expect(service.addPlayerToRoster('team-1', 'player-2')).rejects.toThrow(
          new BadRequestException('Player already active in this team'),
        );
      });
    });

    describe('removePlayerFromRoster', () => {
      it('should delete player from roster successfully', async () => {
        const mockTeam = new OfficialTeam({ id: 'team-1', captainId: 'captain-1' });
        mockTeamRepo.findOfficialById.mockResolvedValue(mockTeam);
        mockTeamRepo.findRoster.mockResolvedValue(new TeamRoster({ teamId: 'team-1', userId: 'player-2' }));

        await service.removePlayerFromRoster('team-1', 'player-2');

        expect(mockTeamRepo.deleteRoster).toHaveBeenCalledWith('team-1', 'player-2');
      });

      it('should throw BadRequestException when trying to remove team captain', async () => {
        const mockTeam = new OfficialTeam({ id: 'team-1', captainId: 'captain-1' });
        mockTeamRepo.findOfficialById.mockResolvedValue(mockTeam);

        await expect(service.removePlayerFromRoster('team-1', 'captain-1')).rejects.toThrow(
          new BadRequestException('Cannot remove the team captain from roster'),
        );
      });

      it('should throw NotFoundException if roster record not found', async () => {
        const mockTeam = new OfficialTeam({ id: 'team-1', captainId: 'captain-1' });
        mockTeamRepo.findOfficialById.mockResolvedValue(mockTeam);
        mockTeamRepo.findRoster.mockResolvedValue(null);

        await expect(service.removePlayerFromRoster('team-1', 'player-2')).rejects.toThrow(
          new NotFoundException('Player not in team roster'),
        );
      });
    });
  });
});
