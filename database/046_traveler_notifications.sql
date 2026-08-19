-- SalDesk Conect / conta de viajante -- notificacoes reais
-- Tabela dedicada, NAO reaproveita "notifications" (essa e operator_id not
-- null + RLS de operador, database/018_notifications.sql) -- mais seguro
-- manter separada, mesmo padrao ja usado para traveler_wishlist.

create table if not exists traveler_notifications (
  id          uuid primary key default gen_random_uuid(),
  traveler_id uuid references travelers(id) on delete cascade not null,
  type        text not null,
  content     text not null,
  link        text,
  is_read     boolean not null default false,
  created_at  timestamptz default now()
);

alter table traveler_notifications enable row level security;

create policy "traveler_notifications_acesso_proprio" on traveler_notifications
  for all using (traveler_id in (select id from travelers where user_id = auth.uid()));

create index if not exists traveler_notifications_traveler_idx
  on traveler_notifications(traveler_id, created_at desc);
