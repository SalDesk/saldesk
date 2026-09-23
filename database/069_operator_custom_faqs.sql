-- Coluna ja lida/escrita pelo codigo (Settings.jsx, publicController.js) desde
-- ha semanas, mas nunca criada -- cada gravacao de definicoes da pagina publica
-- falhava com "Could not find the 'custom_faqs' column" (visto nos logs em
-- 2026-09-07 e 2026-09-16). Array de perguntas/respostas personalizadas
-- mostradas na pagina publica do operador.
alter table operators add column if not exists custom_faqs jsonb default '[]'::jsonb;
