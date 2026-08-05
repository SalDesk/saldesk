-- Vouchers / codigos de desconto (antes so em localStorage)
create table if not exists vouchers (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  code        text not null,
  type        text not null check (type in ('percent', 'fixed')),
  value       numeric not null check (value > 0),
  min_amount  numeric not null default 0,
  expires_at  date,
  max_uses    integer not null default 0,
  unit_ids    jsonb not null default '[]'::jsonb,
  active      boolean not null default true,
  uses_count  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (operator_id, code)
);

create index if not exists idx_vouchers_operator on vouchers(operator_id);

alter table vouchers enable row level security;

drop policy if exists operador_acesso_proprio_vouchers on vouchers;
create policy operador_acesso_proprio_vouchers on vouchers
  for all using (operator_id in (select id from operators where user_id = auth.uid()));
