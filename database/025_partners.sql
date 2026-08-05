-- Parcerias cross-selling entre operadores: antes 100% em localStorage.
create table if not exists partners (
  id                  uuid primary key default gen_random_uuid(),
  operator_id         uuid not null references operators(id) on delete cascade,
  name                text not null,
  partner_type        text not null default 'hotel',
  partnership_type     text not null default 'recommendation',
  commission_pct      numeric not null default 0,
  message_pt          text,
  message_en          text,
  bookings_sent       integer not null default 0,
  bookings_received   integer not null default 0,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_partners_operator on partners(operator_id);

alter table partners enable row level security;
drop policy if exists operador_acesso_proprio_partners on partners;
create policy operador_acesso_proprio_partners on partners
  for all using (operator_id in (select id from operators where user_id = auth.uid()));
