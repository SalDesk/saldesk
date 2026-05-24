-- SalDesk - Migração 011: Expandir tabela leads para formulário de entrevista

-- A tabela leads já existe (criada em 010_fase8_cms.sql) com colunas básicas.
-- Este script adiciona todas as colunas do formulário de candidatura de operadores.

alter table leads
  add column if not exists telefone           text,
  add column if not exists whatsapp           text,
  add column if not exists funcao             text,
  add column if not exists nome_negocio       text,
  add column if not exists tipo_negocio       text,
  add column if not exists localizacao        text,
  add column if not exists anos_operacao      text,
  add column if not exists clientes_mes       text,
  add column if not exists tem_site           boolean default false,
  add column if not exists url_site           text,
  add column if not exists como_gere_reservas text[],
  add column if not exists desafios           text[],
  add column if not exists num_funcionarios   text,
  add column if not exists otas               text[],
  add column if not exists volume_mensal      text,
  add column if not exists plano_interesse    text,
  add column if not exists quando_comecar     text,
  add column if not exists como_soube         text,
  add column if not exists disponivel_demo    boolean default false,
  add column if not exists horario_contacto   text,
  add column if not exists comentarios        text,
  add column if not exists aceita_termos      boolean default false,
  add column if not exists aceita_comunicacoes boolean default false,
  add column if not exists status             text default 'novo';

-- Índice adicional por status para o painel admin
create index if not exists leads_status_idx on leads(status);
