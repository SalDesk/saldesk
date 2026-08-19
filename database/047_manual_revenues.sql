-- Receitas manuais -- ate agora o Financeiro so mostrava receita gerada
-- automaticamente a partir de reservations.total_price (status checked_out).
-- Operadores com receita fora do motor de reservas (ex. venda directa ao
-- balcao, comissao de parceiro) nao tinham onde a registar.

create table if not exists manual_revenues (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null references operators(id) on delete cascade,
  category      text not null,
  amount        numeric(12,2) not null,
  currency      text not null default 'EUR',
  date          date not null,
  notes         text,
  receipt_url   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_manual_revenues_operator on manual_revenues(operator_id, date desc);
alter table manual_revenues enable row level security;
