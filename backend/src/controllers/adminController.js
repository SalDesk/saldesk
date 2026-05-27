const { supabaseAdmin } = require('../config/supabase');

const PLAN_PRICES  = { starter: 29, business: 59, pro: 99 };
const TYPE_SCORE   = { activity: 30, rentacar: 25, hotel: 20, restaurant: 15 };
const SOURCE_SCORE = { partner: 25, referral: 20, website: 15, landing: 15 };
const MONTH_NAMES  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

/* ─── Stats gerais ─────────────────────────────────────────── */
async function getStats(req, res, next) {
  try {
    const now      = new Date();
    const in7Days  = new Date(now.getTime() + 7  * 86400000).toISOString();
    const past48h  = new Date(now.getTime() - 48 * 3600000).toISOString();

    const [opsRes, resRes, cusRes, leadsRes, trialsRes, newLeadsRes] = await Promise.all([
      supabaseAdmin.from('operators').select('id, name, plan, plan_status, operator_type, created_at'),
      supabaseAdmin.from('reservations').select('total_amount, status', { count: 'exact' }),
      supabaseAdmin.from('customers').select('id', { count: 'exact' }),
      supabaseAdmin.from('leads').select('id, is_contacted, converted_at, created_at'),
      supabaseAdmin.from('operators')
        .select('id, name, email, trial_ends_at, plan')
        .eq('plan_status', 'trial')
        .lte('trial_ends_at', in7Days)
        .gte('trial_ends_at', now.toISOString()),
      supabaseAdmin.from('leads')
        .select('id, email, operator_type, created_at')
        .gte('created_at', past48h)
        .eq('is_contacted', false),
    ]);

    const operators = opsRes.data  || [];
    const reservas  = resRes.data  || [];
    const leads     = leadsRes.data || [];

    const mrr = operators
      .filter(o => o.plan_status === 'active')
      .reduce((s, o) => s + (PLAN_PRICES[o.plan] || 0), 0);

    const byPlan = { starter: 0, business: 0, pro: 0 };
    operators.forEach(o => { if (byPlan[o.plan] !== undefined) byPlan[o.plan]++; });

    const byTypeMap = {};
    operators.forEach(o => { byTypeMap[o.operator_type] = (byTypeMap[o.operator_type] || 0) + 1; });

    const receitaTotal = reservas
      .filter(r => r.status === 'checked_out')
      .reduce((s, r) => s + Number(r.total_amount || 0), 0);

    // Growth — last 6 months
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }
    const growthMap = Object.fromEntries(months.map(m => [m, 0]));
    operators.forEach(o => {
      const m = o.created_at.slice(0, 7);
      if (growthMap[m] !== undefined) growthMap[m]++;
    });
    const operator_growth = months.map(m => ({
      label: MONTH_NAMES[parseInt(m.slice(5)) - 1],
      count: growthMap[m],
    }));

    const recent_operators = [...operators]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    return res.json({
      data: {
        operators: {
          total:  operators.length,
          active: operators.filter(o => o.plan_status === 'active').length,
          trial:  operators.filter(o => o.plan_status === 'trial').length,
          by_plan: byPlan,
          by_type: Object.entries(byTypeMap).map(([name, value]) => ({ name, value })),
        },
        reservations: {
          total:       resRes.count  || 0,
          checked_out: reservas.filter(r => r.status === 'checked_out').length,
        },
        revenue_total: Math.round(receitaTotal * 100) / 100,
        mrr,
        customers: cusRes.count || 0,
        leads: {
          total:          leads.length,
          contacted:      leads.filter(l => l.is_contacted).length,
          converted:      leads.filter(l => l.converted_at).length,
          new_uncontacted: leads.filter(l => !l.is_contacted).length,
        },
        trials_expiring: trialsRes.data  || [],
        new_leads_48h:   newLeadsRes.data || [],
        operator_growth,
        recent_operators,
      },
    });
  } catch (err) { next(err); }
}

/* ─── Operadores ─────────────────────────────────────────────── */
async function listOperators(req, res, next) {
  try {
    const { plan, plan_status, operator_type, search } = req.query;
    let q = supabaseAdmin
      .from('operators')
      .select('id, name, operator_type, email, phone, logo_url, plan, plan_status, trial_ends_at, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (plan)          q = q.eq('plan', plan);
    if (plan_status)   q = q.eq('plan_status', plan_status);
    if (operator_type) q = q.eq('operator_type', operator_type);
    if (search)        q = q.ilike('name', `%${search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ data, message: 'Operadores listados' });
  } catch (err) { next(err); }
}

async function getOperatorDetail(req, res, next) {
  try {
    const id = req.params.id;
    const [opRes, resRes, cusRes] = await Promise.all([
      supabaseAdmin.from('operators').select('*').eq('id', id).single(),
      supabaseAdmin.from('reservations').select('id, status, total_amount, created_at', { count: 'exact' }).eq('operator_id', id),
      supabaseAdmin.from('customers').select('id', { count: 'exact' }).eq('operator_id', id),
    ]);
    if (opRes.error) throw opRes.error;
    const reservas = resRes.data || [];
    const receita  = reservas.filter(r => r.status === 'checked_out').reduce((s, r) => s + Number(r.total_amount || 0), 0);
    return res.json({
      data: {
        operator:   opRes.data,
        stats: {
          reservations_total: resRes.count || 0,
          revenue_total:      Math.round(receita),
          customers_total:    cusRes.count || 0,
        },
      },
    });
  } catch (err) { next(err); }
}

async function updateOperator(req, res, next) {
  try {
    const allowed = ['plan', 'plan_status', 'trial_ends_at'];
    const updates = { updated_at: new Date().toISOString() };
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const { data, error } = await supabaseAdmin
      .from('operators').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    return res.json({ data, message: 'Operador actualizado' });
  } catch (err) { next(err); }
}

/* kept for backward-compat */
async function updateOperatorStatus(req, res, next) {
  return updateOperator(req, res, next);
}

/* ─── Leads ─────────────────────────────────────────────────── */
function computeLeadScore(lead) {
  let score = 0;
  score += TYPE_SCORE[lead.operator_type]  || 10;
  score += SOURCE_SCORE[lead.source]       || 5;
  if (lead.phone) score += 10;
  if (lead.name)  score += 10;
  const days = (Date.now() - new Date(lead.created_at)) / 86400000;
  if (days < 7)       score += 20;
  else if (days < 30) score += 10;
  else if (days > 90) score -= 10;
  return Math.min(100, Math.max(0, score));
}

function computeLeadStatus(lead) {
  if (lead.converted_at)  return 'convertido';
  if (lead.is_contacted)  return 'contactado';
  return 'novo';
}

async function listLeads(req, res, next) {
  try {
    const { status, operator_type, source } = req.query;
    let q = supabaseAdmin.from('leads').select('*').order('created_at', { ascending: false });
    if (operator_type) q = q.eq('operator_type', operator_type);
    if (source)        q = q.eq('source', source);
    const { data, error } = await q;
    if (error) throw error;

    let scored = (data || []).map(lead => ({
      ...lead,
      score:           computeLeadScore(lead),
      computed_status: computeLeadStatus(lead),
    }));

    if (status) scored = scored.filter(l => l.computed_status === status);

    return res.json({ data: scored });
  } catch (err) { next(err); }
}

async function updateLead(req, res, next) {
  try {
    const { status, notes, is_contacted, converted_at } = req.body;
    const updates = {};

    if (status === 'contactado') {
      updates.is_contacted = true;
      updates.contacted_at = new Date().toISOString();
    } else if (status === 'convertido') {
      updates.is_contacted = true;
      updates.contacted_at = updates.contacted_at || new Date().toISOString();
      updates.converted_at = new Date().toISOString();
    } else if (status === 'novo') {
      updates.is_contacted = false;
      updates.contacted_at = null;
    }

    if (notes       !== undefined) updates.notes       = notes;
    if (is_contacted !== undefined && status === undefined) {
      updates.is_contacted = is_contacted;
      if (is_contacted) updates.contacted_at = new Date().toISOString();
    }
    if (converted_at !== undefined && status === undefined) updates.converted_at = converted_at;

    const { data, error } = await supabaseAdmin
      .from('leads').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    return res.json({ data: { ...data, score: computeLeadScore(data), computed_status: computeLeadStatus(data) } });
  } catch (err) { next(err); }
}

/* ─── Impact — métricas públicas ────────────────────────────── */
async function getImpact(req, res, next) {
  try {
    const [opsRes, resRes, cusRes] = await Promise.all([
      supabaseAdmin.from('operators').select('id, operator_type, created_at').eq('plan_status', 'active'),
      supabaseAdmin.from('reservations').select('total_amount, status, created_at', { count: 'exact' }),
      supabaseAdmin.from('customers').select('id', { count: 'exact' }),
    ]);

    const ops     = opsRes.data   || [];
    const reservas = resRes.data  || [];
    const receita  = reservas.filter(r => r.status === 'checked_out').reduce((s, r) => s + Number(r.total_amount || 0), 0);

    const byTypeMap = {};
    ops.forEach(o => { byTypeMap[o.operator_type] = (byTypeMap[o.operator_type] || 0) + 1; });

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }
    const growthMap = Object.fromEntries(months.map(m => [m, 0]));
    ops.forEach(o => {
      const m = o.created_at.slice(0, 7);
      if (growthMap[m] !== undefined) growthMap[m]++;
    });
    const growth = months.map(m => ({
      label: MONTH_NAMES[parseInt(m.slice(5)) - 1],
      count: growthMap[m],
    }));

    return res.json({
      data: {
        operators_total:   ops.length,
        reservations_total: resRes.count || 0,
        customers_total:   cusRes.count  || 0,
        revenue_total:     Math.round(receita),
        operators_by_type: Object.entries(byTypeMap).map(([name, value]) => ({ name, value })),
        growth,
      },
    });
  } catch (err) { next(err); }
}

/* ─── Logs de actividade ────────────────────────────────────── */
async function getLogs(req, res, next) {
  try {
    const lim = Math.min(parseInt(req.query.limit || 20), 50);
    const [resRes, opsRes] = await Promise.all([
      supabaseAdmin.from('reservations')
        .select('id, status, created_at, operators(name)')
        .order('created_at', { ascending: false })
        .limit(lim),
      supabaseAdmin.from('operators')
        .select('id, name, operator_type, plan, plan_status, created_at')
        .order('created_at', { ascending: false })
        .limit(lim),
    ]);

    const events = [
      ...(resRes.data || []).map(r => ({
        type:  'reservation',
        title: `Nova reserva — ${r.operators?.name || 'Desconhecido'}`,
        sub:   r.status,
        time:  r.created_at,
      })),
      ...(opsRes.data || []).map(o => ({
        type:  'operator',
        title: `Operador registado: ${o.name}`,
        sub:   `${o.operator_type} · ${o.plan} · ${o.plan_status}`,
        time:  o.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, lim);

    return res.json({ data: events });
  } catch (err) { next(err); }
}

/* ─── System health ─────────────────────────────────────────── */
async function getSystemHealth(req, res, next) {
  try {
    const { error: dbErr } = await supabaseAdmin.from('operators').select('id').limit(1);
    const mem = process.memoryUsage();
    return res.json({
      data: {
        api:      'ok',
        database: dbErr ? 'error' : 'ok',
        uptime_seconds: Math.round(process.uptime()),
        memory: {
          used_mb:  Math.round(mem.heapUsed  / 1048576),
          total_mb: Math.round(mem.heapTotal / 1048576),
          rss_mb:   Math.round(mem.rss       / 1048576),
        },
        node_version: process.version,
        environment:  process.env.NODE_ENV || 'development',
        timestamp:    new Date().toISOString(),
      },
    });
  } catch (err) { next(err); }
}

/* ─── Revenue ───────────────────────────────────────────────── */
async function getRevenue(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('reservations')
      .select('total_amount, status, created_at');
    if (error) throw error;

    const byMonth = {};
    (data || []).filter(r => r.status === 'checked_out').forEach(r => {
      const m = r.created_at.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = 0;
      byMonth[m] += Number(r.total_amount);
    });

    const monthly = Object.entries(byMonth)
      .map(([month, revenue]) => ({ month, revenue: Math.round(revenue * 100) / 100 }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    return res.json({ data: monthly });
  } catch (err) { next(err); }
}

/* ─── CMS helpers ───────────────────────────────────────────── */
function cmsRouter(table, orderCol = 'created_at') {
  return {
    async list(req, res, next) {
      try {
        const { data, error } = await supabaseAdmin.from(table).select('*').order(orderCol);
        if (error) throw error;
        return res.json({ data });
      } catch (err) { next(err); }
    },
    async create(req, res, next) {
      try {
        const { data, error } = await supabaseAdmin.from(table).insert(req.body).select().single();
        if (error) throw error;
        return res.status(201).json({ data });
      } catch (err) { next(err); }
    },
    async update(req, res, next) {
      try {
        const updates = { ...req.body, updated_at: new Date().toISOString() };
        const { data, error } = await supabaseAdmin.from(table).update(updates).eq('id', req.params.id).select().single();
        if (error || !data) return res.status(404).json({ error: 'Nao encontrado' });
        return res.json({ data });
      } catch (err) { next(err); }
    },
    async remove(req, res, next) {
      try {
        const { error } = await supabaseAdmin.from(table).delete().eq('id', req.params.id);
        if (error) throw error;
        return res.json({ data: null, message: 'Eliminado' });
      } catch (err) { next(err); }
    },
  };
}

const featured    = cmsRouter('cms_featured',    'position');
const banners     = cmsRouter('cms_banners');
const experiences = cmsRouter('cms_experiences', 'sort_order');
const events      = cmsRouter('cms_events',      'event_date');
const articles    = cmsRouter('cms_articles',    'published_at');

module.exports = {
  getStats, listOperators, getOperatorDetail, updateOperator, updateOperatorStatus,
  listLeads, updateLead,
  getImpact, getLogs, getSystemHealth,
  getRevenue,
  featured, banners, experiences, events, articles,
};
