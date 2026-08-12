-- SalDesk - Migração: Contas de Viajante (Conect)

create table if not exists travelers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete cascade not null,
  name        text not null,
  email       text unique not null,
  phone       text,
  country     text,
  language    text default 'pt' check (language in ('pt','en')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table travelers enable row level security;

create policy "travelers_acesso_proprio" on travelers
  for all using (user_id = auth.uid());

create trigger travelers_updated_at
  before update on travelers
  for each row execute function update_updated_at();

create index travelers_email_idx on travelers(lower(email));

create table if not exists traveler_wishlist (
  id           uuid primary key default gen_random_uuid(),
  traveler_id  uuid references travelers(id) on delete cascade not null,
  unit_id      uuid references units(id) on delete cascade not null,
  created_at   timestamptz default now(),
  unique(traveler_id, unit_id)
);

alter table traveler_wishlist enable row level security;

create policy "traveler_wishlist_acesso_proprio" on traveler_wishlist
  for all using (
    traveler_id in (select id from travelers where user_id = auth.uid())
  );

create index traveler_wishlist_traveler_idx on traveler_wishlist(traveler_id);
