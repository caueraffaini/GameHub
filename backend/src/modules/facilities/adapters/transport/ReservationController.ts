import { Controller, Post, Body, Param, Inject, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { IReservationUseCase, IReservationUseCaseToken } from '../../ports/inbound/IReservationUseCase';
import { JwtAuthGuard } from '../../../identity/adapters/transport/guards/JwtAuthGuard';
import { GameType } from '../../domain/models/PlayArea';

@Controller('reservations')
export class ReservationController {
  constructor(
    @Inject(IReservationUseCaseToken)
    private readonly reservationUseCase: IReservationUseCase,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async reserve(
    @Body()
    body: {
      playAreaId: string;
      userId: string;
      gameType: GameType;
      startTime: string;
      endTime: string;
      expectedVersion?: number;
    },
  ) {
    return this.reservationUseCase.reserve(
      body.playAreaId,
      body.userId,
      body.gameType,
      new Date(body.startTime),
      new Date(body.endTime),
      body.expectedVersion,
    );
  }

  @Post(':id/activate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async activate(@Param('id') id: string) {
    await this.reservationUseCase.activate(id);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async complete(@Param('id') id: string) {
    await this.reservationUseCase.complete(id);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@Param('id') id: string) {
    await this.reservationUseCase.cancel(id);
  }
}
