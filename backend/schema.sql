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
    player1_score INT DEFAULT NULL,
    player2_score INT DEFAULT NULL,
    winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    forfeited_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
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

-- 9. Seasons Table
CREATE TABLE seasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT check_season_times CHECK (end_time > start_time)
);

CREATE INDEX idx_seasons_active ON seasons(is_active);

-- 10. Player Rankings Table
CREATE TABLE player_rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID DEFAULT NULL REFERENCES teams(id) ON DELETE SET NULL,
    game_type VARCHAR(50) NOT NULL,
    elo_value INT NOT NULL DEFAULT 1500,
    games_played INT NOT NULL DEFAULT 0,
    last_match_at TIMESTAMPTZ DEFAULT NULL,
    CONSTRAINT unique_season_user_game UNIQUE (season_id, user_id, game_type)
);

CREATE INDEX idx_player_rankings_user ON player_rankings(user_id);
CREATE INDEX idx_player_rankings_season ON player_rankings(season_id);

-- 11. Elo Ledger Table
CREATE TABLE elo_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID DEFAULT NULL REFERENCES teams(id) ON DELETE SET NULL,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    old_rating INT NOT NULL,
    new_rating INT NOT NULL,
    change_amount INT NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED'
);

CREATE INDEX idx_elo_ledger_user ON elo_ledger(user_id);
CREATE INDEX idx_elo_ledger_match ON elo_ledger(match_id);
CREATE INDEX idx_elo_ledger_season ON elo_ledger(season_id);

-- 12. Events Table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL -- PLANNING, ACTIVE, COMPLETED
);

-- 13. Event Scores Table
CREATE TABLE event_scores (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score_value INT NOT NULL DEFAULT 0,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);

-- 14. Tournaments Table
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    game_id UUID,
    format VARCHAR(50) NOT NULL, -- SINGLE_ELIMINATION, DOUBLE_ELIMINATION, ROUND_ROBIN
    registration_start_time TIMESTAMPTZ NOT NULL,
    registration_end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL -- REGISTRATION, ACTIVE, CONCLUDED
);

-- 15. Tournament Match Slots Table
CREATE TABLE tournament_match_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    parent_slot_id UUID REFERENCES tournament_match_slots(id) ON DELETE SET NULL
);

CREATE INDEX idx_tournament_match_slots_tournament ON tournament_match_slots(tournament_id);
CREATE INDEX idx_tournament_match_slots_match ON tournament_match_slots(match_id);
CREATE INDEX idx_tournament_match_slots_parent ON tournament_match_slots(parent_slot_id);

-- 16. Group Standings Table
CREATE TABLE group_standings (
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    points INT NOT NULL DEFAULT 0,
    matches_won INT NOT NULL DEFAULT 0,
    matches_lost INT NOT NULL DEFAULT 0,
    score_differential INT NOT NULL DEFAULT 0,
    PRIMARY KEY (tournament_id, team_id)
);

CREATE INDEX idx_group_standings_tournament ON group_standings(tournament_id);
CREATE INDEX idx_group_standings_team ON group_standings(team_id);

-- 17. Friendships Table
CREATE TABLE friendships (
    user_id1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    established_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL, -- PENDING, ACCEPTED, BLOCKED
    PRIMARY KEY (user_id1, user_id2)
);

CREATE INDEX idx_friendships_user1 ON friendships(user_id1);
CREATE INDEX idx_friendships_user2 ON friendships(user_id2);

-- 18. Chat Channels Table
CREATE TABLE chat_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL, -- PRIVATE_MESSAGE, LOBBY, MATCH_ROOM
    associated_resource_id UUID DEFAULT NULL
);

-- 19. Chat Messages Table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_channel ON chat_messages(channel_id);

-- 20. Match Disputes Table
CREATE TABLE match_disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    raised_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL, -- UNDER_REVIEW, RESOLVED, DISMISSED
    resolved_at TIMESTAMPTZ DEFAULT NULL,
    resolved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT DEFAULT NULL
);

CREATE INDEX idx_match_disputes_match ON match_disputes(match_id);

-- 21. Generic Reports Table
CREATE TABLE generic_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reported_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(255) NOT NULL,
    details TEXT NOT NULL,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL -- OPEN, INVESTIGATING, CLOSED
);

CREATE INDEX idx_generic_reports_target ON generic_reports(target_user_id);

-- 22. User Sanctions Table
CREATE TABLE user_sanctions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- WARNING, TEMP_BAN, PERMANENT_BAN
    reason TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_user_sanctions_user ON user_sanctions(user_id);
CREATE INDEX idx_user_sanctions_active ON user_sanctions(is_active);




