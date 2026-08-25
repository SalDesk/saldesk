-- Registo de falhas de envio de email (SendGrid) -- ate agora estas falhas
-- so apareciam em console.error, invisiveis para o founder ate ele ir aos
-- logs do servidor. Tabela interna da plataforma, sem operator_id (nao e
-- por operador, e por toda a plataforma), so tocada por supabaseAdmin.
create table if not exists email_failures (
  id            uuid primary key default gen_random_uuid(),
  context       text,
  to_email      text,
  error_message text not null,
  created_at    timestamptz default now()
);
alter table email_failures enable row level security;
create index if not exists idx_email_failures_created on email_failures(created_at desc);
