-- Estende cms_landmarks (ate agora vazia, so Sal) para cobrir as 9 ilhas
-- de Cabo Verde e permitir uma foto real opcional por ponto turistico.
alter table cms_landmarks add column if not exists island_slug text references islands(slug);
alter table cms_landmarks add column if not exists image_url text;
create index if not exists idx_landmarks_island on cms_landmarks(island_slug);
