-- SalDesk - Migração Fase 1: Auth + Onboarding + Unidades
-- Executar no SQL Editor do Supabase

-- ============================================================
-- TABELA: operators
-- ============================================================
create table if not exists operators (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null unique,
  name            text not null,
  slug            text unique not null,
  operator_type   text not null check (operator_type in ('hotel', 'activity', 'rentacar', 'restaurant')),
  email           text not null,
  phone           text,
  address         text,
  logo_url        text,
  onboarding_complete boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table operators enable row level security;

create policy "operador_acesso_proprio" on operators
  for all using (auth.uid() = user_id);

-- ============================================================
-- TABELA: units
-- Representa: quartos (hotel), actividades, veículos, mesas
-- ============================================================
create table if not exists units (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid references operators(id) on delete cascade not null,
  name          text not null,
  description   text,
  unit_type     text not null,
  base_price    numeric(10,2) not null check (base_price >= 0),
  capacity      int default 1 check (capacity > 0),
  status        text default 'active' check (status in ('active', 'inactive')),
  images        jsonb default '[]',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table units enable row level security;

create policy "unidades_acesso_proprio" on units
  for all using (
    operator_id in (
      select id from operators where user_id = auth.uid()
    )
  );

-- ============================================================
-- TABELA: pricing_rules
-- Modificadores de preço por época, dia da semana, etc.
-- ============================================================
create table if not exists pricing_rules (
  id              uuid primary key default gen_random_uuid(),
  unit_id         uuid references units(id) on delete cascade not null,
  name            text not null,
  price_modifier  numeric(10,2) not null,
  modifier_type   text not null check (modifier_type in ('percentage', 'fixed')),
  start_date      date,
  end_date        date,
  days_of_week    jsonb,       -- ex: [1,2,3,4,5] para seg-sex
  active          boolean default true,
  created_at      timestamptz default now()
);

alter table pricing_rules enable row level security;

create policy "regras_acesso_proprio" on pricing_rules
  for all using (
    unit_id in (
      select u.id from units u
      join operators o on u.operator_id = o.id
      where o.user_id = auth.uid()
    )
  );

-- ============================================================
-- FUNÇÃO: actualizar updated_at automaticamente
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger operators_updated_at
  before update on operators
  for each row execute function update_updated_at();

create trigger units_updated_at
  before update on units
  for each row execute function update_updated_at();
