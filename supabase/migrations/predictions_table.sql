CREATE TABLE IF NOT EXISTS predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  horizon TEXT NOT NULL,
  predicted_price FLOAT NOT NULL,
  current_price FLOAT NOT NULL,
  direction TEXT NOT NULL,
  confidence FLOAT,
  target_time TIMESTAMPTZ NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  actual_price FLOAT,
  direction_correct BOOLEAN,
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_predictions_horizon ON predictions(horizon);
CREATE INDEX IF NOT EXISTS idx_predictions_resolved ON predictions(resolved);
CREATE INDEX IF NOT EXISTS idx_predictions_target_time ON predictions(target_time);
