-- Categorias de cliente (VIP, Grupo, Corporativo) usadas pelos filtros de
-- segmento em Customers.jsx (SEGMENTS/segmented) -- ja liam customers.tags,
-- mas a coluna nunca existiu, por isso "Grupos" e "Corporativos" nunca
-- correspondiam a nenhum cliente real.
alter table customers add column if not exists tags text[] default '{}'::text[];
