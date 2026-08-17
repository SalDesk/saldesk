-- SalDesk - Fidelidade: historico real de pontos + resgate real
--
-- Ate agora customers.loyalty_points era um saldo mutavel sem nenhum registo
-- de quando/porque mudou, e resgatarPontos() era codigo morto (exportado,
-- nunca chamado). loyalty_ledger regista cada movimento (ganho no checkout,
-- ajuste manual, resgate) para dar ao saldo um historico auditavel real.
create table if not exists loyalty_ledger (
  id             uuid primary key default gen_random_uuid(),
  operator_id    uuid not null references operators(id) on delete cascade,
  customer_id    uuid not null references customers(id) on delete cascade,
  type           text not null check (type in ('earn','manual_adjust','redeem')),
  points         integer not null,
  balance_after  integer not null,
  reason         text,
  reservation_id uuid references reservations(id) on delete set null,
  voucher_id     uuid references vouchers(id) on delete set null,
  created_at     timestamptz not null default now()
);

alter table loyalty_ledger enable row level security;

drop policy if exists loyalty_ledger_acesso_proprio on loyalty_ledger;
create policy loyalty_ledger_acesso_proprio on loyalty_ledger
  for all using (operator_id in (select id from operators where user_id = auth.uid()));

create index if not exists loyalty_ledger_customer_idx on loyalty_ledger(customer_id, created_at desc);
create index if not exists loyalty_ledger_operator_idx on loyalty_ledger(operator_id, created_at desc);

-- Resgate real: converte o saldo actual num voucher de desconto de uso
-- unico, com a percentagem do nivel actual do cliente. customer_id liga o
-- voucher a quem o resgatou (nulo para vouchers normais criados a mao).
alter table vouchers add column if not exists customer_id uuid references customers(id) on delete set null;
