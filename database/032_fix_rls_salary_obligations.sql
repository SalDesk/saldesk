-- ============================================================
-- FIX DE SEGURANCA — salary_configs e operator_obligations
-- tinham RLS desactivado desde a sua criacao (030_expenses_salary_obligations.sql),
-- ficando totalmente expostas ao anon/authenticated key do Supabase.
-- O backend usa sempre a service_role key (ignora RLS), por isso esta
-- correccao nao tem impacto funcional na app -- so fecha o acesso directo
-- indevido via client-side Supabase.
-- ============================================================

alter table public.salary_configs enable row level security;
alter table public.operator_obligations enable row level security;

create policy "salary_configs_acesso_proprio" on public.salary_configs
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );

create policy "operator_obligations_acesso_proprio" on public.operator_obligations
  for all using (
    operator_id in (select id from operators where user_id = auth.uid())
  );
