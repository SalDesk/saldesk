-- Pacotes sazonais (combinacoes de tours com preco especial): antes 100%
-- em localStorage. bookings_count fica em 0 ate existir um endpoint
-- publico de compra (fora do scope desta correcao) -- pelo menos deixa
-- de se perder ao limpar o browser ou mudar de dispositivo.
create table if not exists packages (
  id              uuid primary key default gen_random_uuid(),
  operator_id     uuid not null references operators(id) on delete cascade,
  name_pt         text not null,
  name_en         text,
  description_pt  text,
  description_en  text,
  tour_ids        jsonb not null default '[]'::jsonb,
  valid_from      date,
  valid_to        date,
  price           numeric not null default 0,
  original_price  numeric not null default 0,
  sales_limit     integer not null default 0,
  bookings_count  integer not null default 0,
  photo_url       text,
  status          text not null default 'activo',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_packages_operator on packages(operator_id);

alter table packages enable row level security;
drop policy if exists operador_acesso_proprio_packages on packages;
create policy operador_acesso_proprio_packages on packages
  for all using (operator_id in (select id from operators where user_id = auth.uid()));
