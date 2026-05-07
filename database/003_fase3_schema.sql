-- SalDesk - Migração Fase 3: CRM + Automações
-- Executar no SQL Editor do Supabase após 002_fase2_schema.sql

-- ============================================================
-- TABELA: customers
-- Criada automaticamente a cada nova reserva
-- ============================================================
create table if not exists customers (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid references operators(id) on delete cascade not null,
  name          text not null,
  email         text not null,
  phone         text,
  country_code  text,
  language      text default 'pt' check (language in ('pt', 'en')),
  total_visits  int default 0 check (total_visits >= 0),
  total_spent   numeric(10,2) default 0 check (total_spent >= 0),
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(operator_id, email)
);

alter table customers enable row level security;

create policy "customers_acesso_proprio" on customers
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

create trigger customers_updated_at
  before update on customers
  for each row execute function update_updated_at();

create index customers_operator_email_idx on customers(operator_id, email);
create index customers_total_spent_idx on customers(operator_id, total_spent desc);

-- ============================================================
-- ALTERAR reservations: adicionar customer_id
-- ============================================================
alter table reservations
  add column if not exists customer_id uuid references customers(id) on delete set null;

create index reservations_customer_idx on reservations(customer_id);

-- ============================================================
-- TABELA: automations
-- ============================================================
create table if not exists automations (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid references operators(id) on delete cascade not null,
  name          text not null,
  trigger_type  text not null check (
                  trigger_type in (
                    'booking_confirmed',
                    'checkin_reminder',
                    'checkout_thanks',
                    'days_before_checkin',
                    'days_after_checkout'
                  )
                ),
  trigger_days  int,   -- usado em days_before_checkin e days_after_checkout
  channel       text not null check (channel in ('email', 'whatsapp')),
  subject       text,  -- apenas para email
  message_pt    text not null,
  message_en    text not null,
  active        boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table automations enable row level security;

create policy "automations_acesso_proprio" on automations
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

create trigger automations_updated_at
  before update on automations
  for each row execute function update_updated_at();

-- ============================================================
-- TABELA: automation_logs
-- Registo de cada mensagem enviada (evita duplicados)
-- ============================================================
create table if not exists automation_logs (
  id              uuid primary key default gen_random_uuid(),
  automation_id   uuid references automations(id) on delete cascade not null,
  reservation_id  uuid references reservations(id) on delete cascade not null,
  customer_id     uuid references customers(id) on delete set null,
  channel         text not null,
  status          text not null check (status in ('sent', 'failed')),
  error_message   text,
  sent_at         timestamptz default now(),
  unique(automation_id, reservation_id)
);

alter table automation_logs enable row level security;

create policy "automation_logs_acesso_proprio" on automation_logs
  for all using (
    automation_id in (
      select id from automations
      where operator_id in (select id from operators where user_id = auth.uid())
    )
  );

create index automation_logs_automation_idx on automation_logs(automation_id);
create index automation_logs_reservation_idx on automation_logs(reservation_id);
