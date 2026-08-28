alter table operators add column if not exists is_demo boolean not null default false;
create index if not exists idx_operators_is_demo on operators(is_demo) where is_demo = true;
