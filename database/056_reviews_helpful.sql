-- ============================================================
-- 056: avaliacoes -- contador de votos "util"
-- ============================================================
-- Redesenho da ficha de actividade (estilo GetYourGuide) pede um botao
-- "achei util" por avaliacao. Visitante anonimo (sem conta), por isso o
-- voto e' contado uma vez por browser via localStorage no frontend --
-- esta coluna e' so o contador incrementado pelo endpoint publico.

alter table reviews add column if not exists helpful_count int not null default 0;
