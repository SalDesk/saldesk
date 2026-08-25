-- Duas correcoes de seguranca sinalizadas pelo advisor do Supabase.

-- 1) registar_uso_voucher tinha search_path mutavel -- referenciava
-- "vouchers" sem qualificar o schema, dependendo do search_path da sessao
-- que a chama (risco teorico de hijacking via schema criado antes de
-- "public" no search_path). Fixa o search_path e qualifica a tabela.
-- Unico caller confirmado: vouchersController.js via supabaseAdmin.rpc(),
-- chamada simples sem dependencia do search_path da sessao.
create or replace function public.registar_uso_voucher(p_voucher_id uuid)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_ok boolean;
begin
  update public.vouchers
  set uses_count = uses_count + 1, updated_at = now()
  where id = p_voucher_id
    and (max_uses = 0 or uses_count < max_uses)
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$function$;

-- 2) Extensao btree_gist estava instalada no schema "public" -- o advisor
-- recomenda mover para um schema dedicado. O projecto ja usa "extensions"
-- para pgcrypto/uuid-ossp/pg_stat_statements, e esse schema ja esta no
-- search_path por omissao ("$user", public, extensions) -- mover nao
-- afecta os operadores/indices ja usados pelas constraints de exclusao
-- reservations_no_overlap (040) e reservations_no_overlap_time (048),
-- confirmado ao vivo (insercao de reservas sobrepostas continua a
-- disparar 23P01 apos a mudanca).
alter extension btree_gist set schema extensions;
