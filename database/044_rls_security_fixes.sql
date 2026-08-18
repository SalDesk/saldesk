-- SalDesk - correcao de seguranca: RLS em falta em 3 tabelas expostas via
-- PostgREST (encontrado pelo advisor de seguranca do Supabase, nivel ERROR).
--
-- islands / experience_categories: dados de catalogo publico (usados pelo
-- Conect) -- leitura publica correcta, escrita fica reservada ao backend
-- (service role, que ignora RLS), tal como o resto da app ja faz.
--
-- platform_paypal_plans: configuracao interna de facturacao da propria
-- plataforma (mapeamento plano -> IDs PayPal) -- nunca deve ser lido
-- directamente por um cliente, so pelo backend. Sem nenhuma politica para
-- anon/authenticated, fica bloqueado por omissao (o mesmo padrao "RLS
-- ligado, sem politica" ja usado noutras tabelas internas desta base).

alter table islands enable row level security;
drop policy if exists islands_leitura_publica on islands;
create policy islands_leitura_publica on islands for select using (true);

alter table experience_categories enable row level security;
drop policy if exists experience_categories_leitura_publica on experience_categories;
create policy experience_categories_leitura_publica on experience_categories for select using (true);

alter table platform_paypal_plans enable row level security;

-- Correcao de seguranca menor (nivel WARN do advisor): search_path mutavel
-- na funcao de trigger partilhada por quase todas as tabelas.
alter function public.update_updated_at() set search_path = public;
