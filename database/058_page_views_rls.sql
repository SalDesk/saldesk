-- page_views estava sem RLS -- exposta de forma completa a anon/authenticated
-- via Supabase client libraries. So e tocada por supabaseAdmin (service role,
-- ignora RLS sempre) em publicController.js (trackView) e marketing.js
-- (estatisticas de referencia) -- activar RLS sem politicas fecha o acesso
-- directo sem afectar nenhum destes dois pontos.
alter table public.page_views enable row level security;
