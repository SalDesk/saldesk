-- SalDesk - Fase 5: Frota e Equipamento

-- ============================================================
-- TABELA: fleet
-- ============================================================
create table if not exists fleet (
  id                   uuid primary key default gen_random_uuid(),
  operator_id          uuid references operators(id) on delete cascade not null,
  name                 text not null,
  type                 text not null check (type in ('vehicle','equipment','gear')),
  description          text,
  status               text default 'available' check (
                         status in ('available','in_use','maintenance','retired')
                       ),
  last_maintenance_at  timestamptz,
  next_maintenance_at  timestamptz,
  images               text[] default '{}',
  notes                text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

alter table fleet enable row level security;

create policy "fleet_acesso_proprio" on fleet
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

create trigger fleet_updated_at
  before update on fleet
  for each row execute function update_updated_at();

create index fleet_operator_idx on fleet(operator_id);
create index fleet_status_idx   on fleet(status);

-- ============================================================
-- TABELA: fleet_assignments
-- ============================================================
create table if not exists fleet_assignments (
  id             uuid primary key default gen_random_uuid(),
  fleet_id       uuid references fleet(id) on delete cascade not null,
  reservation_id uuid references reservations(id) on delete cascade not null,
  staff_id       uuid references staff(id) on delete set null,
  assigned_at    timestamptz default now(),
  returned_at    timestamptz,
  notes          text,
  created_at     timestamptz default now()
);

alter table fleet_assignments enable row level security;

create policy "fleet_assignments_acesso_proprio" on fleet_assignments
  for all using (
    fleet_id in (
      select f.id from fleet f
      join operators o on f.operator_id = o.id
      where o.user_id = auth.uid()
    )
  );

create index fleet_assignments_fleet_idx       on fleet_assignments(fleet_id);
create index fleet_assignments_reservation_idx on fleet_assignments(reservation_id);
