-- Camada de mensagens, fase 3: WhatsApp Cloud API (oficial, da Meta).
-- Desenho: "SalDesk - Camada de Mensagens (MessagingProvider)". reservations = bookings do documento.

-- 1) Janela de 24 h: cada mensagem recebida guarda o contacto, para saber se o texto livre ainda e permitido.
alter table message_inbound add column if not exists contact_e164 text;
create index if not exists inbound_contact_idx on message_inbound (operator_id, contact_e164, received_at desc)
  where contact_e164 is not null;

-- 2) Segredos cifrados (tokens da Cloud API por operador). A base de dados guarda o texto cifrado (AES-256-GCM,
--    chave no servidor) e messaging_config.cloud_token_ref aponta para ca. Sem politicas RLS: so a service role.
create table if not exists messaging_secrets (
  ref         text primary key,
  operator_id uuid not null references operators(id) on delete cascade,
  ciphertext  text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table messaging_secrets enable row level security;
revoke all on messaging_secrets from anon, authenticated;

-- 3) Consentimento: sem opt-in, so o wa.me (e a pessoa que inicia a conversa). Origem e data de cada reserva.
alter table reservations add column if not exists whatsapp_opt_in boolean not null default false;
alter table reservations add column if not exists whatsapp_opt_in_source text
  check (whatsapp_opt_in_source in ('form', 'booking_link', 'operator'));
alter table reservations add column if not exists whatsapp_opt_in_at timestamptz;

-- 4) Templates aprovados na Meta, por operador (cada WABA aprova os seus), gatilho e idioma.
create table if not exists message_meta_templates (
  id               uuid primary key default gen_random_uuid(),
  operator_id      uuid not null references operators(id) on delete cascade,
  trigger          text not null,
  locale           text not null check (locale in ('pt','en','de','nl')),
  meta_name        text not null,
  meta_language    text not null,
  meta_status      text not null default 'pending'
                   check (meta_status in ('pending','approved','rejected','paused','disabled')),
  meta_template_id text,
  meta_reason      text,
  updated_at       timestamptz not null default now(),
  unique (operator_id, trigger, locale)
);
alter table message_meta_templates enable row level security;
drop policy if exists message_meta_templates_leitura_propria on message_meta_templates;
create policy message_meta_templates_leitura_propria on message_meta_templates for select
  using (operator_id in (select id from operators where user_id = auth.uid()));

-- 5) Cada numero da Meta pertence a um so operador (o webhook identifica o operador pelo phone_number_id).
create unique index if not exists messaging_config_cloud_phone_uq on messaging_config (cloud_phone_id)
  where cloud_phone_id is not null;
create unique index if not exists messaging_config_cloud_waba_uq on messaging_config (cloud_waba_id)
  where cloud_waba_id is not null;
