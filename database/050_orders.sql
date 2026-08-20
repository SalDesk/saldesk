-- SalDesk — Fase 3: Pedidos de restaurante (mesa -> cozinha, sem pagamento online)

create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid references operators(id) on delete cascade not null,
  unit_id       uuid references units(id) on delete restrict not null, -- a mesa
  status        text default 'received' check (
                  status in ('received','preparing','ready','delivered','cancelled')
                ),
  source        text default 'qr' check (source in ('qr','staff')),
  notes         text,
  total_price   numeric(10,2) not null default 0 check (total_price >= 0),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table orders enable row level security;

create policy "orders_acesso_proprio" on orders
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

create policy "orders_insercao_publica" on orders
  for insert with check (source = 'qr');

create trigger orders_updated_at
  before update on orders
  for each row execute function update_updated_at();

create index if not exists idx_orders_operator on orders(operator_id, created_at desc);
create index if not exists idx_orders_unit     on orders(unit_id, status);

create table if not exists order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid references orders(id) on delete cascade not null,
  unit_id       uuid references units(id) on delete restrict not null, -- o prato/menu
  unit_name     text not null,   -- snapshot do nome no momento do pedido
  unit_price    numeric(10,2) not null check (unit_price >= 0), -- snapshot do base_price
  quantity      int not null check (quantity > 0),
  notes         text,            -- ex: "sem cebola"
  created_at    timestamptz default now()
);

alter table order_items enable row level security;

create policy "order_items_acesso_proprio" on order_items
  for all using (
    order_id in (
      select id from orders where operator_id in (
        select id from operators where user_id = auth.uid()
      )
    )
  );

create policy "order_items_insercao_publica" on order_items
  for insert with check (
    order_id in (select id from orders where source = 'qr')
  );

create index if not exists idx_order_items_order on order_items(order_id);
