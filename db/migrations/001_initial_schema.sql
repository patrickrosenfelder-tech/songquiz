-- PostgreSQL Schema for SongQuiz - Music Quiz Game
-- Supports user profiles, game sessions, multiplayer matchmaking, scores, and leaderboards

-- Users/Profiles Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  avatar_url VARCHAR(2048),
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

-- Game Sessions Table
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type VARCHAR(20) NOT NULL CHECK (session_type IN ('single_player', 'multiplayer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('pending', 'in_progress', 'completed', 'abandoned')),
  duration_seconds INTEGER,
  total_questions INTEGER NOT NULL,
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  matchmaking_code VARCHAR(20) UNIQUE,
  max_players INTEGER DEFAULT 2,
  is_public BOOLEAN DEFAULT false
);

-- Game Participants (for multiplayer sessions)
CREATE TABLE game_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP WITH TIME ZONE,
  final_score INTEGER,
  final_position INTEGER,
  is_ready BOOLEAN DEFAULT false,
  UNIQUE(session_id, user_id)
);

-- Scores Table (answers per session, per user, per question)
CREATE TABLE game_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  song_id VARCHAR(255),
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_correct BOOLEAN NOT NULL,
  points_earned INTEGER DEFAULT 0,
  response_time_ms INTEGER,
  UNIQUE(session_id, user_id, question_number)
);

-- Leaderboard (aggregate stats for global leaderboard)
CREATE TABLE leaderboard_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_games_played INTEGER DEFAULT 0,
  total_games_won INTEGER DEFAULT 0,
  total_score BIGINT DEFAULT 0,
  total_correct_answers INTEGER DEFAULT 0,
  total_questions_answered INTEGER DEFAULT 0,
  accuracy_percentage NUMERIC(5, 2) DEFAULT 0.00,
  average_points_per_game NUMERIC(8, 2) DEFAULT 0.00,
  best_streak INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Matchmaking Queue
CREATE TABLE matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_level VARCHAR(20),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  queue_status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (queue_status IN ('waiting', 'matched', 'cancelled')),
  matched_session_id UUID REFERENCES game_sessions(id) ON DELETE SET NULL,
  UNIQUE(user_id)
);

-- Indexes for Performance

-- Users indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Game Sessions indexes
CREATE INDEX idx_game_sessions_created_at ON game_sessions(created_at);
CREATE INDEX idx_game_sessions_status ON game_sessions(status);
CREATE INDEX idx_game_sessions_session_type ON game_sessions(session_type);
CREATE INDEX idx_game_sessions_creator_id ON game_sessions(creator_id);
CREATE INDEX idx_game_sessions_matchmaking_code ON game_sessions(matchmaking_code);

-- Game Participants indexes
CREATE INDEX idx_game_participants_session_id ON game_participants(session_id);
CREATE INDEX idx_game_participants_user_id ON game_participants(user_id);
CREATE INDEX idx_game_participants_joined_at ON game_participants(joined_at);

-- Game Scores indexes
CREATE INDEX idx_game_scores_session_id ON game_scores(session_id);
CREATE INDEX idx_game_scores_user_id ON game_scores(user_id);
CREATE INDEX idx_game_scores_answered_at ON game_scores(answered_at);
CREATE INDEX idx_game_scores_is_correct ON game_scores(is_correct);

-- Leaderboard indexes
CREATE INDEX idx_leaderboard_stats_total_score ON leaderboard_stats(total_score DESC);
CREATE INDEX idx_leaderboard_stats_accuracy ON leaderboard_stats(accuracy_percentage DESC);
CREATE INDEX idx_leaderboard_stats_total_games_played ON leaderboard_stats(total_games_played DESC);
CREATE INDEX idx_leaderboard_stats_last_updated ON leaderboard_stats(last_updated_at);

-- Matchmaking Queue indexes
CREATE INDEX idx_matchmaking_queue_user_id ON matchmaking_queue(user_id);
CREATE INDEX idx_matchmaking_queue_status ON matchmaking_queue(queue_status);
CREATE INDEX idx_matchmaking_queue_joined_at ON matchmaking_queue(joined_at);
CREATE INDEX idx_matchmaking_queue_skill_level ON matchmaking_queue(skill_level);

-- Views for Common Queries

-- Global Leaderboard View (top 100 by total score)
CREATE VIEW leaderboard_global_ranking AS
SELECT
  ROW_NUMBER() OVER (ORDER BY ls.total_score DESC) AS rank,
  u.id,
  u.username,
  u.display_name,
  u.avatar_url,
  ls.total_score,
  ls.total_games_played,
  ls.total_games_won,
  ROUND((ls.total_games_won::NUMERIC / NULLIF(ls.total_games_played, 0) * 100), 2) AS win_rate,
  ls.accuracy_percentage,
  ls.average_points_per_game,
  ls.current_streak
FROM leaderboard_stats ls
JOIN users u ON ls.user_id = u.id
WHERE u.is_active = true
ORDER BY ls.total_score DESC
LIMIT 100;

-- Session Summary View (for quick session data retrieval)
CREATE VIEW game_session_summary AS
SELECT
  gs.id,
  gs.session_type,
  gs.status,
  gs.created_at,
  gs.started_at,
  gs.ended_at,
  gs.total_questions,
  EXTRACT(EPOCH FROM (gs.ended_at - gs.started_at))::INTEGER AS duration_seconds,
  u.username AS creator_username,
  COUNT(gp.id) AS participant_count,
  MAX(gp.final_score) AS highest_score
FROM game_sessions gs
LEFT JOIN users u ON gs.creator_id = u.id
LEFT JOIN game_participants gp ON gs.id = gp.session_id
GROUP BY gs.id, u.username;

-- User Session History View
CREATE VIEW user_session_history AS
SELECT
  u.id,
  u.username,
  gs.id AS session_id,
  gs.session_type,
  gs.created_at,
  gs.ended_at,
  gp.final_score,
  gp.final_position,
  ROUND((COUNT(CASE WHEN gs2.is_correct THEN 1 END)::NUMERIC / NULLIF(COUNT(gs2.id), 0) * 100), 2) AS session_accuracy
FROM users u
JOIN game_participants gp ON u.id = gp.user_id
JOIN game_sessions gs ON gp.session_id = gs.id
LEFT JOIN game_scores gs2 ON gs.id = gs2.session_id AND u.id = gs2.user_id
GROUP BY u.id, u.username, gs.id, gp.id
ORDER BY gs.created_at DESC;
