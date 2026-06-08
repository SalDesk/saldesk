-- SalDesk - Fase 5 do Painel do Fundador: Comunicacao Avancada

-- ============================================================
-- TABELA: admin_messages (chat directo admin <-> operador)
-- ============================================================
create table if not exists admin_messages (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid references operators(id) on delete cascade not null,
  sender_type  text not null check (sender_type in ('admin', 'operator')),
  content      text not null,
  is_read      boolean default false,
  read_at      timestamptz,
  created_at   timestamptz default now()
);

create index admin_messages_operator_idx on admin_messages(operator_id);
create index admin_messages_created_idx  on admin_messages(created_at desc);

-- ============================================================
-- TABELA: admin_broadcasts (broadcasts e emails de marketing)
-- ============================================================
create table if not exists admin_broadcasts (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  content        text not null,
  channel        text not null check (channel in ('email', 'app')),
  target         text not null default 'all',
  segment_plan   text,
  segment_type   text,
  subject        text,
  sent_count     int default 0,
  read_count     int default 0,
  scheduled_at   timestamptz,
  sent_at        timestamptz,
  created_at     timestamptz default now()
);

create index admin_broadcasts_created_idx on admin_broadcasts(created_at desc);
create index admin_broadcasts_channel_idx on admin_broadcasts(channel);
