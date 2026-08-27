-- SalDesk - Programa de referencia entre operadores (aquisicao da propria
-- plataforma, distinto do afiliados/parcerias que ja existem para os
-- operadores venderem aos SEUS clientes)

-- Liga uma candidatura (operator_leads) ao operador que a indicou, via o
-- link unico saldesk.cv/operadores.html?ref={slug do operador}. Nullable --
-- a maioria das candidaturas continua a nao vir de indicacao nenhuma.
alter table operator_leads add column if not exists referred_by_operator_id uuid references operators(id) on delete set null;
create index if not exists idx_operator_leads_referred_by on operator_leads(referred_by_operator_id);
