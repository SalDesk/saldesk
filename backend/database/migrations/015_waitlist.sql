-- SalDesk — Waitlist e Convites de Registo

CREATE TABLE IF NOT EXISTS waitlist (
  id         UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT         NOT NULL UNIQUE,
  source     TEXT         DEFAULT 'coming-soon',
  lang       TEXT         DEFAULT 'pt',
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at DESC);

CREATE TABLE IF NOT EXISTS invite_codes (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  code        TEXT         NOT NULL UNIQUE,
  description TEXT,
  max_uses    INTEGER      DEFAULT 1,
  uses        INTEGER      DEFAULT 0,
  active      BOOLEAN      DEFAULT TRUE,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Seeds — códigos iniciais de lançamento
INSERT INTO invite_codes (code, description, max_uses)
VALUES
  ('SALDESK2026', 'Codigo geral de lancamento', 999),
  ('ZYTOURS2026', 'Codigo exclusivo Zy Tours', 5)
ON CONFLICT (code) DO NOTHING;
