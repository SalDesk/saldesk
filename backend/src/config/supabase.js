const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { realtime: { transport: ws } });
const supabasePublic = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { realtime: { transport: ws } });
const supabaseAdmin = supabase;
const supabaseAnon = supabasePublic;
module.exports = { supabase, supabasePublic, supabaseAdmin, supabaseAnon };
