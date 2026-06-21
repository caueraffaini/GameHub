import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayAreaEntity } from './adapters/persistence/PlayArea.entity';
import { PlayAreaReservationEntity } from './adapters/persistence/PlayAreaReservation.entity';
import { PlayAreaSupportedGameEntity } from './adapters/persistence/PlayAreaSupportedGame.entity';
import { PlayAreaRepository } from './adapters/persistence/PlayAreaRepository';
import { PlayAreaReservationRepository } from './adapters/persistence/PlayAreaReservationRepository';
import { ReservationController } from './adapters/transport/ReservationController';
import { ReservationService } from './domain/services/ReservationService';
import { IPlayAreaRepositoryPortToken } from './ports/outbound/IPlayAreaRepositoryPort';
import { IPlayAreaReservationRepositoryPortToken } from './ports/outbound/IPlayAreaReservationRepositoryPort';
import { IReservationUseCaseToken } from './ports/inbound/IReservationUseCase';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlayAreaEntity, PlayAreaReservationEntity, PlayAreaSupportedGameEntity]),
  ],
  controllers: [ReservationController],
  providers: [
    {
      provide: IPlayAreaRepositoryPortToken,
      useClass: PlayAreaRepository,
    },
    {
      provide: IPlayAreaReservationRepositoryPortToken,
      useClass: PlayAreaReservationRepository,
    },
    {
      provide: IReservationUseCaseToken,
      useClass: ReservationService,
    },
  ],
  exports: [
    IPlayAreaRepositoryPortToken,
    IPlayAreaReservationRepositoryPortToken,
    IReservationUseCaseToken,
  ],
})
export class FacilitiesModule {}
