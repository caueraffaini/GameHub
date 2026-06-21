import { Controller, Post, Delete, Body, Param, Inject, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { ITeamManagementUseCase, ITeamManagementUseCaseToken } from '../../ports/inbound/ITeamManagementUseCase';
import { JwtAuthGuard } from './guards/JwtAuthGuard';
import { RolesGuard } from './guards/RolesGuard';
import { Roles } from './guards/roles.decorator';

@Controller('teams')
export class TeamController {
  constructor(
    @Inject(ITeamManagementUseCaseToken)
    private readonly teamUseCase: ITeamManagementUseCase,
  ) {}

  @Post('official')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STUDENT')
  async createOfficial(
    @Body() body: { name: string; captainId: string; instituteId: string },
  ) {
    return this.teamUseCase.createOfficialTeam(body);
  }

  @Post('temporary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STUDENT')
  async createTemporary(
    @Body() body: { name: string; captainId: string; associatedEventId: string; durationHours: number },
  ) {
    return this.teamUseCase.createTemporaryTeam(body);
  }

  @Post(':teamId/roster/:userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async addPlayer(
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
  ) {
    await this.teamUseCase.addPlayerToRoster(teamId, userId);
  }

  @Delete(':teamId/roster/:userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePlayer(
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
  ) {
    await this.teamUseCase.removePlayerFromRoster(teamId, userId);
  }
}
