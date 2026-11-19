-- SalDesk - Prazo de cancelamento gratis e confirmacao automatica por operador
--
-- free_cancellation_hours: null = sem prazo definido; 0 = sem cancelamento gratis; 24/48/72/168 (7 dias).
--   Mostrado nos cartoes do catalogo e usado para gerar o texto da politica quando o operador nao escreveu nenhum.
-- auto_confirm_bookings: reservas da pagina publica pagas presencialmente entram logo confirmadas.
-- ATENCAO: aplicar ANTES de implantar o backend, que passa a ler estas colunas.
alter table operators add column if not exists free_cancellation_hours integer null;
alter table operators drop constraint if exists operators_free_cancellation_hours_check;
alter table operators add constraint operators_free_cancellation_hours_check
  check (free_cancellation_hours is null or free_cancellation_hours in (0, 24, 48, 72, 168));
alter table operators add column if not exists auto_confirm_bookings boolean not null default false;
