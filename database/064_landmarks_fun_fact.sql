-- "Voce Sabia" -- facto curioso opcional por ponto turistico, mostrado
-- na pagina de detalhe (website/discover/ponto.html).
alter table cms_landmarks add column if not exists fun_fact_pt text;
alter table cms_landmarks add column if not exists fun_fact_en text;
