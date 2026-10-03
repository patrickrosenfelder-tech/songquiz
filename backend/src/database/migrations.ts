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
  },
  {
    id: 3,
    name: 'matches',
    sql: `
      CREATE TABLE matches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL,
        round_count integer NOT NULL,
        started_at timestamptz NOT NULL,
        finished_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE match_players (
        match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        position integer NOT NULL,
        user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        name text NOT NULL,
        is_guest boolean NOT NULL,
        total_score integer NOT NULL,
        PRIMARY KEY (match_id, position)
      );
      CREATE INDEX match_players_user_id ON match_players (user_id);

      ALTER TABLE games
        ADD COLUMN match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
        ADD COLUMN match_round integer;
    `
  },
  {
    id: 4,
    name: 'friends_and_challenges',
    sql: `
      CREATE TABLE friendships (
        requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (requester_id, addressee_id),
        CHECK (requester_id <> addressee_id)
      );
      CREATE INDEX friendships_addressee_id ON friendships (addressee_id);

      CREATE TABLE challenges (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code text UNIQUE NOT NULL,
        challenger_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        -- Empty for link challenges anyone can take
        target_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        source_game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        challenger_score integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      );
      CREATE INDEX challenges_target_user_id ON challenges (target_user_id);
      CREATE INDEX challenges_challenger_id ON challenges (challenger_id);

      CREATE TABLE challenge_attempts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
        user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        name text NOT NULL,
        game_id uuid REFERENCES games(id) ON DELETE SET NULL,
        score integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        seen_by_challenger boolean NOT NULL DEFAULT false
      );
      CREATE UNIQUE INDEX challenge_attempts_one_per_user ON challenge_attempts (challenge_id, user_id) WHERE user_id IS NOT NULL;
    `
  }
];
