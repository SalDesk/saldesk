/* Regista alertas de expiracao (documentos/certificacoes) ja enviados por
   email, para o cron nao repetir a mesma notificacao todos os dias. A
   chave inclui expiry_date -- se o operador renovar o documento (nova
   data), o alerta liberta-se sozinho para essa nova data, sem precisar de
   limpar nada manualmente. */
create table if not exists staff_hr_alerts (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  kind text not null check (kind in ('document', 'certification')),
  item_id uuid not null,
  expiry_date date not null,
  sent_at timestamptz not null default now(),
  unique (kind, item_id, expiry_date)
);

alter table staff_hr_alerts enable row level security;

create policy "operator manages own hr alerts" on staff_hr_alerts
  for all using (operator_id in (select id from operators where user_id = auth.uid()));
