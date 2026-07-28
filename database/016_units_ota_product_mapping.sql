-- SalDesk - Mapeamento de unidades a produtos OTA (Viator / GetYourGuide)
-- Corrige o bug de routing: o webhook escolhia sempre a primeira unidade
-- activa do operador, ignorando o productCode do booking.

alter table units
  add column if not exists ota_product_ids jsonb default '{}'::jsonb;

-- Formato: { "viator": "12345P1", "getyourguide": "67890" }
-- Uma unidade sem entrada para um canal simplesmente nao participa no
-- mapeamento por codigo de produto desse canal.
