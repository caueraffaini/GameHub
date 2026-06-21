import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPlayAreaReservationRepositoryPort } from '../../ports/outbound/IPlayAreaReservationRepositoryPort';
import { PlayAreaReservation } from '../../domain/models/PlayAreaReservation';
import { PlayAreaReservationEntity } from './PlayAreaReservation.entity';

@Injectable()
export class PlayAreaReservationRepository implements IPlayAreaReservationRepositoryPort {
  constructor(
    @InjectRepository(PlayAreaReservationEntity)
    private readonly repo: Repository<PlayAreaReservationEntity>,
  ) {}

  async findById(id: string): Promise<PlayAreaReservation | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? entity.toModel() : null;
  }

  async save(reservation: PlayAreaReservation): Promise<PlayAreaReservation> {
    const entity = PlayAreaReservationEntity.toEntity(reservation);
    const saved = await this.repo.save(entity);
    return saved.toModel();
  }

  async findOverlappingReservations(
    playAreaId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<PlayAreaReservation[]> {
    // Get all CONFIRMED and ACTIVE reservations for this play area to perform memory-safe timezone-agnostic check.
    const activeEntities = await this.repo.find({
      where: [
        { playAreaId, status: 'CONFIRMED' },
        { playAreaId, status: 'ACTIVE' },
      ],
    });

    return activeEntities
      .map((entity) => entity.toModel())
      .filter((res) => {
        const paddingMs = res.bufferPaddingMinutes * 60 * 1000;
        
        const existStart = new Date(res.scheduledStartTime).getTime();
        const existEnd = new Date(res.scheduledEndTime).getTime();
        const existStartBuffered = existStart - paddingMs;
        const existEndBuffered = existEnd + paddingMs;

        const newStart = new Date(startTime).getTime();
        const newEnd = new Date(endTime).getTime();

        return newStart < existEndBuffered && newEnd > existStartBuffered;
      });
  }

  async findActiveReservationsForUser(userId: string): Promise<PlayAreaReservation[]> {
    const entities = await this.repo.find({
      where: [
        { userId, status: 'CONFIRMED' },
        { userId, status: 'ACTIVE' },
      ],
    });
    return entities.map((entity) => entity.toModel());
  }

  async cancelUpcomingByUser(userId: string): Promise<void> {
    const now = new Date();
    const upcoming = await this.repo.find({
      where: {
        userId,
        status: 'CONFIRMED',
      },
    });

    const upcomingFiltered = upcoming.filter(
      (entity) => new Date(entity.scheduledStartTime).getTime() > now.getTime(),
    );

    for (const entity of upcomingFiltered) {
      entity.status = 'CANCELLED';
      await this.repo.save(entity);
    }
  }
}
