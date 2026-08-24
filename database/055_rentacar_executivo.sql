-- ============================================================
-- 055: rent-a-car — categoria "Executivo" (viatura + motorista + sem franquia)
-- ============================================================
-- "Executivo" combina 3 ideias numa so categoria: uma etiqueta de viatura
-- premium (experience_categories, para o badge no Conect), um extra real de
-- motorista incluido (driver_included/chauffeur_price na reserva, com preco
-- a serio -- ao contrario dos extras cosmeticos existentes que so caem em
-- texto livre) e "sem franquia" (beneficio automatico, sem coluna propria --
-- derivado de unit_type='Executivo' no momento de mostrar, nunca guardado).

insert into experience_categories (slug, label_pt, label_en)
values ('executivo', 'Executivo', 'Executive')
on conflict (slug) do nothing;

alter table reservations add column if not exists driver_included boolean not null default false;
alter table reservations add column if not exists chauffeur_price numeric(10,2) not null default 0;
