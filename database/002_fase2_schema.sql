-- SalDesk - Migração Fase 2: Motor de Reservas + Calendário
-- Executar no SQL Editor do Supabase após 001_fase1_schema.sql

-- ============================================================
-- TABELA: reservations
-- ============================================================
create table if not exists reservations (
  id                uuid primary key default gen_random_uuid(),
  operator_id       uuid references operators(id) on delete cascade not null,
  unit_id           uuid references units(id) on delete restrict not null,
  customer_name     text not null,
  customer_email    text not null,
  customer_phone    text,
  customer_country  text,
  check_in          date not null,
  check_out         date not null,
  guests            int default 1 check (guests > 0),
  total_price       numeric(10,2) not null check (total_price >= 0),
  status            text default 'pending' check (
                      status in ('pending','confirmed','checked_in','checked_out','cancelled')
                    ),
  source            text default 'admin' check (source in ('admin','public')),
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  constraint check_dates check (check_out > check_in)
);

alter table reservations enable row level security;

-- Operador acede às suas próprias reservas
create policy "reservations_acesso_proprio" on reservations
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

-- Acesso público para inserção (reservas pelo formulário público)
create policy "reservations_insercao_publica" on reservations
  for insert with check (source = 'public');

create trigger reservations_updated_at
  before update on reservations
  for each row execute function update_updated_at();

-- Índices para queries frequentes
create index reservations_operator_idx on reservations(operator_id);
create index reservations_unit_idx on reservations(unit_id);
create index reservations_checkin_idx on reservations(check_in);
create index reservations_status_idx on reservations(status);

-- ============================================================
-- TABELA: blocked_dates
-- Datas bloqueadas pelo operador (manutenção, etc.)
-- ============================================================
create table if not exists blocked_dates (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid references units(id) on delete cascade not null,
  date        date not null,
  reason      text,
  created_at  timestamptz default now(),
  unique(unit_id, date)
);

alter table blocked_dates enable row level security;

create policy "blocked_dates_acesso_proprio" on blocked_dates
  for all using (
    unit_id in (
      select u.id from units u
      join operators o on u.operator_id = o.id
      where o.user_id = auth.uid()
    )
  );

create index blocked_dates_unit_date_idx on blocked_dates(unit_id, date);
