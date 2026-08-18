import { createClient } from '@supabase/supabase-js';

/* Cliente Supabase dedicado ao handshake OAuth (Google/Apple) da conta de
   viajante. So serve para o redireccionamento inicial e para ler a sessao
   devolvida por essa via -- a app continua a usar exclusivamente o proprio
   token em travelerAuthStore como fonte de verdade (mesmo padrao do resto
   da app, que nunca confia na sessao interna do supabase-js). storageKey
   proprio para nunca colidir com nenhuma outra sessao Supabase guardada
   neste browser. */
const supabaseAuthClient = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  { auth: { storageKey: 'saldesk-traveler-oauth', detectSessionInUrl: true } }
);

export default supabaseAuthClient;
