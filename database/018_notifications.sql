-- Notificacoes do operador (sino no Topbar)
create table if not exists notifications (
  id                uuid primary key default gen_random_uuid(),
  operator_id       uuid not null references operators(id) on delete cascade,
  notification_type text not null,
  content           text not null,
  link              text,
  is_read           boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists idx_notifications_operator on notifications(operator_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists operador_acesso_proprio_notifications on notifications;
create policy operador_acesso_proprio_notifications on notifications
  for all using (operator_id in (select id from operators where user_id = auth.uid()));
