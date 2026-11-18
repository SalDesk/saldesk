-- SalDesk - Pedido automatico de avaliacao
--
-- Cada operador pode desligar o e-mail automatico que pede avaliacao no dia a seguir a
-- actividade/estadia (backend/src/services/pedidoAvaliacaoService.js). Ligado por omissao.
-- ATENCAO: aplicar ANTES de implantar o backend, que passa a ler esta coluna.
alter table operators add column if not exists review_auto_request boolean not null default true;
