-- Configuracao do programa de fidelidade (antes so em localStorage,
-- nunca lida pelo backend ao atribuir pontos)
create table if not exists loyalty_config (
  operator_id     uuid primary key references operators(id) on delete cascade,
  active          boolean not null default false,
  points_per_euro numeric not null default 1,
  levels          jsonb not null default '[
    {"name":"Bronze","min":0,"max":100,"discount_pct":5,"reward":"5% desconto em todas as reservas"},
    {"name":"Prata","min":101,"max":499,"discount_pct":10,"reward":"10% desconto + upgrade gratuito disponivel"},
    {"name":"Ouro","min":500,"max":null,"discount_pct":15,"reward":"15% desconto + tour gratuito por ano"}
  ]'::jsonb,
  updated_at      timestamptz not null default now()
);

alter table loyalty_config enable row level security;

drop policy if exists operador_acesso_proprio_loyalty_config on loyalty_config;
create policy operador_acesso_proprio_loyalty_config on loyalty_config
  for all using (operator_id in (select id from operators where user_id = auth.uid()));
