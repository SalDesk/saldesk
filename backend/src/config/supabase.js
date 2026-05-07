const { createClient } = require('@supabase/supabase-js');

// Cliente admin (service key) para operações privilegiadas no servidor
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Cliente anon para autenticação de utilizadores (sign in/up)
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = { supabaseAdmin, supabaseAnon };
