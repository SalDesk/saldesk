-- SalDesk - Migracao Fase 5: Channel Manager (Viator + GetYourGuide)
-- Executar no SQL Editor do Supabase apos 004_fase2_v2_operators.sql

-- ============================================================
-- TABELA: operator_channels
-- Configuracao de cada canal OTA por operador
-- ============================================================
create table if not exists operator_channels (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid references operators(id) on delete cascade not null,
  channel       text not null check (channel in ('viator', 'getyourguide')),
  api_key_enc   text not null,           -- API key encriptada (AES-256)
  supplier_id   text,                    -- ID do fornecedor na plataforma
  product_ids   text[],                  -- IDs dos produtos/experiencias
  is_active     boolean default true,
  last_sync_at  timestamptz,
  sync_error    text,                    -- ultima mensagem de erro de sync
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(operator_id, channel)
);

alter table operator_channels enable row level security;

create policy "channels_acesso_proprio" on operator_channels
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

create trigger channels_updated_at
  before update on operator_channels
  for each row execute function update_updated_at();

-- ============================================================
-- TABELA: integration_logs
-- Registo de cada evento recebido ou enviado
-- ============================================================
create table if not exists integration_logs (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid references operators(id) on delete cascade not null,
  channel       text not null,
  event_type    text not null,           -- booking_new, booking_cancelled, sync, etc.
  payload       jsonb,
  status        text not null check (status in ('received', 'processed', 'failed')),
  error_message text,
  external_ref  text,                    -- ID da reserva na OTA (para idempotencia)
  created_at    timestamptz default now()
);

alter table integration_logs enable row level security;

create policy "logs_acesso_proprio" on integration_logs
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

create index integration_logs_operator_idx  on integration_logs(operator_id);
create index integration_logs_channel_idx   on integration_logs(channel);
create index integration_logs_external_idx  on integration_logs(external_ref);
create index integration_logs_created_idx   on integration_logs(created_at desc);

-- Adicionar source values a reservations para OTAs
-- (a constraint ja existe mas pode precisar de ser actualizada)
alter table reservations
  drop constraint if exists reservations_source_check;

alter table reservations
  add constraint reservations_source_check
  check (source in ('admin','public','direct','manual','viator','getyourguide','booking_com','airbnb'));
