-- SalDesk - Fase 6: Avaliações e Fidelização

-- ============================================================
-- TABELA: reviews
-- ============================================================
create table if not exists reviews (
  id             uuid primary key default gen_random_uuid(),
  operator_id    uuid references operators(id) on delete cascade not null,
  reservation_id uuid references reservations(id) on delete cascade not null,
  customer_id    uuid references customers(id) on delete set null,
  staff_id       uuid references staff(id) on delete set null,
  rating         int not null check (rating between 1 and 5),
  comment        text,
  reply_text     text,
  replied_at     timestamptz,
  is_public      boolean default true,
  review_token   text unique,          -- token para link de avaliação por email
  token_expires_at timestamptz,
  created_at     timestamptz default now()
);

alter table reviews enable row level security;

create policy "reviews_acesso_proprio" on reviews
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

create index reviews_operator_idx    on reviews(operator_id);
create index reviews_reservation_idx on reviews(reservation_id);
create index reviews_token_idx       on reviews(review_token);

-- ============================================================
-- ALTERAR: loyalty_points em customers
-- ============================================================
alter table customers
  add column if not exists loyalty_points int default 0;

-- ============================================================
-- ALTERAR: campos de pagamento em reservations
-- ============================================================
alter table reservations
  add column if not exists payment_status  text default 'pending'
    check (payment_status in ('pending','paid','partial','refunded')),
  add column if not exists payment_method  text
    check (payment_method in ('paypal','sisp','cash','transfer')),
  add column if not exists paypal_order_id text,
  add column if not exists sisp_transaction_id text,
  add column if not exists amount_paid    numeric(10,2) default 0;
