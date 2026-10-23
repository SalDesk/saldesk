-- Camada de mensagens (MessagingProvider), fase 1: fundacao + wa.me.
-- Desenho: "SalDesk - Camada de Mensagens (MessagingProvider)". Aqui a tabela das reservas
-- chama-se reservations (no documento: bookings) e o RLS segue o padrao do projecto
-- (operator_id in (select id from operators where user_id = auth.uid())).
-- O backend usa a service role e filtra sempre por operator_id; o RLS e uma segunda barreira.

-- Configuracao do canal por operador
create table if not exists messaging_config (
  operator_id      uuid primary key references operators(id) on delete cascade,
  provider         text not null default 'wame'
                   check (provider in ('wame','cloud_api','openwa')),
  wa_number        text,                    -- E.164 do operador
  cloud_phone_id   text,
  cloud_waba_id    text,
  cloud_token_ref  text,                    -- referencia ao segredo, nunca o token
  cloud_status     text not null default 'none'
                   check (cloud_status in ('none','pending','active','suspended')),
  quality_rating   text,
  updated_at       timestamptz not null default now()
);

-- Templates por operador, gatilho e idioma (sem linha = usa o texto por omissao do codigo)
create table if not exists message_templates (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null references operators(id) on delete cascade,
  trigger       text not null,              -- booking_confirmed, reminder_d1, review_request
  locale        text not null check (locale in ('pt','en','de','nl')),
  body          text not null,              -- usado pelo wa.me e na pre-visualizacao
  meta_name     text,                       -- nome do template aprovado na Meta (Cloud API)
  meta_status   text check (meta_status in ('pending','approved','rejected','paused')),
  updated_at    timestamptz not null default now(),
  unique (operator_id, trigger, locale)
);

-- Outbox: fonte unica da verdade do envio
create table if not exists message_outbox (
  id                  uuid primary key default gen_random_uuid(),
  operator_id         uuid not null references operators(id) on delete cascade,
  booking_id          uuid references reservations(id) on delete set null,
  trigger             text not null,
  to_e164             text not null,
  locale              text not null check (locale in ('pt','en','de','nl')),
  payload             jsonb not null,       -- OutboundMessage ja renderizada + dados para mostrar no painel
  provider            text not null check (provider in ('wame','cloud_api','openwa')),
  status              text not null default 'queued'
                      check (status in ('queued','sending','sent','delivered','read',
                                        'awaiting_human','failed','cancelled')),
  attempts            int not null default 0,
  next_attempt_at     timestamptz not null default now(),
  provider_message_id text,
  handoff_url         text,                 -- wa.me: link que o humano abre
  opened_at           timestamptz,          -- wa.me: quando o link foi aberto
  last_error          text,
  dedupe_key          text not null,        -- ex. booking_id:trigger
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (operator_id, dedupe_key)
);

create index if not exists outbox_due_idx on message_outbox (next_attempt_at)
  where status = 'queued';
create index if not exists outbox_provider_msg_idx on message_outbox (provider_message_id)
  where provider_message_id is not null;
create index if not exists outbox_operator_status_idx on message_outbox (operator_id, status, created_at desc);
create index if not exists outbox_booking_idx on message_outbox (booking_id) where booking_id is not null;

-- Eventos recebidos (mensagens e estados), guardados em bruto antes de processar (fases 3 e 4)
create table if not exists message_inbound (
  id                  bigint generated always as identity primary key,
  operator_id         uuid references operators(id) on delete cascade,
  provider            text not null,
  provider_event_id   text not null,
  payload             jsonb not null,
  processed_at        timestamptz,
  received_at         timestamptz not null default now(),
  unique (provider, provider_event_id)
);

alter table messaging_config  enable row level security;
alter table message_templates enable row level security;
alter table message_outbox    enable row level security;
alter table message_inbound   enable row level security;

drop policy if exists messaging_config_acesso_proprio on messaging_config;
create policy messaging_config_acesso_proprio on messaging_config for all
  using (operator_id in (select id from operators where user_id = auth.uid()))
  with check (operator_id in (select id from operators where user_id = auth.uid()));

drop policy if exists message_templates_acesso_proprio on message_templates;
create policy message_templates_acesso_proprio on message_templates for all
  using (operator_id in (select id from operators where user_id = auth.uid()))
  with check (operator_id in (select id from operators where user_id = auth.uid()));

-- Outbox e inbound: o operador so le; quem escreve e o backend (service role)
drop policy if exists message_outbox_leitura_propria on message_outbox;
create policy message_outbox_leitura_propria on message_outbox for select
  using (operator_id in (select id from operators where user_id = auth.uid()));

drop policy if exists message_inbound_leitura_propria on message_inbound;
create policy message_inbound_leitura_propria on message_inbound for select
  using (operator_id in (select id from operators where user_id = auth.uid()));

-- Enfileira uma mensagem de forma idempotente: o mesmo (operator_id, dedupe_key) nunca duplica.
-- Devolve o id e se foi criada agora. Como o supabase-js nao faz transaccoes, a idempotencia
-- vive aqui, na unique constraint.
create or replace function messaging_enqueue(
  p_operator_id     uuid,
  p_booking_id      uuid,
  p_trigger         text,
  p_to_e164         text,
  p_locale          text,
  p_payload         jsonb,
  p_provider        text,
  p_dedupe_key      text,
  p_next_attempt_at timestamptz default now()
) returns table (id uuid, created boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  insert into message_outbox (operator_id, booking_id, trigger, to_e164, locale, payload, provider, dedupe_key, next_attempt_at)
  values (p_operator_id, p_booking_id, p_trigger, p_to_e164, p_locale, p_payload, p_provider, p_dedupe_key, p_next_attempt_at)
  on conflict (operator_id, dedupe_key) do nothing
  returning message_outbox.id into v_id;

  if v_id is not null then
    return query select v_id, true;
  else
    return query select o.id, false from message_outbox o
      where o.operator_id = p_operator_id and o.dedupe_key = p_dedupe_key;
  end if;
end $$;

-- Reclama um lote de mensagens vencidas (FOR UPDATE SKIP LOCKED: dois workers nunca apanham a mesma).
create or replace function messaging_claim(p_limit int default 20)
returns setof message_outbox
language sql security definer set search_path = public as $$
  update message_outbox o
     set status = 'sending', attempts = attempts + 1, updated_at = now()
   where o.id in (
     select id from message_outbox
      where status = 'queued' and next_attempt_at <= now()
      order by next_attempt_at
      limit p_limit
      for update skip locked)
  returning o.*;
$$;

-- Reclama uma mensagem concreta (envio imediato a partir do painel, sem esperar pelo worker).
create or replace function messaging_claim_one(p_id uuid)
returns setof message_outbox
language sql security definer set search_path = public as $$
  update message_outbox o
     set status = 'sending', attempts = attempts + 1, updated_at = now()
   where o.id = (
     select id from message_outbox where id = p_id and status = 'queued' for update skip locked)
  returning o.*;
$$;

-- Devolve a "queued" as linhas presas em "sending" ha mais de p_older_than.
-- So para wa.me: nao ha envio externo, por isso repetir e inofensivo. Os outros adapters
-- (Cloud API) exigem confirmacao pelos webhooks de estado antes de repetir (fase 3).
create or replace function messaging_reap(p_older_than interval default interval '5 minutes')
returns int
language sql security definer set search_path = public as $$
  with r as (
    update message_outbox
       set status = 'queued', updated_at = now(), last_error = 'reaped: preso em sending'
     where status = 'sending' and provider = 'wame' and updated_at < now() - p_older_than
    returning 1)
  select count(*)::int from r;
$$;

-- So o backend (service role) chama estas funcoes.
revoke all on function messaging_enqueue(uuid,uuid,text,text,text,jsonb,text,text,timestamptz) from public, anon, authenticated;
revoke all on function messaging_claim(int) from public, anon, authenticated;
revoke all on function messaging_claim_one(uuid) from public, anon, authenticated;
revoke all on function messaging_reap(interval) from public, anon, authenticated;
grant execute on function messaging_enqueue(uuid,uuid,text,text,text,jsonb,text,text,timestamptz) to service_role;
grant execute on function messaging_claim(int) to service_role;
grant execute on function messaging_claim_one(uuid) to service_role;
grant execute on function messaging_reap(interval) to service_role;
