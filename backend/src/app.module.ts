// src/app.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from './modules/identity/identity.module';
import { FacilitiesModule } from './modules/facilities/facilities.module';
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module';
import { MatchesModule } from './modules/matches/matches.module';
import { ProgressionModule } from './modules/progression/progression.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { EventModule } from './shared/events/EventModule';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'gamehub_db',
      autoLoadEntities: true,
      synchronize: false, // Disable synchronize for production safety
      logging: false,
    }),
    EventModule,
    IdentityModule,
    FacilitiesModule,
    MatchmakingModule,
    MatchesModule,
    ProgressionModule,
    TournamentsModule,
    ModerationModule,
  ],
})
export class AppModule {}
