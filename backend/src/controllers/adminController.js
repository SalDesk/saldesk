const { supabaseAdmin } = require('../config/supabase');
const { enviarEmail }   = require('../helpers/emailHelper');

const PLAN_PRICES   = { starter: 29, business: 59, pro: 99 };
const TIPO_SCORE    = { hotel: 30, activity: 25, rentacar: 20, restaurant: 15 };
const LEAD_STATUSES = ['novo', 'contactado', 'demo_agendada', 'proposta_enviada', 'convertido', 'descartado'];
const MONTH_NAMES   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function lastMonths(n) {
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

/* ─── Stats gerais ─────────────────────────────────────────── */
async function getStats(req, res, next) {
  try {
    const now           = new Date();
    const startOfToday  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const in7Days       = new Date(now.getTime() + 7  * 86400000).toISOString();
    const past24h       = new Date(now.getTime() - 24 * 3600000).toISOString();
    const past48h       = new Date(now.getTime() - 48 * 3600000).toISOString();
    const past30dIso    = new Date(now.getTime() - 30 * 86400000).toISOString();

    const [opsRes, resRes, leads24hRes, trialsRes, newLeadsRes, allLeadsRes] = await Promise.all([
      supabaseAdmin.from('operators')
        .select('id, name, email, plan, plan_status, operator_type, trial_ends_at, created_at'),
      supabaseAdmin.from('reservations')
        .select('id, operator_id, total_price, status, created_at'),
      supabaseAdmin.from('operator_leads')
        .select('id, nome, email, tipo_negocio, created_at')
        .gte('created_at', past24h),
      supabaseAdmin.from('operators')
        .select('id, name, email, trial_ends_at, plan')
        .eq('plan_status', 'trial')
        .lte('trial_ends_at', in7Days)
        .gte('trial_ends_at', now.toISOString()),
      supabaseAdmin.from('operator_leads')
        .select('id, nome, email, tipo_negocio, created_at')
        .gte('created_at', past48h)
        .eq('status', 'novo'),
      supabaseAdmin.from('operator_leads').select('id, status, created_at'),
    ]);

    const operators = opsRes.data || [];
    const reservas  = resRes.data || [];
    const allLeads  = allLeadsRes.data || [];

    const mrr = operators
      .filter(o => o.plan_status === 'active')
      .reduce((s, o) => s + (PLAN_PRICES[o.plan] || 0), 0);

    const byPlan = { starter: 0, business: 0, pro: 0 };
    operators.forEach(o => { if (byPlan[o.plan] !== undefined) byPlan[o.plan]++; });

    const byTypeMap = {};
    operators.forEach(o => { byTypeMap[o.operator_type] = (byTypeMap[o.operator_type] || 0) + 1; });

    const resToday     = reservas.filter(r => r.created_at >= startOfToday).length;
    const resThisMonth = reservas.filter(r => r.created_at >= startOfMonth).length;

    const convertedCount = allLeads.filter(l => l.status === 'convertido').length;
    const conversionRate = allLeads.length > 0 ? Math.round((convertedCount / allLeads.length) * 1000) / 10 : 0;

    /* Crescimento de operadores — últimos 6 meses */
    const months    = lastMonths(6);
    const growthMap = Object.fromEntries(months.map(m => [m, 0]));
    operators.forEach(o => {
      const m = o.created_at.slice(0, 7);
      if (growthMap[m] !== undefined) growthMap[m]++;
    });
    const operator_growth = months.map(m => ({
      label: MONTH_NAMES[parseInt(m.slice(5)) - 1],
      count: growthMap[m],
    }));

    /* MRR estimado — últimos 6 meses (operadores activos criados ate cada mes) */
    const mrr_by_month = months.map(m => {
      const activeByThen = operators.filter(o => o.plan_status === 'active' && o.created_at.slice(0, 7) <= m);
      const total = activeByThen.reduce((s, o) => s + (PLAN_PRICES[o.plan] || 0), 0);
      return { label: MONTH_NAMES[parseInt(m.slice(5)) - 1], mrr: total };
    });

    /* Reservas diárias — últimos 30 dias */
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const dailyMap = Object.fromEntries(days.map(d => [d, 0]));
    reservas.forEach(r => {
      const d = r.created_at.slice(0, 10);
      if (dailyMap[d] !== undefined) dailyMap[d]++;
    });
    const daily_reservations = days.map(d => ({ label: d.slice(5), count: dailyMap[d] }));

    /* Operadores inactivos — sem reservas nos últimos 30 dias */
    const lastResByOperator = {};
    reservas.forEach(r => {
      if (!lastResByOperator[r.operator_id] || r.created_at > lastResByOperator[r.operator_id]) {
        lastResByOperator[r.operator_id] = r.created_at;
      }
    });
    const inactive_operators = operators
      .filter(o => o.plan_status === 'active' || o.plan_status === 'trial')
      .filter(o => {
        const last = lastResByOperator[o.id];
        if (!last) return o.created_at < past30dIso;
        return last < past30dIso;
      })
      .slice(0, 10);

    const recent_operators = [...operators]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    return res.json({
      data: {
        operators: {
          total:     operators.length,
          active:    operators.filter(o => o.plan_status === 'active').length,
          trial:     operators.filter(o => o.plan_status === 'trial').length,
          suspended: operators.filter(o => o.plan_status === 'suspended').length,
          by_plan: byPlan,
          by_type: Object.entries(byTypeMap).map(([name, value]) => ({ name, value })),
        },
        reservations: {
          total:      reservas.length,
          today:      resToday,
          this_month: resThisMonth,
        },
        mrr,
        mrr_by_month,
        leads: {
          new_24h:         leads24hRes.data?.length || 0,
          total:           allLeads.length,
          converted:       convertedCount,
          conversion_rate: conversionRate,
        },
        trials_expiring:   trialsRes.data    || [],
        new_leads_48h:     newLeadsRes.data  || [],
        inactive_operators,
        operator_growth,
        daily_reservations,
        recent_operators,
      },
    });
  } catch (err) { next(err); }
}

/* ─── Actividade recente da plataforma ──────────────────────── */
async function getActivity(req, res, next) {
  try {
    const lim = Math.min(parseInt(req.query.limit || 10), 30);
    const [resRes, opsRes, leadsRes] = await Promise.all([
      supabaseAdmin.from('reservations')
        .select('id, status, total_price, created_at, operators(name)')
        .order('created_at', { ascending: false })
        .limit(lim),
      supabaseAdmin.from('operators')
        .select('id, name, operator_type, plan, created_at')
        .order('created_at', { ascending: false })
        .limit(lim),
      supabaseAdmin.from('operator_leads')
        .select('id, nome, email, tipo_negocio, created_at')
        .order('created_at', { ascending: false })
        .limit(lim),
    ]);

    const events = [
      ...(resRes.data || []).map(r => ({
        type:  'reservation',
        title: `Nova reserva — ${r.operators?.name || 'Operador'}`,
        sub:   `${r.status} · €${Number(r.total_price || 0)}`,
        time:  r.created_at,
      })),
      ...(opsRes.data || []).map(o => ({
        type:  'operator',
        title: `Novo operador: ${o.name}`,
        sub:   `${o.operator_type} · ${o.plan}`,
        time:  o.created_at,
      })),
      ...(leadsRes.data || []).map(l => ({
        type:  'lead',
        title: `Novo lead: ${l.nome || l.email}`,
        sub:   l.tipo_negocio || '—',
        time:  l.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, lim);

    return res.json({ data: events });
  } catch (err) { next(err); }
}

/* ─── Operadores ─────────────────────────────────────────────── */
const OPERATOR_SORT_DB = ['name', 'plan', 'plan_status', 'trial_ends_at', 'created_at', 'operator_type'];

async function listOperators(req, res, next) {
  try {
    const { plan, plan_status, operator_type, search, sort_by, sort_dir } = req.query;
    const sortBy  = sort_by || 'created_at';
    const sortDir = sort_dir === 'asc' ? 'asc' : 'desc';

    let q = supabaseAdmin
      .from('operators')
      .select('id, name, operator_type, email, phone, logo_url, plan, plan_status, trial_ends_at, created_at, updated_at, user_id, notes_internal');
    if (plan)          q = q.eq('plan', plan);
    if (plan_status)   q = q.eq('plan_status', plan_status);
    if (operator_type) q = q.eq('operator_type', operator_type);
    if (search)        q = q.ilike('name', `%${search}%`);

    if (OPERATOR_SORT_DB.includes(sortBy)) q = q.order(sortBy, { ascending: sortDir === 'asc' });
    else                                   q = q.order('created_at', { ascending: false });

    const { data, error } = await q;
    if (error) throw error;
    const operators = data || [];

    /* Contagem de reservas por operador */
    const ids = operators.map(o => o.id);
    const resCountMap = {};
    if (ids.length) {
      const { data: resData } = await supabaseAdmin.from('reservations').select('operator_id').in('operator_id', ids);
      (resData || []).forEach(r => { resCountMap[r.operator_id] = (resCountMap[r.operator_id] || 0) + 1; });
    }

    /* Último login por operador (via user_id) */
    const userIds = operators.map(o => o.user_id).filter(Boolean);
    const lastLoginMap = {};
    if (userIds.length) {
      const { data: loginData } = await supabaseAdmin
        .from('login_history').select('user_id, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });
      (loginData || []).forEach(l => { if (!lastLoginMap[l.user_id]) lastLoginMap[l.user_id] = l.created_at; });
    }

    let result = operators.map(o => ({
      ...o,
      reservation_count: resCountMap[o.id] || 0,
      last_login:        o.user_id ? (lastLoginMap[o.user_id] || null) : null,
    }));

    if (sortBy === 'reservation_count' || sortBy === 'last_login') {
      result = [...result].sort((a, b) => {
        const av = a[sortBy] ?? (sortBy === 'last_login' ? '' : -1);
        const bv = b[sortBy] ?? (sortBy === 'last_login' ? '' : -1);
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return res.json({ data: result, message: 'Operadores listados' });
  } catch (err) { next(err); }
}

async function getOperatorDetail(req, res, next) {
  try {
    const id = req.params.id;
    const [opRes, resRes, cusRes] = await Promise.all([
      supabaseAdmin.from('operators').select('*').eq('id', id).single(),
      supabaseAdmin.from('reservations')
        .select('id, status, total_price, created_at', { count: 'exact' })
        .eq('operator_id', id)
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('customers').select('id', { count: 'exact' }).eq('operator_id', id),
    ]);
    if (opRes.error) throw opRes.error;
    const reservas = resRes.data || [];
    const receita  = reservas.filter(r => r.status === 'checked_out').reduce((s, r) => s + Number(r.total_price || 0), 0);
    return res.json({
      data: {
        operator: opRes.data,
        stats: {
          reservations_total: resRes.count || 0,
          revenue_total:      Math.round(receita),
          customers_total:    cusRes.count || 0,
        },
        recent_activity: reservas.slice(0, 8).map(r => ({
          type: 'reservation', status: r.status, amount: r.total_price, time: r.created_at,
        })),
      },
    });
  } catch (err) { next(err); }
}

async function updateOperator(req, res, next) {
  try {
    const allowed = ['plan', 'plan_status', 'trial_ends_at', 'notes_internal'];
    const updates = { updated_at: new Date().toISOString() };
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    if (req.body.extend_trial_days) {
      const days = parseInt(req.body.extend_trial_days);
      const { data: current } = await supabaseAdmin.from('operators').select('trial_ends_at').eq('id', req.params.id).single();
      const base = (current?.trial_ends_at && new Date(current.trial_ends_at) > new Date())
        ? new Date(current.trial_ends_at)
        : new Date();
      base.setDate(base.getDate() + days);
      updates.trial_ends_at = base.toISOString();
      updates.plan_status   = 'trial';
    }

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

/* ─── Leads (operator_leads — candidaturas de operadores) ────── */
function computeLeadScore(lead) {
  const breakdown = {};
  breakdown.tipo_negocio = TIPO_SCORE[lead.tipo_negocio] ?? 10;

  const vol = (lead.volume_mensal || lead.clientes_mes || '').toString().toLowerCase();
  if (/\+|\b[5-9]\d|\d{3}/.test(vol))      breakdown.volume = 20;
  else if (/\b[2-4]\d/.test(vol))          breakdown.volume = 14;
  else if (/\b1\d/.test(vol))              breakdown.volume = 8;
  else                                     breakdown.volume = 4;

  const anos = (lead.anos_operacao || '').toString().toLowerCase();
  if (/\+|\b[5-9]|\d{2,}/.test(anos))      breakdown.anos_operacao = 15;
  else if (/\b[2-4]/.test(anos))           breakdown.anos_operacao = 10;
  else                                     breakdown.anos_operacao = 5;

  breakdown.tem_site = lead.tem_site ? 5 : 0;
  breakdown.usa_otas = (Array.isArray(lead.otas) && lead.otas.length > 0) ? 10 : 0;

  const days = (Date.now() - new Date(lead.created_at)) / 86400000;
  breakdown.recencia = days < 7 ? 10 : days < 30 ? 6 : days < 90 ? 2 : 0;

  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  return { score: Math.min(100, total), breakdown };
}

function computeLeadStatus(lead) {
  return LEAD_STATUSES.includes(lead.status) ? lead.status : 'novo';
}

async function listLeads(req, res, next) {
  try {
    const { status, tipo_negocio, search } = req.query;
    let q = supabaseAdmin.from('operator_leads').select('*').order('created_at', { ascending: false });
    if (tipo_negocio) q = q.eq('tipo_negocio', tipo_negocio);
    if (status)       q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;

    let scored = (data || []).map(lead => {
      const { score, breakdown } = computeLeadScore(lead);
      return { ...lead, score, score_breakdown: breakdown, computed_status: computeLeadStatus(lead) };
    });

    if (search) {
      const s = search.toLowerCase();
      scored = scored.filter(l =>
        (l.email || '').toLowerCase().includes(s) ||
        (l.nome  || '').toLowerCase().includes(s) ||
        (l.nome_negocio || '').toLowerCase().includes(s)
      );
    }

    return res.json({ data: scored });
  } catch (err) { next(err); }
}

async function updateLead(req, res, next) {
  try {
    const { status, notes } = req.body;
    const updates = {};

    if (status !== undefined && LEAD_STATUSES.includes(status)) {
      updates.status = status;
      if (status === 'contactado')      updates.contacted_at = new Date().toISOString();
      else if (status === 'convertido') updates.converted_at = new Date().toISOString();
    }
    if (notes !== undefined) updates.notes_internal = notes;

    const { data, error } = await supabaseAdmin
      .from('operator_leads').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;

    const { score, breakdown } = computeLeadScore(data);
    return res.json({ data: { ...data, score, score_breakdown: breakdown, computed_status: computeLeadStatus(data) } });
  } catch (err) { next(err); }
}

async function sendLeadEmail(req, res, next) {
  try {
    const id = req.params.id;
    const { subject, body } = req.body;
    if (!subject?.trim() || !body?.trim()) return res.status(400).json({ error: 'Assunto e mensagem obrigatorios' });

    const { data: lead, error } = await supabaseAdmin.from('operator_leads').select('id, email, nome, status, contacted_at').eq('id', id).single();
    if (error) throw error;
    if (!lead) return res.status(404).json({ error: 'Lead nao encontrado' });

    await enviarEmail({ to: lead.email, subject: subject.trim(), text: body.trim() });

    const updates = {};
    if (lead.status === 'novo') { updates.status = 'contactado'; updates.contacted_at = new Date().toISOString(); }
    let updated = lead;
    if (Object.keys(updates).length) {
      const { data: u } = await supabaseAdmin.from('operator_leads').update(updates).eq('id', id).select().single();
      updated = u || lead;
    }

    const { score, breakdown } = computeLeadScore(updated);
    return res.json({ data: { ...updated, score, score_breakdown: breakdown, computed_status: computeLeadStatus(updated) }, message: 'Email enviado ao lead' });
  } catch (err) { next(err); }
}

async function convertLead(req, res, next) {
  try {
    const id = req.params.id;
    const { data: lead, error: leadErr } = await supabaseAdmin.from('operator_leads').select('*').eq('id', id).single();
    if (leadErr) throw leadErr;
    if (!lead) return res.status(404).json({ error: 'Lead nao encontrado' });
    if (lead.converted_operator_id) return res.status(400).json({ error: 'Lead ja foi convertido' });

    const TYPE_MAP = { hotel: 'hotel', alojamento: 'hotel', activity: 'activity', actividade: 'activity', rentacar: 'rentacar', 'rent-a-car': 'rentacar', restaurant: 'restaurant', restaurante: 'restaurant' };
    const operatorType = TYPE_MAP[(lead.tipo_negocio || '').toLowerCase()] || 'activity';

    const slugBase = (lead.nome_negocio || lead.nome || lead.email.split('@')[0])
      .toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '') || 'operador';

    let slug = slugBase;
    let n    = 1;
    /* eslint-disable no-await-in-loop */
    while (true) {
      const { data: exists } = await supabaseAdmin.from('operators').select('id').eq('slug', slug).maybeSingle();
      if (!exists) break;
      n += 1;
      slug = `${slugBase}-${n}`;
    }
    /* eslint-enable no-await-in-loop */

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    const { data: operator, error: opErr } = await supabaseAdmin.from('operators').insert({
      name:                lead.nome_negocio || lead.nome,
      operator_type:       operatorType,
      slug,
      email:               lead.email,
      phone:               lead.telefone || null,
      whatsapp:            lead.whatsapp || null,
      plan:                'starter',
      plan_status:         'trial',
      trial_ends_at:       trialEnd.toISOString(),
      onboarding_complete: false,
      notes_internal:      `Convertido do lead #${lead.id} em ${new Date().toISOString().slice(0, 10)}`,
    }).select().single();
    if (opErr) throw opErr;

    const { data: updatedLead, error: updErr } = await supabaseAdmin
      .from('operator_leads')
      .update({ status: 'convertido', converted_at: new Date().toISOString(), converted_operator_id: operator.id })
      .eq('id', id).select().single();
    if (updErr) throw updErr;

    return res.json({ data: { lead: updatedLead, operator }, message: 'Lead convertido em operador' });
  } catch (err) { next(err); }
}

/* ─── Waitlist (tabela leads — inscricoes coming-soon) ──────── */
async function getWaitlist(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ data: data || [] });
  } catch (err) { next(err); }
}

async function sendWaitlistEmail(req, res, next) {
  try {
    const { data: waitlist, error } = await supabaseAdmin.from('leads').select('email');
    if (error) throw error;
    const list = waitlist || [];
    if (list.length === 0) return res.json({ data: { sent: 0, total: 0 }, message: 'Sem subscritores na waitlist' });

    const subject = (req.body?.subject || '').trim() || 'A SalDesk acabou de ser lançada!';
    const body    = (req.body?.body    || '').trim() ||
      'Ola!\n\nA SalDesk acabou de ser lancada e ja pode comecar a usar a plataforma.\n\nAceda em https://saldesk.cv e comece hoje mesmo.\n\nEquipa SalDesk';

    let sent = 0;
    /* eslint-disable no-await-in-loop */
    for (const sub of list) {
      try {
        await enviarEmail({ to: sub.email, subject, text: body });
        sent += 1;
      } catch { /* continuar mesmo que um envio falhe */ }
    }
    /* eslint-enable no-await-in-loop */

    return res.json({ data: { sent, total: list.length }, message: `Email enviado para ${sent} de ${list.length} subscritores` });
  } catch (err) { next(err); }
}

/* ─── Códigos de convite ────────────────────────────────────── */
async function listInviteCodes(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('invite_codes').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ data: data || [] });
  } catch (err) { next(err); }
}

async function createInviteCode(req, res, next) {
  try {
    const { code, description, max_uses } = req.body;
    if (!code || !code.trim()) return res.status(400).json({ error: 'Codigo obrigatorio' });
    const { data, error } = await supabaseAdmin.from('invite_codes').insert({
      code:        code.trim().toUpperCase(),
      description: description?.trim() || null,
      max_uses:    max_uses ? Number(max_uses) : 999,
    }).select().single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Codigo de convite criado' });
  } catch (err) { next(err); }
}

async function updateInviteCode(req, res, next) {
  try {
    const updates = {};
    if (req.body.active      !== undefined) updates.active      = !!req.body.active;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.max_uses    !== undefined) updates.max_uses    = Number(req.body.max_uses);
    const { data, error } = await supabaseAdmin.from('invite_codes').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    return res.json({ data, message: 'Codigo actualizado' });
  } catch (err) { next(err); }
}

/* ─── Impact — métricas públicas ────────────────────────────── */
async function getImpact(req, res, next) {
  try {
    const [opsRes, resRes, cusRes] = await Promise.all([
      supabaseAdmin.from('operators').select('id, operator_type, created_at').eq('plan_status', 'active'),
      supabaseAdmin.from('reservations').select('total_price, status, created_at', { count: 'exact' }),
      supabaseAdmin.from('customers').select('id', { count: 'exact' }),
    ]);

    const ops      = opsRes.data  || [];
    const reservas = resRes.data  || [];
    const receita  = reservas.filter(r => r.status === 'checked_out').reduce((s, r) => s + Number(r.total_price || 0), 0);

    const byTypeMap = {};
    ops.forEach(o => { byTypeMap[o.operator_type] = (byTypeMap[o.operator_type] || 0) + 1; });

    const months    = lastMonths(6);
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
        operators_total:    ops.length,
        reservations_total: resRes.count || 0,
        customers_total:    cusRes.count  || 0,
        revenue_total:      Math.round(receita),
        operators_by_type:  Object.entries(byTypeMap).map(([name, value]) => ({ name, value })),
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
      .select('total_price, status, created_at');
    if (error) throw error;

    const byMonth = {};
    (data || []).filter(r => r.status === 'checked_out').forEach(r => {
      const m = r.created_at.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = 0;
      byMonth[m] += Number(r.total_price);
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
  getStats, getActivity,
  listOperators, getOperatorDetail, updateOperator, updateOperatorStatus,
  listLeads, updateLead, sendLeadEmail, convertLead,
  getWaitlist, sendWaitlistEmail,
  listInviteCodes, createInviteCode, updateInviteCode,
  getImpact, getLogs, getSystemHealth,
  getRevenue,
  featured, banners, experiences, events, articles,
};
