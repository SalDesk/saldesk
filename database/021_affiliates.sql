-- Programa de Afiliados: antes 100% em localStorage (config, afiliados,
-- pagamentos), sem nenhuma ligacao a reservas reais. bookings_count/avg
-- eram valores manuais, nunca actualizados por uma reserva real, e o
-- Portal do Afiliado "autenticava" lendo o localStorage do proprio
-- browser do operador -- impossivel de funcionar para um afiliado externo.

create table if not exists affiliate_config (
  operator_id       uuid primary key references operators(id) on delete cascade,
  active            boolean not null default false,
  commission_pct    numeric not null default 10,
  min_booking_value numeric not null default 0,
  updated_at        timestamptz not null default now()
);

create table if not exists affiliates (
  id              uuid primary key default gen_random_uuid(),
  operator_id     uuid not null references operators(id) on delete cascade,
  name            text not null,
  email           text not null,
  code            text not null,
  commission_pct  numeric not null default 10,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (operator_id, code)
);
create index if not exists idx_affiliates_operator on affiliates(operator_id);

create table if not exists affiliate_payments (
  id              uuid primary key default gen_random_uuid(),
  affiliate_id    uuid not null references affiliates(id) on delete cascade,
  amount          numeric not null check (amount > 0),
  payment_date    date not null default current_date,
  note            text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_affiliate_payments_affiliate on affiliate_payments(affiliate_id);

alter table reservations add column if not exists affiliate_id uuid references affiliates(id);
create index if not exists idx_reservations_affiliate on reservations(affiliate_id);

alter table affiliate_config enable row level security;
alter table affiliates enable row level security;
alter table affiliate_payments enable row level security;

drop policy if exists operador_acesso_proprio_affiliate_config on affiliate_config;
create policy operador_acesso_proprio_affiliate_config on affiliate_config
  for all using (operator_id in (select id from operators where user_id = auth.uid()));

drop policy if exists operador_acesso_proprio_affiliates on affiliates;
create policy operador_acesso_proprio_affiliates on affiliates
  for all using (operator_id in (select id from operators where user_id = auth.uid()));

drop policy if exists operador_acesso_proprio_affiliate_payments on affiliate_payments;
create policy operador_acesso_proprio_affiliate_payments on affiliate_payments
  for all using (affiliate_id in (
    select a.id from affiliates a
    join operators o on o.id = a.operator_id
    where o.user_id = auth.uid()
  ));
