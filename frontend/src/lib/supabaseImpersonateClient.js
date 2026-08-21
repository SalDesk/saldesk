import { createClient } from '@supabase/supabase-js';

/* Cliente Supabase dedicado ao link "Aceder como operador" (impersonateOperator
   em adminController.js). Mesmo padrao de lib/supabaseAuthClient.js (OAuth de
   viajante) -- so serve para ler a sessao devolvida pelo link magico na URL;
   a app continua a usar o proprio authStore como fonte de verdade. storageKey
   proprio para nunca colidir com a sessao normal do fundador nem com a do
   OAuth de viajante, guardadas no mesmo browser. */
const supabaseImpersonateClient = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  { auth: { storageKey: 'saldesk-impersonate', detectSessionInUrl: true } }
);

export default supabaseImpersonateClient;
