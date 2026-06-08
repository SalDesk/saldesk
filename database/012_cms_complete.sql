-- SalDesk - Fase 3 do Painel do Fundador: CMS Completo

-- ============================================================
-- TABELA: cms_testimonials (testemunhos no website)
-- ============================================================
create table if not exists cms_testimonials (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  role        text,
  company     text,
  photo_url   text,
  text_pt     text,
  text_en     text,
  rating      int default 5,
  order_index int default 0,
  active      boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- TABELA: cms_faqs (perguntas frequentes)
-- ============================================================
create table if not exists cms_faqs (
  id           uuid primary key default gen_random_uuid(),
  question_pt  text,
  question_en  text,
  answer_pt    text,
  answer_en    text,
  category     text,
  order_index  int default 0,
  active       boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================================
-- TABELA: cms_pricing (precos dos planos Starter / Business / Pro)
-- ============================================================
create table if not exists cms_pricing (
  id          uuid primary key default gen_random_uuid(),
  plan        text unique,
  price_eur   numeric(10,2),
  price_cve   numeric(10,2),
  updated_at  timestamptz default now()
);

-- ============================================================
-- TABELA: cms_settings (configuracoes globais — pares chave/valor)
-- usada tambem para os textos do hero (hero_title_pt, hero_subtitle_en, etc.)
-- ============================================================
create table if not exists cms_settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz default now()
);

-- ============================================================
-- TABELA: cms_email_templates (templates de email transaccional)
-- ============================================================
create table if not exists cms_email_templates (
  id          uuid primary key default gen_random_uuid(),
  type        text unique,
  subject_pt  text,
  subject_en  text,
  body_pt     text,
  body_en     text,
  updated_at  timestamptz default now()
);

-- ============================================================
-- TABELA: cms_landmarks (pontos turisticos da ilha do Sal)
-- ============================================================
create table if not exists cms_landmarks (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique,
  name_pt         text,
  name_en         text,
  description_pt  text,
  description_en  text,
  type            text,
  lat             numeric(10,6),
  lng             numeric(10,6),
  how_to_get_pt   text,
  how_to_get_en   text,
  updated_at      timestamptz default now()
);

-- ============================================================
-- DADOS INICIAIS
-- ============================================================
insert into cms_pricing (plan, price_eur, price_cve) values
  ('starter',  29, 3190),
  ('business', 59, 6490),
  ('pro',      99, 10890)
on conflict (plan) do nothing;

insert into cms_email_templates (type, subject_pt, subject_en, body_pt, body_en) values
  ('confirmacao_reserva',
   'A sua reserva foi confirmada', 'Your booking is confirmed',
   'Ola {nome}, a sua reserva para {tour} no dia {data} foi confirmada.',
   'Hi {nome}, your booking for {tour} on {data} is confirmed.'),
  ('boas_vindas',
   'Bem-vindo a SalDesk', 'Welcome to SalDesk',
   'Ola {nome}, bem-vindo a SalDesk! A sua conta esta pronta a usar.',
   'Hi {nome}, welcome to SalDesk! Your account is ready to use.'),
  ('trial_a_expirar',
   'O seu periodo de teste esta a terminar', 'Your trial is ending soon',
   'Ola {nome}, faltam {dias} dias para terminar o seu periodo de teste gratuito.',
   'Hi {nome}, your free trial ends in {dias} days.'),
  ('reset_password',
   'Recuperacao de password', 'Password reset',
   'Ola {nome}, recebemos um pedido para repor a sua password. Use o link: {link}',
   'Hi {nome}, we received a request to reset your password. Use this link: {link}')
on conflict (type) do nothing;

insert into cms_settings (key, value) values
  ('hero_title_pt',       'A plataforma operacional da Ilha do Sal'),
  ('hero_title_en',       'The operating platform for Sal Island'),
  ('hero_subtitle_pt',    'Gerir reservas, equipas e clientes num so lugar.'),
  ('hero_subtitle_en',    'Manage bookings, teams and customers in one place.'),
  ('launch_date',         ''),
  ('invite_only',         'false'),
  ('coming_soon_mode',    'false'),
  ('maintenance_message', ''),
  ('social_instagram',    ''),
  ('social_facebook',     ''),
  ('social_linkedin',     '')
on conflict (key) do nothing;
