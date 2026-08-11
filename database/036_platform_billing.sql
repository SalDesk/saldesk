/* Cobranca real da subscricao SalDesk (nao das reservas dos operadores).
   plan_paid_until cobre o acesso mesmo depois do trial_ends_at passar,
   sem precisar de um motor de recorrencia -- ver requirePlanActive. */
alter table operators add column if not exists plan_paid_until timestamptz;

create table if not exists platform_payments (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  plan text not null check (plan in ('starter','business','pro')),
  amount_eur numeric(10,2) not null,
  gateway text not null default 'paypal',
  gateway_order_id text,
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  created_at timestamptz default now(),
  completed_at timestamptz
);
alter table platform_payments enable row level security;
create policy "operator ve os proprios pagamentos" on platform_payments
  for select using (operator_id in (select id from operators where user_id = auth.uid()));
