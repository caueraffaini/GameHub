import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './adapters/persistence/User.entity';
import { TeamEntity } from './adapters/persistence/Team.entity';
import { TeamRosterEntity } from './adapters/persistence/TeamRoster.entity';
import { UserRepository } from './adapters/persistence/UserRepository';
import { TeamRepository } from './adapters/persistence/TeamRepository';
import { AuthController } from './adapters/transport/AuthController';
import { TeamController } from './adapters/transport/TeamController';
import { AuthenticationService } from './domain/services/AuthenticationService';
import { TeamManagementService } from './domain/services/TeamManagementService';
import { IUserRepositoryPortToken } from './ports/outbound/IUserRepositoryPort';
import { ITeamRepositoryPortToken } from './ports/outbound/ITeamRepositoryPort';
import { IAuthenticationUseCaseToken } from './ports/inbound/IAuthenticationUseCase';
import { ITeamManagementUseCaseToken } from './ports/inbound/ITeamManagementUseCase';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, TeamEntity, TeamRosterEntity]),
  ],
  controllers: [AuthController, TeamController],
  providers: [
    {
      provide: IUserRepositoryPortToken,
      useClass: UserRepository,
    },
    {
      provide: ITeamRepositoryPortToken,
      useClass: TeamRepository,
    },
    {
      provide: IAuthenticationUseCaseToken,
      useClass: AuthenticationService,
    },
    {
      provide: ITeamManagementUseCaseToken,
      useClass: TeamManagementService,
    },
  ],
  exports: [
    IUserRepositoryPortToken,
    IAuthenticationUseCaseToken,
    ITeamManagementUseCaseToken,
  ],
})
export class IdentityModule {}
