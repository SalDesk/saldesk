const https = require('https');
const jwt = require('jsonwebtoken');

function supabaseRest(path) {
  return new Promise((resolve) => {
    const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/${path}`);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch(e) { resolve(null); }
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
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.sub || decoded.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: 'Token inválido ou expirado', code: 'INVALID_TOKEN' });
    }
    user = { id: decoded.sub, email: decoded.email, user_metadata: decoded.user_metadata || {}, role: decoded.role };
  } catch(e) {
    return res.status(401).json({ error: 'Token inválido ou expirado', code: 'INVALID_TOKEN' });
  }
  req.user = user;

  const operators = await supabaseRest(`operators?user_id=eq.${user.id}&limit=1`);
  req.operator = Array.isArray(operators) ? operators[0] || null : null;
  req.staff = null;

  if (!req.operator && user.user_metadata?.staff_id) {
    const staffRows = await supabaseRest(`staff?id=eq.${user.user_metadata.staff_id}&status=eq.active&limit=1`);
    req.staff = Array.isArray(staffRows) ? staffRows[0] || null : null;
  }
  next();
}

module.exports = authMiddleware;
