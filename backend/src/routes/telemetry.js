const express = require('express');
const router  = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const auth = require('../middleware/auth');

router.use(auth);

const VALID_SOURCES = ['direct', 'organic', 'social', 'referral'];

/* Regista uma pageview da SPA (app.saldesk.cv) -- alimenta a aba "Trafego" do
   Analytics do fundador (getAnalyticsTraffic em adminController.js). Disparado
   pelo frontend a cada mudanca de rota (ver utils/telemetry.js). Nunca deve
   atrasar nem bloquear a navegacao -- falha sempre em silencio com 204. */
router.post('/view', async (req, res) => {
  const operatorId = req.operator?.id || req.staff?.operator_id;
  if (!operatorId) return res.status(204).end();

  const { path, session_id, source } = req.body || {};
  if (!path || !session_id) return res.status(204).end();

  supabaseAdmin.from('app_page_views').insert({
    operator_id: operatorId,
    session_id:  String(session_id).slice(0, 100),
    path:        String(path).slice(0, 200),
    source:      VALID_SOURCES.includes(source) ? source : 'direct',
  }).then(() => {}).catch(() => {});

  return res.status(204).end();
});

module.exports = router;
