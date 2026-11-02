-- Reenvio automatico de emails que falham (SendGrid em baixo, creditos, conta bloqueada...).
-- email_failures passa de simples registo a fila de reenvio: guarda o conteudo (payload) e o estado da tentativa.
-- Linhas antigas (sem conteudo) ficam como 'legacy': nao ha o que reenviar.

alter table email_failures add column if not exists payload         jsonb;
alter table email_failures add column if not exists kind            text not null default 'transactional';
alter table email_failures add column if not exists status          text not null default 'pending';
alter table email_failures add column if not exists attempts        int  not null default 1;
alter table email_failures add column if not exists next_attempt_at timestamptz;
alter table email_failures add column if not exists last_error      text;
alter table email_failures add column if not exists sent_at         timestamptz;
alter table email_failures add column if not exists alerted_at      timestamptz;
alter table email_failures add column if not exists updated_at      timestamptz not null default now();

update email_failures set status = 'legacy' where payload is null;

alter table email_failures drop constraint if exists email_failures_status_check;
alter table email_failures add constraint email_failures_status_check
  check (status in ('pending', 'sending', 'sent', 'abandoned', 'permanent', 'legacy'));
alter table email_failures drop constraint if exists email_failures_kind_check;
alter table email_failures add constraint email_failures_kind_check
  check (kind in ('transactional', 'alert'));

create index if not exists email_failures_due_idx on email_failures (next_attempt_at) where status = 'pending';
create index if not exists email_failures_status_idx on email_failures (status, created_at desc);
