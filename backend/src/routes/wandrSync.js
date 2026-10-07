const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { supabaseAdmin } = require('../config/supabase');
const { loadPriceMap } = require('../helpers/pricing');

const router = express.Router();

/* Leitura das subscricoes dos operadores para o painel financeiro da Wandr
   (wandrtech.cv). Autenticado por um token partilhado (WANDR_SYNC_TOKEN),
   nunca por sessao de utilizador: e uma ligacao servidor-a-servidor, so de
   leitura. Sem o token configurado a rota responde 503 -- fica desligada em
   vez de aberta. */
function hash(v) {
  return crypto.createHash('sha256').update(String(v || '')).digest();
}

function requireSyncToken(req, res, next) {
  const expected = process.env.WANDR_SYNC_TOKEN;
  if (!expected || expected.length < 32) {
    return res.status(503).json({ error: 'Sincronizacao nao configurada.' });
  }
  const header = req.headers.authorization || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!crypto.timingSafeEqual(hash(provided), hash(expected))) {
    return res.status(401).json({ error: 'Nao autorizado.' });
  }
  next();
}

const limiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.get('/subscriptions', limiter, requireSyncToken, async (req, res) => {
  try {
    const [{ data, error }, prices] = await Promise.all([
      supabaseAdmin
        .from('operators')
        .select('id, name, business_name, email, phone, plan, plan_status, trial_ends_at, plan_paid_until, paypal_subscription_id, created_at, is_demo')
        .not('is_demo', 'is', true)
        .order('created_at'),
      loadPriceMap(),
    ]);
    if (error) throw error;

    const operators = (data || []).map((o) => ({
      id: o.id,
      name: o.business_name || o.name,
      email: o.email,
      phone: o.phone,
      plan: o.plan,
      plan_status: o.plan_status,
      price_eur: prices[o.plan] ?? null,
      period: 'month',
      trial_ends_at: o.trial_ends_at,
      plan_paid_until: o.plan_paid_until,
      billing: o.paypal_subscription_id ? 'paypal' : 'manual',
      created_at: o.created_at,
    }));
    res.json({ data: { generated_at: new Date().toISOString(), operators } });
  } catch (err) {
    console.error('[WandrSync] Falha ao listar subscricoes:', err.message);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
