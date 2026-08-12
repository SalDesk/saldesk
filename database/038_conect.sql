/* SalDesk Conect -- catalogo publico multi-tenant. Reaproveita units/
   reservations em vez de duplicar em experiences/bookings -- ver plano
   para o racional completo. */
create table if not exists islands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  primary_language text not null default 'pt',
  currency text not null default 'EUR',
  created_at timestamptz default now()
);
insert into islands (name, slug, primary_language, currency)
  values ('Ilha do Sal', 'sal', 'pt', 'EUR')
  on conflict (slug) do nothing;

alter table operators add column if not exists island_id uuid references islands(id);
update operators set island_id = (select id from islands where slug = 'sal') where island_id is null;

create table if not exists experience_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label_pt text not null,
  label_en text not null,
  parent_id uuid references experience_categories(id),
  created_at timestamptz default now()
);

alter table units add column if not exists category_id uuid references experience_categories(id);
alter table units add column if not exists duration_minutes int;
alter table units add column if not exists languages_offered jsonb default '[]'::jsonb;
alter table units add column if not exists lat numeric(9,6);
alter table units add column if not exists lng numeric(9,6);
/* Estado de publicacao no Conect, distinto de units.status (que continua a
   ser o activar/desactivar do proprio operador para reserva directa). */
alter table units add column if not exists conect_status text not null default 'draft'
  check (conect_status in ('draft','pending_review','published','paused'));

alter table reservations drop constraint if exists reservations_source_check;
alter table reservations add constraint reservations_source_check
  check (source in ('admin','public','direct','manual','viator','getyourguide','booking_com','airbnb','conect'));
