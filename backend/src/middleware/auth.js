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

  /* /telemetry/view fica de fora do bloqueio -- nao altera nenhum dado do
     operador demo em si, so alimenta as estatisticas de trafego/utilizacao
     do fundador (getAnalyticsTraffic/getDemoUsage). Sem esta excepcao, a
     propria navegacao da conta demo nunca ficava registada -- "Utilizacao
     do demo" no Analytics do fundador ficava sempre a 0, mesmo com
     utilizacao real, silenciosamente bloqueada por este 403. */
  const isTelemetryView = req.originalUrl.startsWith('/api/v1/telemetry');
  if (req.operator?.is_demo && !isTelemetryView && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    return res.status(403).json({
      error: 'Esta e uma conta de demonstracao — apenas leitura, sem alteracoes permitidas.',
      code: 'DEMO_READ_ONLY',
    });
  }

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
