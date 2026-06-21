-- schema.sql
-- Corrected DDL for GameHub Core Persistent Storage (Phase 0)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nusp VARCHAR(50) UNIQUE NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    birth_date DATE NOT NULL,
    pin_hash VARCHAR(255) NOT NULL, -- Securely hashed 4-digit numerical authentication PIN
    avatar_url VARCHAR(2048) DEFAULT NULL, -- Optional avatar URL tracking field
    institute_id UUID NOT NULL,
    course_id UUID NOT NULL,
    availability_status VARCHAR(50) NOT NULL DEFAULT 'OFFLINE', -- AVAILABLE, MATCHED, OFFLINE
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_users_nusp ON users(nusp);
CREATE INDEX idx_users_email ON users(email);

-- 2. Play Areas Table
CREATE TABLE play_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'EMPTY', -- EMPTY, IN_USE, MAINTENANCE
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_virtual BOOLEAN NOT NULL DEFAULT FALSE, -- Differentiates transient card game instances from physical inventory
    version INT NOT NULL DEFAULT 1
);

-- 2.1 Play Area Supported Games Mapping
CREATE TABLE play_area_supported_games (
    play_area_id UUID NOT NULL REFERENCES play_areas(id) ON DELETE CASCADE,
    game_type VARCHAR(50) NOT NULL, -- BOLA_8, PINGPONG, PEBOLIM, TRUCO, BURACO, SNOOKER
    PRIMARY KEY (play_area_id, game_type)
);

CREATE INDEX idx_play_area_supported_games_game ON play_area_supported_games(game_type);

-- 3. Play Area Reservations Table (Corrected with PK(id) and Slot-Level OCC)
CREATE TABLE play_area_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    play_area_id UUID NOT NULL REFERENCES play_areas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheduled_start_time TIMESTAMPTZ NOT NULL,
    scheduled_end_time TIMESTAMPTZ NOT NULL,
    buffer_padding_minutes INT NOT NULL DEFAULT 15,
    status VARCHAR(50) NOT NULL, -- CONFIRMED, ACTIVE, COMPLETED, CANCELLED
    game_type VARCHAR(50) NOT NULL, -- BOLA_8, PINGPONG, PEBOLIM, TRUCO, BURACO, SNOOKER
    version INT NOT NULL DEFAULT 1, -- Version column shifted to reservation slot to avoid table bottleneck
    CONSTRAINT check_times CHECK (scheduled_end_time > scheduled_start_time),
    CONSTRAINT unique_play_area_slot UNIQUE (play_area_id, scheduled_start_time, scheduled_end_time)
);

CREATE INDEX idx_play_area_reservations_play_area ON play_area_reservations(play_area_id);
CREATE INDEX idx_play_area_reservations_user ON play_area_reservations(user_id);
CREATE INDEX idx_play_area_reservations_time ON play_area_reservations(scheduled_start_time, scheduled_end_time);

-- 4. Matchmaking Tickets Table
CREATE TABLE matchmaking_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID DEFAULT NULL,
    elo_rating INT NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiry_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL -- WAITING, MATCHED, CANCELLED, EXPIRED
);

CREATE INDEX idx_matchmaking_tickets_user ON matchmaking_tickets(user_id);
CREATE INDEX idx_matchmaking_tickets_status ON matchmaking_tickets(status);

-- 5. Matches Table
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    play_area_reservation_id UUID REFERENCES play_area_reservations(id) ON DELETE SET NULL,
    player1_id UUID REFERENCES users(id) ON DELETE SET NULL,
    player2_id UUID REFERENCES users(id) ON DELETE SET NULL,
    game_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL, -- PENDING_RESOURCE_ALLOCATION, IN_PROGRESS, COMPLETED, DISPUTED, CANCELLED
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_matches_reservation ON matches(play_area_reservation_id);
CREATE INDEX idx_matches_status ON matches(status);

-- 6. Teams Table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    captain_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type VARCHAR(50) NOT NULL, -- OFFICIAL, TEMPORARY
    institute_id UUID DEFAULT NULL,
    is_active_competition_team BOOLEAN DEFAULT NULL,
    associated_event_id UUID DEFAULT NULL,
    expires_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_teams_captain ON teams(captain_id);

-- 7. Team Rosters Table
CREATE TABLE team_rosters (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INVITATION_PENDING, REMOVED
    seed_number INT NOT NULL DEFAULT 0,
    PRIMARY KEY (team_id, user_id)
);

CREATE INDEX idx_team_rosters_user ON team_rosters(user_id);

-- 8. Device Tokens Table
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_string VARCHAR(500) NOT NULL UNIQUE,
    platform VARCHAR(50) NOT NULL
);

CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);

