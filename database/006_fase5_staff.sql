-- SalDesk - Fase 5: Colaboradores, Disponibilidade e Atribuicao de Trabalho

-- ============================================================
-- TABELA: staff
-- ============================================================
create table if not exists staff (
  id                    uuid primary key default gen_random_uuid(),
  operator_id           uuid references operators(id) on delete cascade not null,
  user_id               uuid references auth.users(id) on delete set null,
  name                  text not null,
  role                  text not null,
  phone                 text,
  email                 text,
  whatsapp              text,
  photo_url             text,
  status                text default 'active' check (status in ('active','inactive')),
  push_subscription     jsonb,
  total_jobs_completed  int default 0,
  average_rating        numeric(3,2) default 0,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

alter table staff enable row level security;

create policy "staff_acesso_proprio" on staff
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

create trigger staff_updated_at
  before update on staff
  for each row execute function update_updated_at();

create index staff_operator_idx on staff(operator_id);

-- ============================================================
-- TABELA: staff_availability
-- ============================================================
create table if not exists staff_availability (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid references staff(id) on delete cascade not null,
  operator_id uuid references operators(id) on delete cascade not null,
  date        date not null,
  is_available boolean default true,
  notes       text,
  created_at  timestamptz default now(),
  unique(staff_id, date)
);

alter table staff_availability enable row level security;

create policy "availability_acesso_proprio" on staff_availability
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

create index availability_staff_date_idx on staff_availability(staff_id, date);

-- ============================================================
-- TABELA: job_assignments
-- ============================================================
create table if not exists job_assignments (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid references reservations(id) on delete cascade not null,
  staff_id        uuid references staff(id) on delete cascade not null,
  operator_id     uuid references operators(id) on delete cascade not null,
  status          text default 'pending' check (
                    status in ('pending','confirmed','in_progress','completed','cancelled')
                  ),
  assigned_at     timestamptz default now(),
  confirmed_at    timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  notes_staff     text,
  notes_manager   text,
  earnings_amount numeric(10,2) default 0,
  earnings_paid   boolean default false,
  earnings_paid_at timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table job_assignments enable row level security;

create policy "assignments_acesso_proprio" on job_assignments
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

create trigger assignments_updated_at
  before update on job_assignments
  for each row execute function update_updated_at();

create index assignments_reservation_idx on job_assignments(reservation_id);
create index assignments_staff_idx       on job_assignments(staff_id);
create index assignments_status_idx      on job_assignments(status);
