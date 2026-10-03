// Applied in order at startup; never edit a migration that has shipped, add a new one.
export const MIGRATIONS: { id: number; name: string; sql: string }[] = [
  {
    id: 1,
    name: 'users_sessions_games',
    sql: `
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        google_sub text UNIQUE NOT NULL,
        email text,
        display_name text,
        avatar_url text,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX users_display_name_lower ON users (lower(display_name));

      CREATE TABLE sessions (
        token_hash text PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      );
      CREATE INDEX sessions_user_id ON sessions (user_id);

      CREATE TABLE games (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL,
        kind text NOT NULL,
        genre_id integer NOT NULL,
        question_mode text NOT NULL,
        song_count integer NOT NULL,
        started_at timestamptz NOT NULL,
        finished_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE game_players (
        game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        position integer NOT NULL,
        user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        name text NOT NULL,
        is_guest boolean NOT NULL,
        score integer NOT NULL,
        correct_count integer NOT NULL,
        PRIMARY KEY (game_id, position)
      );
      CREATE INDEX game_players_user_id ON game_players (user_id);

      CREATE TABLE game_songs (
        game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        song_number integer NOT NULL,
        track_id text NOT NULL,
        deezer_id bigint,
        title text NOT NULL,
        artist text NOT NULL,
        question_type text NOT NULL,
        correct_answer text NOT NULL,
        options jsonb NOT NULL,
        PRIMARY KEY (game_id, song_number)
      );

      CREATE TABLE answers (
        game_id uuid NOT NULL,
        song_number integer NOT NULL,
        player_position integer NOT NULL,
        answer text NOT NULL,
        correct boolean NOT NULL,
        points integer NOT NULL,
        time_ms integer NOT NULL,
        PRIMARY KEY (game_id, song_number, player_position),
        FOREIGN KEY (game_id, song_number) REFERENCES game_songs (game_id, song_number) ON DELETE CASCADE
      );
    `
  },
  {
    id: 2,
    name: 'leaderboard_indexes',
    sql: `
      CREATE INDEX games_solo_board ON games (question_mode, genre_id) WHERE kind = 'solo';
    `
  }
];
