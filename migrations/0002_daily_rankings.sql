CREATE INDEX performances_daily_ranking_idx
  ON performances(game, mode, saved_at DESC, user_id);
