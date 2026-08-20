const { supabaseAdmin } = require('../config/supabase');
const https = require('https');
function supabaseGet(table, filter) {
  return new Promise((resolve, reject) => {
    const params = Object.entries(filter).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/${table}?${params}&limit=1`);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const rows = JSON.parse(d);
          resolve(Array.isArray(rows) ? rows[0] || null : null);
        } catch(e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido', code: 'UNAUTHORIZED' });
  }

  const token = authHeader.split(' ')[1];
  /* jwt.decode() SO le o payload -- nunca confirma a assinatura da Supabase.
     supabaseAdmin.auth.getUser() valida o token de verdade contra a Supabase,
     mesmo padrao ja usado (correctamente) em travelerAuthController.js. */
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Token invalido ou expirado', code: 'INVALID_TOKEN' });
  }
  const supaUser = data.user;
  req.user = { id: supaUser.id, email: supaUser.email, user_metadata: supaUser.user_metadata || {}, role: supaUser.role };

  const operator = await supabaseGet('operators', { user_id: supaUser.id });
  req.operator = operator || null;
  req.staff = null;
  if (!req.operator && supaUser.user_metadata?.staff_id) {
    const staff = await supabaseGet('staff', { id: supaUser.user_metadata.staff_id, status: 'active' });
    req.staff = staff || null;
  }

  req.traveler = null;
  if (!req.operator && !req.staff) {
    const traveler = await supabaseGet('travelers', { user_id: supaUser.id });
    req.traveler = traveler || null;
  }

  next();
}

module.exports = authMiddleware;
