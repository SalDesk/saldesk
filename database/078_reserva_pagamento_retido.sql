-- SalDesk - Lugar retido 30 minutos nas reservas publicas pagas com cartao (PayPal/SISP)
--
-- hold_expires_at: so as reservas publicas com cartao e total > 0 o preenchem. Nulo = sem retencao;
--   preenchido = avisos adiados e lugar retido (ou retencao ja vencida).
-- cancel_reason: porque a reserva foi cancelada pelo sistema (payment_not_completed = prazo de
--   pagamento vencido; replaced = substituida por nova tentativa; paid_after_expiry = pago depois de expirar).
-- voucher_id: vale usado na reserva, para o consumir so quando o pagamento for concluido.
-- ATENCAO: aplicar ANTES de implantar o backend, que passa a ler e escrever estas colunas.
alter table reservations add column if not exists cancel_reason text null;
alter table reservations drop constraint if exists reservations_cancel_reason_check;
alter table reservations add constraint reservations_cancel_reason_check
  check (cancel_reason is null or cancel_reason in ('payment_not_completed', 'replaced', 'paid_after_expiry'));
alter table reservations add column if not exists hold_expires_at timestamptz null;
alter table reservations add column if not exists voucher_id uuid null references vouchers(id) on delete set null;

-- Para o job de expiracao (corre de 5 em 5 minutos)
create index if not exists reservations_hold_expires_idx on reservations (hold_expires_at)
  where status = 'pending' and hold_expires_at is not null;
