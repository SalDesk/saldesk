-- SalDesk - Suporte ao fluxo "Reservation System" da GetYourGuide
-- (esqueleto de melhor esforco — a GYG so revela o esquema tecnico exacto
-- depois de nos inscrevermos no Integrator Portal; ajustar campos quando
-- tivermos acesso a esse spec real)
--
-- A GYG exige um fluxo em duas fases: "Reservation" cria uma reserva
-- temporaria (hold, com expiracao) antes de o cliente pagar; "Booking"
-- confirma esse hold como reserva definitiva. Por isso usamos uma tabela
-- propria em vez de sobrecarregar "reservations" (que representa reservas
-- confirmadas).

create table if not exists ota_reservation_holds (
  id              uuid primary key default gen_random_uuid(),
  operator_id     uuid references operators(id) on delete cascade not null,
  unit_id         uuid references units(id) on delete cascade not null,
  channel         text not null default 'getyourguide' check (channel in ('getyourguide', 'viator')),
  external_ref    text,
  check_in        date not null,
  check_out       date not null,
  participants    int default 1,
  total_price     numeric(10,2),
  currency        text default 'EUR',
  status          text default 'held' check (status in ('held', 'booked', 'cancelled', 'expired')),
  reservation_id  uuid references reservations(id) on delete set null,
  expires_at      timestamptz not null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists ota_reservation_holds_unit_idx    on ota_reservation_holds(unit_id);
create index if not exists ota_reservation_holds_status_idx  on ota_reservation_holds(status);
create index if not exists ota_reservation_holds_expires_idx on ota_reservation_holds(expires_at);

alter table ota_reservation_holds enable row level security;

create policy "operador_acesso_proprio_holds" on ota_reservation_holds
  for all using (auth.uid() = (select user_id from operators where id = operator_id));

-- Nota: a expiracao automatica de holds vencidos (status -> 'expired') fica
-- para um passo seguinte (ex: cron job); o esqueleto so define a coluna.
