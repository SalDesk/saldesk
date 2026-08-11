alter table operators add column if not exists paypal_subscription_id text;

create table if not exists platform_paypal_plans (
  plan text primary key check (plan in ('starter','business','pro')),
  paypal_product_id text not null,
  paypal_plan_id text not null,
  created_at timestamptz default now()
);
