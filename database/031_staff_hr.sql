-- ============================================================
-- FASE — RH: ferias, documentos, certificacoes por colaborador
-- ============================================================

-- ── staff_leave — pedidos de ferias/ausencia (um registo por periodo) ──
create table if not exists staff_leave (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid references operators(id) on delete cascade not null,
  staff_id      uuid references staff(id) on delete cascade not null,
  type          text not null default 'vacation'
                  check (type in ('vacation','sick','maternity','paternity','unpaid','other')),
  start_date    date not null,
  end_date      date not null check (end_date >= start_date),
  status        text not null default 'pending'
                  check (status in ('pending','approved','rejected')),
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table staff_leave enable row level security;

create policy "staff_leave_acesso_proprio" on staff_leave
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

create index staff_leave_staff_idx on staff_leave(staff_id);
create index staff_leave_operator_idx on staff_leave(operator_id);

-- ── staff_leave_balance — direito anual a ferias, configurado pelo operador ──
create table if not exists staff_leave_balance (
  id             uuid primary key default gen_random_uuid(),
  operator_id    uuid references operators(id) on delete cascade not null,
  staff_id       uuid references staff(id) on delete cascade not null,
  year           int not null,
  entitled_days  numeric(5,1) not null default 0,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique(staff_id, year)
);

alter table staff_leave_balance enable row level security;

create policy "staff_leave_balance_acesso_proprio" on staff_leave_balance
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

-- ── staff_documents — contratos, documentos de identificacao, etc ──
create table if not exists staff_documents (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid references operators(id) on delete cascade not null,
  staff_id      uuid references staff(id) on delete cascade not null,
  type          text not null default 'other',
  name          text not null,
  file_url      text not null,
  expiry_date   date,
  created_at    timestamptz default now()
);

alter table staff_documents enable row level security;

create policy "staff_documents_acesso_proprio" on staff_documents
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

create index staff_documents_staff_idx on staff_documents(staff_id);

-- ── staff_certifications — formacao/certificacoes (mergulho, primeiros socorros, etc) ──
create table if not exists staff_certifications (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid references operators(id) on delete cascade not null,
  staff_id      uuid references staff(id) on delete cascade not null,
  name          text not null,
  issuer        text,
  issued_date   date,
  expiry_date   date,
  file_url      text,
  created_at    timestamptz default now()
);

alter table staff_certifications enable row level security;

create policy "staff_certifications_acesso_proprio" on staff_certifications
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

create index staff_certifications_staff_idx on staff_certifications(staff_id);
