-- SalDesk — Vendedores de Praia
-- Comissoes por reservas efectuadas no campo

CREATE TABLE IF NOT EXISTS seller_commissions (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id      UUID         REFERENCES operators(id) ON DELETE CASCADE,
  seller_id        UUID         REFERENCES staff(id)     ON DELETE CASCADE,
  reservation_id   UUID         REFERENCES reservations(id) ON DELETE SET NULL,
  amount           DECIMAL(10,2) NOT NULL,
  percentage       DECIMAL(5,2)  NOT NULL,
  status           TEXT          NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at          TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_commissions_seller_id
  ON seller_commissions(seller_id);

CREATE INDEX IF NOT EXISTS idx_seller_commissions_operator_id
  ON seller_commissions(operator_id);

CREATE INDEX IF NOT EXISTS idx_seller_commissions_status
  ON seller_commissions(status);

-- Adicionar campo seller_id a reservations (vendedor que criou a reserva)
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES staff(id) ON DELETE SET NULL;

-- Adicionar campos de vendedor a staff
-- commission_pct: % de comissao individual do vendedor
-- seller_zone: zona de actuacao (Santa Maria Norte, Sul, Praia, etc.)
-- seller_tour_ids: tours que o vendedor pode vender (JSONB)
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS commission_pct   DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS seller_zone      TEXT,
  ADD COLUMN IF NOT EXISTS seller_tour_ids  JSONB DEFAULT '[]'::jsonb;
