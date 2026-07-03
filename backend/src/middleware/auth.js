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
  let user;
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.sub || decoded.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: 'Token invalido ou expirado', code: 'INVALID_TOKEN' });
    }
    user = { id: decoded.sub, email: decoded.email, user_metadata: decoded.user_metadata || {}, role: decoded.role };
  } catch(e) {
    return res.status(401).json({ error: 'Token invalido ou expirado', code: 'INVALID_TOKEN' });
  }
  req.user = user;

  const operator = await supabaseGet('operators', { user_id: user.id });
  req.operator = operator || null;
  req.staff = null;
  if (!req.operator && user.user_metadata?.staff_id) {
    const staff = await supabaseGet('staff', { id: user.user_metadata.staff_id, status: 'active' });
    req.staff = staff || null;
  }

  next();
}

module.exports = authMiddleware;
