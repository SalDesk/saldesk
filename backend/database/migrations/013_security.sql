-- SalDesk — Seguranca Avancada
-- Rate limiting, 2FA por email, historico de acessos

CREATE TABLE IF NOT EXISTS login_history (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID         NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  location    TEXT,
  status      TEXT         DEFAULT 'success'
              CHECK (status IN ('success', 'failed', 'blocked')),
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_history_user_id
  ON login_history(user_id);

CREATE INDEX IF NOT EXISTS idx_login_history_created_at
  ON login_history(created_at DESC);

CREATE TABLE IF NOT EXISTS two_factor_settings (
  user_id     UUID         PRIMARY KEY,
  enabled     BOOLEAN      DEFAULT FALSE,
  method      TEXT         DEFAULT 'email'
              CHECK (method IN ('email', 'totp')),
  verified_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Cleanup: remove expired 2FA codes (managed by Redis TTL, this is a fallback table)
CREATE TABLE IF NOT EXISTS two_factor_codes (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID         NOT NULL,
  code_hash   TEXT         NOT NULL,
  expires_at  TIMESTAMPTZ  NOT NULL,
  used        BOOLEAN      DEFAULT FALSE,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_two_factor_codes_user_id
  ON two_factor_codes(user_id);

-- Active sessions tracking
CREATE TABLE IF NOT EXISTS active_sessions (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID         NOT NULL,
  token_hash  TEXT         NOT NULL,
  device      TEXT,
  browser     TEXT,
  os          TEXT,
  ip_address  TEXT,
  location    TEXT,
  last_active TIMESTAMPTZ  DEFAULT NOW(),
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id
  ON active_sessions(user_id);
