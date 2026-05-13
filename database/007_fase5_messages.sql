-- SalDesk - Fase 5: Mensagens e Grupos

-- ============================================================
-- TABELA: message_groups
-- ============================================================
create table if not exists message_groups (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid references operators(id) on delete cascade not null,
  name        text not null,
  description text,
  created_by  uuid not null,
  members     uuid[] default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table message_groups enable row level security;

create policy "groups_acesso_proprio" on message_groups
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

create index groups_operator_idx on message_groups(operator_id);

-- ============================================================
-- TABELA: messages
-- ============================================================
create table if not exists messages (
  id                uuid primary key default gen_random_uuid(),
  operator_id       uuid references operators(id) on delete cascade not null,
  sender_id         uuid not null,
  sender_type       text not null check (sender_type in ('manager','staff','system')),
  recipient_id      uuid,
  recipient_type    text check (recipient_type in ('manager','staff','group')),
  group_id          uuid references message_groups(id) on delete set null,
  content           text not null,
  message_type      text default 'direct' check (
                      message_type in ('direct','group','system_notification')
                    ),
  notification_type text check (
                      notification_type in ('new_assignment','cancellation','reminder','general')
                    ),
  is_read           boolean default false,
  read_at           timestamptz,
  created_at        timestamptz default now()
);

alter table messages enable row level security;

create policy "messages_acesso_proprio" on messages
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

create index messages_operator_idx   on messages(operator_id);
create index messages_sender_idx     on messages(sender_id);
create index messages_recipient_idx  on messages(recipient_id);
create index messages_group_idx      on messages(group_id);
create index messages_created_idx    on messages(created_at desc);
