-- Preco negociado por cliente (opcional) -- pedido real de uma operadora
-- (Satur): "nem todos tem os mesmos precos". Guardado so como referencia
-- por agora, nunca aplicado automaticamente ao calculo de reservas.
alter table customers add column if not exists custom_price numeric(10,2);
