-- SalDesk - Migracao Fase 2 v2: colunas adicionais em operators
-- Executar no SQL Editor do Supabase

alter table operators
  add column if not exists description text,
  add column if not exists whatsapp    text,
  add column if not exists language    text default 'pt',
  add column if not exists currency    text default 'EUR',
  add column if not exists timezone    text default 'Atlantic/Cape_Verde';

-- Adicionar customer_id a reservations (ligacao CRM)
alter table reservations
  add column if not exists customer_id uuid references customers(id) on delete set null;

create index if not exists reservations_customer_idx on reservations(customer_id);
