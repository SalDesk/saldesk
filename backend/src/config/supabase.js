const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  realtime: { transport: ws }
});

const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { transport: ws }
});

const supabaseAdmin = supabase;
const supabaseAnon = supabasePublic;

module.exports = { supabase, supabasePublic, supabaseAdmin, supabaseAnon };