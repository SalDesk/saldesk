const { supabaseAdmin } = require('../config/supabase');
const { encrypt, decrypt } = require('../utils/encrypt');

/* ─── Stats gerais ────────────────────────────────────────── */
async function getStats(req, res, next) {
  try {
    const [opsRes, resRes, cusRes, leadsRes] = await Promise.all([
      supabaseAdmin.from('operators').select('id, plan, plan_status, created_at', { count: 'exact' }),
      supabaseAdmin.from('reservations').select('total_amount, status', { count: 'exact' }),
      supabaseAdmin.from('customers').select('id', { count: 'exact' }),
      supabaseAdmin.from('leads').select('id, is_contacted, converted_at', { count: 'exact' }),
    ]);

    const operators  = opsRes.data || [];
    const reservas   = resRes.data || [];
    const receitaTotal = reservas.filter(r => r.status === 'checked_out').reduce((s, r) => s + Number(r.total_amount), 0);

    const byPlan = { starter: 0, business: 0, pro: 0 };
    operators.forEach(o => { if (byPlan[o.plan] !== undefined) byPlan[o.plan]++; });

    const leads = leadsRes.data || [];
    return res.json({
      data: {
        operators: { total: operators.length, by_plan: byPlan, active: operators.filter(o => o.plan_status === 'active').length },
        reservations: { total: resRes.count, checked_out: reservas.filter(r => r.status === 'checked_out').length },
        revenue_total: Math.round(receitaTotal * 100) / 100,
        customers: cusRes.count || 0,
        leads: { total: leads.length, contacted: leads.filter(l => l.is_contacted).length, converted: leads.filter(l => l.converted_at).length },
      },
      message: 'Stats do admin',
    });
  } catch (err) { next(err); }
}

/* ─── Operadores ──────────────────────────────────────────── */
async function listOperators(req, res, next) {
  try {
    const { plan, plan_status, search } = req.query;
    let q = supabaseAdmin
      .from('operators')
      .select('id, name, operator_type, email, plan, plan_status, trial_ends_at, created_at')
      .order('created_at', { ascending: false });
    if (plan) q = q.eq('plan', plan);
    if (plan_status) q = q.eq('plan_status', plan_status);
    if (search) q = q.ilike('name', `%${search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ data, message: 'Operadores listados' });
  } catch (err) { next(err); }
}

async function updateOperatorStatus(req, res, next) {
  try {
    const { plan, plan_status, notes } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (plan) updates.plan = plan;
    if (plan_status) updates.plan_status = plan_status;
    const { data, error } = await supabaseAdmin
      .from('operators').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    return res.json({ data, message: 'Operador actualizado' });
  } catch (err) { next(err); }
}

/* ─── Leads ───────────────────────────────────────────────── */
async function listLeads(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('leads').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ data, message: 'Leads listados' });
  } catch (err) { next(err); }
}

async function updateLead(req, res, next) {
  try {
    const { is_contacted, converted_at, notes } = req.body;
    const updates = {};
    if (is_contacted !== undefined) { updates.is_contacted = is_contacted; if (is_contacted) updates.contacted_at = new Date().toISOString(); }
    if (converted_at !== undefined) updates.converted_at = converted_at;
    if (notes !== undefined) updates.notes = notes;
    const { data, error } = await supabaseAdmin.from('leads').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    return res.json({ data, message: 'Lead actualizado' });
  } catch (err) { next(err); }
}

/* ─── CMS helpers ─────────────────────────────────────────── */
function cmsRouter(table, orderCol = 'created_at') {
  return {
    async list(req, res, next) {
      try {
        const { data, error } = await supabaseAdmin.from(table).select('*').order(orderCol);
        if (error) throw error;
        return res.json({ data, message: `${table} listados` });
      } catch (err) { next(err); }
    },
    async create(req, res, next) {
      try {
        const { data, error } = await supabaseAdmin.from(table).insert(req.body).select().single();
        if (error) throw error;
        return res.status(201).json({ data, message: 'Criado' });
      } catch (err) { next(err); }
    },
    async update(req, res, next) {
      try {
        const updates = { ...req.body, updated_at: new Date().toISOString() };
        const { data, error } = await supabaseAdmin.from(table).update(updates).eq('id', req.params.id).select().single();
        if (error || !data) return res.status(404).json({ error: 'Nao encontrado', code: 'NOT_FOUND' });
        return res.json({ data, message: 'Actualizado' });
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

const featured    = cmsRouter('cms_featured', 'position');
const banners     = cmsRouter('cms_banners');
const experiences = cmsRouter('cms_experiences', 'sort_order');
const events      = cmsRouter('cms_events', 'month_start');
const articles    = cmsRouter('cms_articles', 'published_at');

/* ─── Revenue por plano ───────────────────────────────────── */
async function getRevenue(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('reservations')
      .select('total_amount, status, created_at, operators(plan)');
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

    return res.json({ data: monthly, message: 'Receita mensal' });
  } catch (err) { next(err); }
}

module.exports = {
  getStats, listOperators, updateOperatorStatus,
  listLeads, updateLead, getRevenue,
  featured, banners, experiences, events, articles,
};
