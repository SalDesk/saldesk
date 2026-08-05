-- Bug pre-existente: requestReview() faz upsert com onConflict:'reservation_id'
-- mas a tabela nunca teve essa constraint -- o pedido de avaliacao falhava
-- sempre com erro do Postgres (42P10, "no unique or exclusion constraint").
alter table reviews add constraint reviews_reservation_id_key unique (reservation_id);
