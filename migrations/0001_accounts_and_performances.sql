PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE performances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  mode TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  accuracy REAL NOT NULL,
  score INTEGER NOT NULL,
  score_per_minute REAL NOT NULL,
  details TEXT NOT NULL,
  started_at TEXT NOT NULL,
  saved_at TEXT NOT NULL
);

CREATE INDEX performances_user_game_saved_idx
  ON performances(user_id, game, saved_at DESC);

CREATE TABLE login_attempts (
  identifier TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);

CREATE INDEX login_attempts_identifier_time_idx
  ON login_attempts(identifier, attempted_at);
