-- Fase 2 (OpenWA): o reaper passa a devolver tambem a fila as linhas do OpenWA presas em
-- "sending" (worker que morreu a meio). E seguro porque o envio leva o id da outbox como
-- Idempotency-Key e o OpenWA e so de uso interno. A Cloud API (fase 3) continua de fora: la a
-- reconciliacao e pelos webhooks de estado, antes de repetir.
create or replace function messaging_reap(p_older_than interval default interval '5 minutes')
returns int
language sql security definer set search_path = public as $$
  with r as (
    update message_outbox
       set status = 'queued', updated_at = now(), last_error = 'reaped: preso em sending'
     where status = 'sending' and provider in ('wame', 'openwa') and updated_at < now() - p_older_than
    returning 1)
  select count(*)::int from r;
$$;

revoke all on function messaging_reap(interval) from public, anon, authenticated;
grant execute on function messaging_reap(interval) to service_role;
