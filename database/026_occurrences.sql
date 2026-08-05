-- Registo de ocorrencias/incidentes operacionais: antes 100% em
-- localStorage, perdido ao limpar o browser ou mudar de dispositivo.
create table if not exists occurrences (
  id             uuid primary key default gen_random_uuid(),
  operator_id    uuid not null references operators(id) on delete cascade,
  unit_id        uuid references units(id) on delete set null,
  unit_name      text,
  staff_id       uuid references staff(id) on delete set null,
  staff_name     text,
  type           text not null default 'incidente',
  severity       text not null default 'media',
  description    text not null,
  actions_taken  text,
  photo_urls     text,
  occurred_at    date not null default current_date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_occurrences_operator on occurrences(operator_id);

alter table occurrences enable row level security;
drop policy if exists operador_acesso_proprio_occurrences on occurrences;
create policy operador_acesso_proprio_occurrences on occurrences
  for all using (operator_id in (select id from operators where user_id = auth.uid()));
