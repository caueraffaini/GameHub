import { PlayAreaReservation } from '../../domain/models/PlayAreaReservation';
import { ReservationService } from '../../domain/services/ReservationService';
import { PlayArea } from '../../domain/models/PlayArea';
import { IPlayAreaRepositoryPort } from '../../ports/outbound/IPlayAreaRepositoryPort';
import { IPlayAreaReservationRepositoryPort } from '../../ports/outbound/IPlayAreaReservationRepositoryPort';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

describe('Facilities Reservation Unit Tests', () => {
  describe('PlayAreaReservation Domain Model', () => {
    it('should initialize with default buffer padding and version', () => {
      const res = new PlayAreaReservation({ id: 'res-1' });
      expect(res.bufferPaddingMinutes).toBe(15);
      expect(res.version).toBe(1);
    });

    it('should activate a confirmed reservation', () => {
      const res = new PlayAreaReservation({ id: 'res-1', status: 'CONFIRMED' });
      res.activate();
      expect(res.status).toBe('ACTIVE');
    });

    it('should throw error when activating non-confirmed reservation', () => {
      const res = new PlayAreaReservation({ id: 'res-1', status: 'ACTIVE' });
      expect(() => res.activate()).toThrow();
    });

    it('should complete an active reservation', () => {
      const res = new PlayAreaReservation({ id: 'res-1', status: 'ACTIVE' });
      res.complete();
      expect(res.status).toBe('COMPLETED');
    });

    it('should throw error when completing non-active reservation', () => {
      const res = new PlayAreaReservation({ id: 'res-1', status: 'CONFIRMED' });
      expect(() => res.complete()).toThrow();
    });

    it('should cancel a confirmed reservation', () => {
      const res = new PlayAreaReservation({ id: 'res-1', status: 'CONFIRMED' });
      res.cancel();
      expect(res.status).toBe('CANCELLED');
    });

    it('should throw error when cancelling completed reservation', () => {
      const res = new PlayAreaReservation({ id: 'res-1', status: 'COMPLETED' });
      expect(() => res.cancel()).toThrow('Cannot cancel a completed reservation');
    });
  });

  describe('ReservationService (Unit Validation)', () => {
    let service: ReservationService;
    let mockPlayAreaRepo: jest.Mocked<IPlayAreaRepositoryPort>;
    let mockReservationRepo: jest.Mocked<IPlayAreaReservationRepositoryPort>;
    let mockDataSource: jest.Mocked<DataSource>;

    beforeEach(() => {
      mockPlayAreaRepo = {
        findById: jest.fn(),
        save: jest.fn(),
        findAll: jest.fn(),
      };
      mockReservationRepo = {
        findById: jest.fn(),
        save: jest.fn(),
        findOverlappingReservations: jest.fn(),
        findActiveReservationsForUser: jest.fn(),
      };
      mockDataSource = {
        transaction: jest.fn(),
      } as any;

      service = new ReservationService(mockPlayAreaRepo, mockReservationRepo, mockDataSource);
    });

    it('should throw BadRequestException if end time is before start time', async () => {
      const start = new Date(Date.now() + 10000);
      const end = new Date(Date.now() - 10000);

      await expect(
        service.reserve('area-1', 'user-1', 'BOLA_8', start, end),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if start time is in the past', async () => {
      const start = new Date(Date.now() - 10000);
      const end = new Date(Date.now() + 10000);

      await expect(
        service.reserve('area-1', 'user-1', 'BOLA_8', start, end),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if booking is more than 14 days in advance', async () => {
      const start = new Date();
      start.setDate(start.getDate() + 15);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);

      await expect(
        service.reserve('area-1', 'user-1', 'BOLA_8', start, end),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if play area does not exist', async () => {
      mockPlayAreaRepo.findById.mockResolvedValue(null);
      const start = new Date(Date.now() + 10000);
      const end = new Date(start.getTime() + 3600000);

      await expect(
        service.reserve('area-1', 'user-1', 'BOLA_8', start, end),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if play area is inactive', async () => {
      const area = new PlayArea({ id: 'area-1', isActive: false });
      mockPlayAreaRepo.findById.mockResolvedValue(area);
      const start = new Date(Date.now() + 10000);
      const end = new Date(start.getTime() + 3600000);

      await expect(
        service.reserve('area-1', 'user-1', 'BOLA_8', start, end),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if game type is not supported', async () => {
      const area = new PlayArea({ id: 'area-1', isActive: true, supportedGameTypes: ['PINGPONG'] });
      mockPlayAreaRepo.findById.mockResolvedValue(area);
      const start = new Date(Date.now() + 10000);
      const end = new Date(start.getTime() + 3600000);

      await expect(
        service.reserve('area-1', 'user-1', 'BOLA_8', start, end),
      ).rejects.toThrow(BadRequestException);
    });

    it('should bypass transaction locking for virtual areas', async () => {
      const area = new PlayArea({
        id: 'area-1',
        isActive: true,
        isVirtual: true,
        supportedGameTypes: ['TRUCO'],
      });
      mockPlayAreaRepo.findById.mockResolvedValue(area);
      mockReservationRepo.save.mockResolvedValue(new PlayAreaReservation({ id: 'res-1' }));

      const start = new Date(Date.now() + 10000);
      const end = new Date(start.getTime() + 3600000);

      const result = await service.reserve('area-1', 'user-1', 'TRUCO', start, end);
      expect(result).toBeDefined();
      expect(mockReservationRepo.save).toHaveBeenCalled();
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });
  });
});
