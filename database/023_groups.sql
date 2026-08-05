-- Cotacoes de Grupos/Eventos corporativos: antes 100% em localStorage,
-- sem persistencia real nem sincronizacao entre dispositivos.
create table if not exists groups (
  id                uuid primary key default gen_random_uuid(),
  operator_id       uuid not null references operators(id) on delete cascade,
  company           text not null,
  event_type        text not null default 'outro',
  tour_ids          jsonb not null default '[]'::jsonb,
  event_date        date,
  guests            integer not null default 1,
  budget            numeric not null default 0,
  notes             text,
  discount_pct      numeric not null default 0,
  signal_pct        numeric not null default 30,
  days_before       integer not null default 7,
  proposal_expires  date,
  status            text not null default 'pedido',
  payments          jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_groups_operator on groups(operator_id);

alter table groups enable row level security;
drop policy if exists operador_acesso_proprio_groups on groups;
create policy operador_acesso_proprio_groups on groups
  for all using (operator_id in (select id from operators where user_id = auth.uid()));
