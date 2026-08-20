-- Liga um pedido (pre-encomenda) a uma reserva de mesa futura -- nullable,
-- pedidos feitos por QR (mesa ja ocupada) continuam sem reserva associada.
alter table orders add column if not exists reservation_id uuid references reservations(id) on delete cascade;
create index if not exists idx_orders_reservation on orders(reservation_id);

alter table orders drop constraint if exists orders_source_check;
alter table orders add constraint orders_source_check check (source in ('qr', 'staff', 'reservation'));

drop policy if exists orders_insercao_publica on orders;
create policy "orders_insercao_publica" on orders
  for insert with check (source in ('qr', 'reservation'));

drop policy if exists order_items_insercao_publica on order_items;
create policy "order_items_insercao_publica" on order_items
  for insert with check (order_id in (select id from orders where source in ('qr', 'reservation')));
