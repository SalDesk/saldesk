-- Despesas, configuracao salarial, pagamentos de salario e obrigacoes
-- financeiras do operador -- ate agora guardados so em localStorage do
-- browser (frontend/src/services/expensesService.js), o que fazia o
-- operador perder tudo ao limpar o browser ou mudar de dispositivo.

create table if not exists expenses (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null references operators(id) on delete cascade,
  category      text not null,
  amount        numeric(12,2) not null,
  currency      text not null default 'EUR',
  date          date not null,
  staff_id      uuid references staff(id) on delete set null,
  is_recurring  boolean not null default false,
  notes         text,
  receipt_url   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_expenses_operator on expenses(operator_id, date desc);

create table if not exists salary_configs (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null references operators(id) on delete cascade,
  staff_id      uuid not null references staff(id) on delete cascade,
  base          numeric(12,2) not null default 0,
  food          numeric(12,2) not null default 0,
  transport     numeric(12,2) not null default 0,
  inps_pct      numeric(5,2) not null default 15,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (operator_id, staff_id)
);

create table if not exists salary_payments (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null references operators(id) on delete cascade,
  staff_id      uuid not null references staff(id) on delete cascade,
  month         int not null,
  year          int not null,
  amount        numeric(12,2) not null,
  paid_at       timestamptz not null default now()
);
create index if not exists idx_salary_payments_operator on salary_payments(operator_id, year, month);

create table if not exists operator_obligations (
  operator_id   uuid primary key references operators(id) on delete cascade,
  data          jsonb not null default '{}',
  updated_at    timestamptz not null default now()
);
