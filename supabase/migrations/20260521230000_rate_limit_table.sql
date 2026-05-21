-- Persistent rate limiting table for edge functions
CREATE TABLE IF NOT EXISTS rate_limits (
  id          BIGSERIAL PRIMARY KEY,
  identifier  TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  count       INTEGER NOT NULL DEFAULT 1,
  UNIQUE (identifier, window_start)
);

CREATE INDEX IF NOT EXISTS rate_limits_identifier_window_idx
  ON rate_limits (identifier, window_start);

-- Auto-cleanup old entries
CREATE OR REPLACE FUNCTION cleanup_rate_limits() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$;
