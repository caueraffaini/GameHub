import { Injectable, Inject, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { IReservationUseCase } from '../../ports/inbound/IReservationUseCase';
import { IPlayAreaRepositoryPort, IPlayAreaRepositoryPortToken } from '../../ports/outbound/IPlayAreaRepositoryPort';
import { IPlayAreaReservationRepositoryPort, IPlayAreaReservationRepositoryPortToken } from '../../ports/outbound/IPlayAreaReservationRepositoryPort';
import { PlayAreaReservation } from '../models/PlayAreaReservation';
import { GameType } from '../models/PlayArea';
import { OptimisticLockException } from '../exceptions/OptimisticLockException';
import { PlayAreaEntity } from '../../adapters/persistence/PlayArea.entity';
import { PlayAreaReservationEntity } from '../../adapters/persistence/PlayAreaReservation.entity';

@Injectable()
export class ReservationService implements IReservationUseCase {
  constructor(
    @Inject(IPlayAreaRepositoryPortToken)
    private readonly playAreaRepo: IPlayAreaRepositoryPort,
    @Inject(IPlayAreaReservationRepositoryPortToken)
    private readonly reservationRepo: IPlayAreaReservationRepositoryPort,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async reserve(
    playAreaId: string,
    userId: string,
    gameType: GameType,
    startTime: Date,
    endTime: Date,
    expectedVersion?: number,
  ): Promise<PlayAreaReservation> {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);

    // Validate times
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('Reservation end time must be after start time');
    }

    if (start.getTime() < now.getTime()) {
      throw new BadRequestException('Reservation start time cannot be in the past');
    }

    // Limit booking window to 14 days in advance to mitigate lock contention
    const maxBookingDate = new Date();
    maxBookingDate.setDate(maxBookingDate.getDate() + 14);
    if (start.getTime() > maxBookingDate.getTime()) {
      throw new BadRequestException('Cannot book play area more than 14 days in advance');
    }

    // Load play area
    const playArea = await this.playAreaRepo.findById(playAreaId);
    if (!playArea) {
      throw new NotFoundException('Play area not found');
    }

    if (!playArea.isActive) {
      throw new BadRequestException('Play area is inactive');
    }

    // Check supported game types
    if (!playArea.supportedGameTypes.includes(gameType)) {
      throw new BadRequestException(`Game type ${gameType} is not supported by this play area`);
    }

    const reservation = new PlayAreaReservation({
      id: crypto.randomUUID(),
      playAreaId,
      userId,
      scheduledStartTime: start,
      scheduledEndTime: end,
      bufferPaddingMinutes: 15,
      status: 'CONFIRMED',
      gameType,
      version: 1,
    });

    // Virtual spaces bypass concurrency validation and database locking checks
    if (playArea.isVirtual) {
      return await this.reservationRepo.save(reservation);
    }

    // Physical play areas: execute check and version update in a SERIALIZABLE transaction
    try {
      return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
        // Refresh current play area inside transaction to inspect the version tag
        const currentPlayArea = await manager.findOne(PlayAreaEntity, { where: { id: playAreaId } });
        if (!currentPlayArea) {
          throw new NotFoundException('Play area not found');
        }

        if (expectedVersion !== undefined && currentPlayArea.version !== expectedVersion) {
          throw new OptimisticLockException(`Version conflict: expected ${expectedVersion} but got ${currentPlayArea.version}`);
        }

        // Check for overlapping bookings inside the transaction
        const activeReservations = await manager.find(PlayAreaReservationEntity, {
          where: [
            { playAreaId, status: 'CONFIRMED' },
            { playAreaId, status: 'ACTIVE' },
          ],
        });

        const hasOverlap = activeReservations.some((res) => {
          const paddingMs = res.bufferPaddingMinutes * 60 * 1000;
          const existStart = new Date(res.scheduledStartTime).getTime();
          const existEnd = new Date(res.scheduledEndTime).getTime();
          const existStartBuffered = existStart - paddingMs;
          const existEndBuffered = existEnd + paddingMs;

          const newStart = start.getTime();
          const newEnd = end.getTime();

          return newStart < existEndBuffered && newEnd > existStartBuffered;
        });

        if (hasOverlap) {
          throw new ConflictException('Play area is already booked for this timeslot');
        }

        // Bump play area version to trigger OCC
        const expectedVer = expectedVersion !== undefined ? expectedVersion : currentPlayArea.version;
        const updateResult = await manager.update(
          PlayAreaEntity,
          { id: playAreaId, version: expectedVer },
          { version: expectedVer + 1 },
        );

        if (updateResult.affected === 0) {
          throw new OptimisticLockException(`Optimistic lock failed: version mismatch on play area ${playAreaId}`);
        }

        const entity = PlayAreaReservationEntity.toEntity(reservation);
        const savedEntity = await manager.save(entity);
        return savedEntity.toModel();
      });
    } catch (error: any) {
      if (
        error.code === '40001' || // PostgreSQL serialization failure
        error.message?.includes('SQLITE_BUSY') ||
        error.message?.includes('database is locked') ||
        error instanceof OptimisticLockException
      ) {
        throw new OptimisticLockException(`Concurrency lock failure: ${error.message || 'database busy'}`);
      }
      throw error;
    }
  }

  async activate(reservationId: string): Promise<void> {
    const reservation = await this.reservationRepo.findById(reservationId);
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }
    reservation.activate();
    await this.reservationRepo.save(reservation);
  }

  async complete(reservationId: string): Promise<void> {
    const reservation = await this.reservationRepo.findById(reservationId);
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }
    reservation.complete();
    await this.reservationRepo.save(reservation);
  }

  async cancel(reservationId: string): Promise<void> {
    const reservation = await this.reservationRepo.findById(reservationId);
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }
    reservation.cancel();
    await this.reservationRepo.save(reservation);
  }
}
