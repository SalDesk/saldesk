-- SalDesk - Fase 8: CMS, Leads e Directorio

-- ============================================================
-- TABELA: leads (formulario do website institucional)
-- ============================================================
create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  name          text,
  operator_type text,
  language      text default 'pt',
  source        text default 'website',
  is_contacted  boolean default false,
  contacted_at  timestamptz,
  converted_at  timestamptz,
  notes         text,
  created_at    timestamptz default now()
);

create index leads_email_idx   on leads(email);
create index leads_source_idx  on leads(source);
create index leads_created_idx on leads(created_at desc);

-- ============================================================
-- TABELA: cms_featured (operadores em destaque no directorio)
-- ============================================================
create table if not exists cms_featured (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid references operators(id) on delete cascade not null,
  position    int default 1,
  is_active   boolean default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz default now(),
  unique(operator_id)
);

-- ============================================================
-- TABELA: cms_banners (publicidade no directorio)
-- ============================================================
create table if not exists cms_banners (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  advertiser  text,
  image_url   text,
  link_url    text,
  position    text default 'main' check (position in ('main','grid','footer')),
  is_active   boolean default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- TABELA: cms_experiences (pacotes tematicos)
-- ============================================================
create table if not exists cms_experiences (
  id              uuid primary key default gen_random_uuid(),
  title_pt        text not null,
  title_en        text,
  description_pt  text,
  description_en  text,
  includes_pt     text,
  includes_en     text,
  price_from      numeric(10,2),
  duration_days   int,
  theme           text,
  image_url       text,
  is_active       boolean default true,
  sort_order      int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- TABELA: cms_events (calendario de epocas e eventos)
-- ============================================================
create table if not exists cms_events (
  id              uuid primary key default gen_random_uuid(),
  name_pt         text not null,
  name_en         text,
  description_pt  text,
  description_en  text,
  month_start     int check (month_start between 1 and 12),
  month_end       int check (month_end between 1 and 12),
  event_type      text default 'general' check (event_type in ('festival','sport','culture','high_season','general')),
  is_active       boolean default true,
  created_at      timestamptz default now()
);

-- ============================================================
-- TABELA: cms_articles (guia do destino)
-- ============================================================
create table if not exists cms_articles (
  id            uuid primary key default gen_random_uuid(),
  title_pt      text not null,
  title_en      text,
  excerpt_pt    text,
  excerpt_en    text,
  content_pt    text,
  content_en    text,
  category      text,
  slug          text unique,
  is_featured   boolean default false,
  is_published  boolean default false,
  published_at  timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index cms_articles_slug_idx on cms_articles(slug);

-- ============================================================
-- ALTERAR: operators — campos para pagamentos por operador
-- ============================================================
alter table operators
  add column if not exists paypal_client_id_enc  text,
  add column if not exists paypal_client_secret_enc text,
  add column if not exists sisp_merchant_id_enc  text,
  add column if not exists sisp_api_key_enc      text,
  add column if not exists plan                  text default 'starter' check (plan in ('starter','business','pro')),
  add column if not exists plan_status           text default 'trial' check (plan_status in ('trial','active','suspended','cancelled')),
  add column if not exists trial_ends_at         timestamptz default (now() + interval '30 days');
