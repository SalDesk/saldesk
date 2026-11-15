-- SalDesk - Cor da pagina publica e do widget
--
-- Cor principal escolhida pelo operador, no formato #rrggbb em minusculas (nula = cor original da marca).
-- Validada pelo backend (helpers/brandColor.js): formato e contraste minimo 4.5:1 com texto branco.
-- ATENCAO: aplicar ANTES de implantar o backend, que passa a pedir esta coluna nas rotas publicas.
alter table operators add column if not exists brand_color text;
