-- SalDesk — Despesas, Salarios e Obrigacoes

CREATE TABLE IF NOT EXISTS expenses (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id UUID         REFERENCES operators(id) ON DELETE CASCADE NOT NULL,
  category    TEXT         NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  currency    TEXT         DEFAULT 'EUR',
  date        DATE         NOT NULL,
  staff_id    UUID         REFERENCES staff(id) ON DELETE SET NULL,
  unit_id     UUID         REFERENCES units(id) ON DELETE SET NULL,
  is_recurring BOOLEAN     DEFAULT FALSE,
  notes       TEXT,
  receipt_url TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_operator_id ON expenses(operator_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date        ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category    ON expenses(category);

CREATE TABLE IF NOT EXISTS salary_configs (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id   UUID         REFERENCES operators(id) ON DELETE CASCADE NOT NULL,
  staff_id      UUID         REFERENCES staff(id)     ON DELETE CASCADE NOT NULL,
  base_salary   DECIMAL(10,2) DEFAULT 0,
  food_subsidy  DECIMAL(10,2) DEFAULT 0,
  transport_sub DECIMAL(10,2) DEFAULT 0,
  inps_pct      DECIMAL(5,2)  DEFAULT 15,
  updated_at    TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (operator_id, staff_id)
);

CREATE TABLE IF NOT EXISTS salary_payments (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id UUID         REFERENCES operators(id) ON DELETE CASCADE NOT NULL,
  staff_id    UUID         REFERENCES staff(id)     ON DELETE SET NULL,
  amount      DECIMAL(10,2) NOT NULL,
  month       INTEGER      NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        INTEGER      NOT NULL,
  paid_at     TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_payments_staff_id ON salary_payments(staff_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_period   ON salary_payments(year, month);
