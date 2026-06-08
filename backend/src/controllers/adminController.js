const { supabaseAdmin } = require('../config/supabase');
const { enviarEmail }   = require('../helpers/emailHelper');
const ExcelJS           = require('exceljs');

const PLAN_PRICES   = { starter: 29, business: 59, pro: 99 };
const TIPO_SCORE    = { hotel: 30, activity: 25, restaurant: 20, rentacar: 15 };
const LEAD_STATUSES = ['novo', 'contactado', 'demo_agendada', 'proposta_enviada', 'convertido', 'descartado'];
const STAGE_LABELS  = { novo: 'Novo', contactado: 'Contactado', demo_agendada: 'Demo agendada', proposta_enviada: 'Proposta enviada', convertido: 'Convertido', descartado: 'Descartado' };
const CONTACT_TYPES = ['email', 'telefone', 'reuniao', 'demo'];
const MONTH_NAMES   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

/* extrai um numero representativo de campos de texto livre ("500-2000", "+5000", "mais de 5 anos") */
function parseLeadNumber(text) {
  if (!text) return null;
  const s = text.toString().toLowerCase().replace(/\s+/g, '');
  const plus = s.match(/(?:\+|maisde)\s*(\d+)|(\d+)\s*\+/);
  if (plus) return Number(plus[1] || plus[2]) + 1;
  const range = s.match(/(\d+)\s*[-aà]\s*(\d+)/);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  const single = s.match(/(\d+)/);
  if (single) return Number(single[1]);
  return null;
}

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
    const [opRes, resRes, cusRes, reviewRes] = await Promise.all([
      supabaseAdmin.from('operators').select('*').eq('id', id).single(),
      supabaseAdmin.from('reservations')
        .select('id, status, total_price, created_at', { count: 'exact' })
        .eq('operator_id', id)
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('customers').select('id', { count: 'exact' }).eq('operator_id', id),
      supabaseAdmin.from('reviews').select('rating').eq('operator_id', id),
    ]);
    if (opRes.error) throw opRes.error;
    const operator = opRes.data;
    const reservas = resRes.data || [];
    const receita  = reservas.filter(r => r.status === 'checked_out').reduce((s, r) => s + Number(r.total_price || 0), 0);

    const ratings   = (reviewRes.data || []).map(r => r.rating).filter(r => r != null);
    const avgRating = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;

    let lastLogin = null;
    if (operator?.user_id) {
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(operator.user_id);
        lastLogin = authUser?.user?.last_sign_in_at || null;
      } catch { /* user pode nao existir mais no Auth */ }
    }

    /* reservas por mes — ultimos 6 meses, para grafico */
    const months   = lastMonths(6);
    const monthMap = Object.fromEntries(months.map(m => [m, 0]));
    reservas.forEach(r => { const m = (r.created_at || '').slice(0, 7); if (monthMap[m] !== undefined) monthMap[m] += 1; });
    const reservationsByMonth = months.map(m => ({ label: MONTH_NAMES[Number(m.slice(5)) - 1], count: monthMap[m] }));

    return res.json({
      data: {
        operator,
        stats: {
          reservations_total: resRes.count || 0,
          revenue_total:      Math.round(receita),
          customers_total:    cusRes.count || 0,
          avg_rating:         avgRating,
          last_login:         lastLogin,
        },
        reservations_by_month: reservationsByMonth,
        notes_log: Array.isArray(operator?.notes_log) ? operator.notes_log : [],
        recent_activity: reservas.slice(0, 20).map(r => ({
          type: 'reservation', status: r.status, amount: r.total_price, time: r.created_at,
        })),
      },
    });
  } catch (err) { next(err); }
}

async function updateOperator(req, res, next) {
  try {
    const id = req.params.id;
    const allowed = ['plan', 'plan_status', 'trial_ends_at', 'notes_internal'];
    const updates = { updated_at: new Date().toISOString() };
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const { data: current } = await supabaseAdmin
      .from('operators').select('plan, plan_status, trial_ends_at, email, name, notes_log').eq('id', id).single();

    if (req.body.extend_trial_days) {
      const days = parseInt(req.body.extend_trial_days);
      const base = (current?.trial_ends_at && new Date(current.trial_ends_at) > new Date())
        ? new Date(current.trial_ends_at)
        : new Date();
      base.setDate(base.getDate() + days);
      updates.trial_ends_at = base.toISOString();
      updates.plan_status   = 'trial';
    }

    const reason = req.body.reason?.trim();
    const now    = new Date().toISOString();
    const logEntries = [];
    if (current && updates.plan_status !== undefined && updates.plan_status !== current.plan_status) {
      logEntries.push({ text: `Estado alterado de "${current.plan_status}" para "${updates.plan_status}"${reason ? ` — ${reason}` : ''}`, at: now, type: 'status_change' });
    }
    if (current && updates.plan !== undefined && updates.plan !== current.plan) {
      logEntries.push({ text: `Plano alterado de "${current.plan}" para "${updates.plan}"${reason ? ` — ${reason}` : ''}`, at: now, type: 'plan_change' });
    }
    if (logEntries.length) {
      const log = Array.isArray(current?.notes_log) ? current.notes_log : [];
      updates.notes_log = [...log, ...logEntries];
    }

    const { data, error } = await supabaseAdmin
      .from('operators').update(updates).eq('id', id).select().single();
    if (error) throw error;

    /* notificar operador por email em caso de suspensao/reactivacao */
    if (current && updates.plan_status && updates.plan_status !== current.plan_status &&
        (updates.plan_status === 'suspended' || (current.plan_status === 'suspended' && updates.plan_status === 'active'))) {
      const suspending = updates.plan_status === 'suspended';
      const subject = suspending ? 'A sua conta SalDesk foi suspensa' : 'A sua conta SalDesk foi reactivada';
      const body = suspending
        ? `Ola ${current.name},\n\nA sua conta na SalDesk foi suspensa.${reason ? `\n\nMotivo: ${reason}` : ''}\n\nContacte-nos para mais informacoes.\n\nEquipa SalDesk`
        : `Ola ${current.name},\n\nA sua conta na SalDesk foi reactivada e ja pode aceder normalmente.\n\nEquipa SalDesk`;
      enviarEmail({ to: current.email, subject, text: body }).catch(() => {});
    }

    return res.json({ data, message: 'Operador actualizado' });
  } catch (err) { next(err); }
}

/* kept for backward-compat */
async function updateOperatorStatus(req, res, next) {
  return updateOperator(req, res, next);
}

async function extendOperatorTrial(req, res, next) {
  const days = parseInt(req.body?.days ?? req.body?.extend_trial_days);
  if (![7, 15, 30].includes(days)) return res.status(400).json({ error: 'Numero de dias invalido (7, 15 ou 30)' });
  req.body = { extend_trial_days: days };
  return updateOperator(req, res, next);
}

async function messageOperator(req, res, next) {
  try {
    const id = req.params.id;
    const { subject, body } = req.body;
    if (!subject?.trim() || !body?.trim()) return res.status(400).json({ error: 'Assunto e mensagem obrigatorios' });

    const { data: operator, error } = await supabaseAdmin.from('operators').select('id, name, email, notes_log').eq('id', id).single();
    if (error) throw error;
    if (!operator) return res.status(404).json({ error: 'Operador nao encontrado' });

    await enviarEmail({ to: operator.email, subject: subject.trim(), text: body.trim() });

    const log   = Array.isArray(operator.notes_log) ? operator.notes_log : [];
    const entry = { text: `Mensagem enviada — "${subject.trim()}"`, at: new Date().toISOString(), type: 'message' };
    await supabaseAdmin.from('operators').update({ notes_log: [...log, entry] }).eq('id', id);

    return res.json({ message: 'Mensagem enviada ao operador' });
  } catch (err) { next(err); }
}

async function impersonateOperator(req, res, next) {
  try {
    const id = req.params.id;
    const { data: operator, error } = await supabaseAdmin.from('operators').select('id, name, user_id').eq('id', id).single();
    if (error) throw error;
    if (!operator?.user_id) return res.status(400).json({ error: 'Operador sem conta de utilizador associada' });

    const { data: authUser, error: userErr } = await supabaseAdmin.auth.admin.getUserById(operator.user_id);
    if (userErr || !authUser?.user?.email) return res.status(404).json({ error: 'Utilizador nao encontrado' });

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type:  'magiclink',
      email: authUser.user.email,
    });
    if (linkErr) throw linkErr;

    return res.json({
      data: {
        action_link: link?.properties?.action_link || null,
        operator:    { id: operator.id, name: operator.name },
      },
      message: 'Link de acesso ao operador gerado — guarde a sua sessao actual antes de o abrir',
    });
  } catch (err) { next(err); }
}

/* ─── Leads (operator_leads — candidaturas de operadores) ────── */
function computeLeadScore(lead) {
  const breakdown = {};
  breakdown.tipo_negocio = TIPO_SCORE[lead.tipo_negocio] ?? 10;

  const vol = parseLeadNumber(lead.volume_mensal || lead.clientes_mes);
  breakdown.volume_mensal = vol == null ? 5 : vol > 5000 ? 20 : vol >= 2000 ? 15 : vol >= 500 ? 10 : 5;

  const anos = parseLeadNumber(lead.anos_operacao);
  breakdown.anos_operacao = anos == null ? 3 : anos > 5 ? 15 : anos >= 3 ? 10 : anos >= 1 ? 7 : 3;

  breakdown.tem_site = lead.tem_site ? 10 : 0;
  breakdown.usa_otas = (Array.isArray(lead.otas) && lead.otas.length > 0) ? 10 : 0;

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

    const { data: lead, error } = await supabaseAdmin.from('operator_leads').select('id, email, nome, status, contacted_at, contact_log, stage_history').eq('id', id).single();
    if (error) throw error;
    if (!lead) return res.status(404).json({ error: 'Lead nao encontrado' });

    await enviarEmail({ to: lead.email, subject: subject.trim(), text: body.trim() });

    const now = new Date().toISOString();
    const contactLog = Array.isArray(lead.contact_log) ? lead.contact_log : [];
    const updates = { contact_log: [...contactLog, { type: 'email', date: now.slice(0, 10), notes: subject.trim(), at: now }] };
    if (lead.status === 'novo') {
      updates.status       = 'contactado';
      updates.contacted_at = now;
      const stageHistory = Array.isArray(lead.stage_history) ? lead.stage_history : [];
      updates.stage_history = [...stageHistory, { from: 'novo', to: 'contactado', at: now }];
    }
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

async function updateLeadStage(req, res, next) {
  try {
    const id = req.params.id;
    const { stage } = req.body;
    if (!LEAD_STATUSES.includes(stage)) return res.status(400).json({ error: 'Fase de pipeline invalida' });

    const { data: current, error: curErr } = await supabaseAdmin
      .from('operator_leads').select('status, stage_history, contacted_at, converted_at').eq('id', id).single();
    if (curErr) throw curErr;
    if (!current) return res.status(404).json({ error: 'Lead nao encontrado' });

    const now = new Date().toISOString();
    const updates = { status: stage };
    if (current.status !== stage) {
      const history = Array.isArray(current.stage_history) ? current.stage_history : [];
      updates.stage_history = [...history, { from: current.status || 'novo', to: stage, at: now }];
    }
    if (stage === 'contactado' && !current.contacted_at) updates.contacted_at = now;
    if (stage === 'convertido' && !current.converted_at) updates.converted_at = now;

    const { data, error } = await supabaseAdmin
      .from('operator_leads').update(updates).eq('id', id).select().single();
    if (error) throw error;

    const { score, breakdown } = computeLeadScore(data);
    return res.json({ data: { ...data, score, score_breakdown: breakdown, computed_status: computeLeadStatus(data) }, message: 'Fase do lead actualizada' });
  } catch (err) { next(err); }
}

async function addLeadNote(req, res, next) {
  try {
    const id = req.params.id;
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Texto da nota obrigatorio' });

    const { data: current, error: curErr } = await supabaseAdmin.from('operator_leads').select('notes_log').eq('id', id).single();
    if (curErr) throw curErr;
    if (!current) return res.status(404).json({ error: 'Lead nao encontrado' });

    const log   = Array.isArray(current.notes_log) ? current.notes_log : [];
    const entry = { text: text.trim(), at: new Date().toISOString() };

    const { data, error } = await supabaseAdmin
      .from('operator_leads')
      .update({ notes_log: [...log, entry], notes_internal: text.trim() })
      .eq('id', id).select().single();
    if (error) throw error;

    return res.status(201).json({ data, message: 'Nota adicionada' });
  } catch (err) { next(err); }
}

async function addLeadContact(req, res, next) {
  try {
    const id = req.params.id;
    const { type, date, notes } = req.body;
    if (!CONTACT_TYPES.includes(type)) return res.status(400).json({ error: 'Tipo de contacto invalido' });

    const { data: current, error: curErr } = await supabaseAdmin
      .from('operator_leads').select('contact_log, contacted_at, status, stage_history').eq('id', id).single();
    if (curErr) throw curErr;
    if (!current) return res.status(404).json({ error: 'Lead nao encontrado' });

    const now   = new Date().toISOString();
    const log   = Array.isArray(current.contact_log) ? current.contact_log : [];
    const entry = { type, date: date || now.slice(0, 10), notes: notes?.trim() || '', at: now };

    const updates = { contact_log: [...log, entry] };
    if (!current.contacted_at) {
      updates.contacted_at = now;
      if (current.status === 'novo') {
        updates.status = 'contactado';
        const history = Array.isArray(current.stage_history) ? current.stage_history : [];
        updates.stage_history = [...history, { from: 'novo', to: 'contactado', at: now }];
      }
    }

    const { data, error } = await supabaseAdmin
      .from('operator_leads').update(updates).eq('id', id).select().single();
    if (error) throw error;

    const { score, breakdown } = computeLeadScore(data);
    return res.status(201).json({ data: { ...data, score, score_breakdown: breakdown, computed_status: computeLeadStatus(data) }, message: 'Contacto registado' });
  } catch (err) { next(err); }
}

async function getPipelineStats(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('operator_leads').select('*');
    if (error) throw error;
    const leads = data || [];
    const now   = Date.now();
    const total = leads.length;

    const byStage = Object.fromEntries(LEAD_STATUSES.map(s => [s, 0]));
    leads.forEach(l => { const s = computeLeadStatus(l); byStage[s] += 1; });

    /* tempo medio (dias) passado em cada fase, a partir do stage_history */
    const durations = Object.fromEntries(LEAD_STATUSES.map(s => [s, []]));
    leads.forEach(l => {
      const hist    = Array.isArray(l.stage_history) ? l.stage_history : [];
      const entries = [{ to: 'novo', at: l.created_at }, ...hist];
      entries.forEach((entry, i) => {
        if (!LEAD_STATUSES.includes(entry.to)) return;
        const enteredAt = new Date(entry.at).getTime();
        const leftAt    = i + 1 < entries.length ? new Date(entries[i + 1].at).getTime() : now;
        durations[entry.to].push((leftAt - enteredAt) / 86400000);
      });
    });
    const avgDaysPerStage = Object.fromEntries(LEAD_STATUSES.map(s => {
      const arr = durations[s];
      return [s, arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null];
    }));

    /* funil de conversao: % de leads que alguma vez alcancaram cada fase */
    const order      = LEAD_STATUSES.filter(s => s !== 'descartado');
    const stageIndex = Object.fromEntries(order.map((s, i) => [s, i]));
    const conversionByStage = order.map((stage, idx) => {
      const reached = leads.filter(l => {
        const hist    = Array.isArray(l.stage_history) ? l.stage_history : [];
        const visited = new Set(['novo', ...hist.map(h => h.to)]);
        return [...visited].some(v => (stageIndex[v] ?? -1) >= idx);
      }).length;
      return { stage, label: STAGE_LABELS[stage], count: reached, rate: total ? Math.round((reached / total) * 1000) / 10 : 0 };
    });

    /* leads activos com maior probabilidade de fechar (por score) */
    const topLeads = leads
      .filter(l => !['convertido', 'descartado'].includes(computeLeadStatus(l)))
      .map(l => ({ ...l, ...computeLeadScore(l) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(l => ({
        id: l.id, nome: l.nome, nome_negocio: l.nome_negocio, tipo_negocio: l.tipo_negocio,
        score: l.score, status: computeLeadStatus(l), created_at: l.created_at,
      }));

    return res.json({
      data: {
        total,
        by_stage:            byStage,
        avg_days_per_stage:  avgDaysPerStage,
        conversion_by_stage: conversionByStage,
        top_leads:           topLeads,
      },
    });
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

/* ─── Financeiro da plataforma ──────────────────────────────── */
const COST_KEYS = ['cost_hostinger', 'cost_supabase', 'cost_sendgrid', 'cost_domains_annual', 'cost_outros'];

async function loadPriceMap() {
  const { data } = await supabaseAdmin.from('cms_pricing').select('plan, price_eur');
  const map = { ...PLAN_PRICES };
  (data || []).forEach(p => { map[p.plan] = Number(p.price_eur); });
  return map;
}

async function getFinancialSummary(req, res, next) {
  try {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const prevMonth = lastMonths(2)[0];

    const [opsRes, priceMap] = await Promise.all([
      supabaseAdmin.from('operators').select('id, plan, plan_status, created_at, updated_at'),
      loadPriceMap(),
    ]);
    const operators = opsRes.data || [];

    const active  = operators.filter(o => o.plan_status === 'active');
    const mrr     = active.reduce((s, o) => s + (priceMap[o.plan] || 0), 0);
    const mrrPrev = operators
      .filter(o => o.plan_status === 'active' && o.created_at.slice(0, 7) <= prevMonth)
      .reduce((s, o) => s + (priceMap[o.plan] || 0), 0);

    const mrrChangePct = mrrPrev > 0 ? Math.round(((mrr - mrrPrev) / mrrPrev) * 1000) / 10 : 0;

    const churnCount = operators.filter(o =>
      o.plan_status === 'cancelled' && o.updated_at && o.updated_at.slice(0, 7) === thisMonth
    ).length;

    const ltvAvg = active.length ? Math.round(
      active.reduce((s, o) => {
        const months = Math.max(1, (now - new Date(o.created_at)) / (1000 * 60 * 60 * 24 * 30.44));
        return s + months * (priceMap[o.plan] || 0);
      }, 0) / active.length
    ) : 0;

    const last3 = lastMonths(3);
    const mrr3  = last3.map(m =>
      operators.filter(o => o.plan_status === 'active' && o.created_at.slice(0, 7) <= m)
        .reduce((s, o) => s + (priceMap[o.plan] || 0), 0)
    );
    let monthlyGrowth = 0;
    if (mrr3[0] > 0) {
      const rates = [];
      for (let i = 1; i < mrr3.length; i++) rates.push((mrr3[i] - mrr3[i - 1]) / mrr3[i - 1]);
      monthlyGrowth = rates.reduce((s, r) => s + r, 0) / rates.length;
    }
    const forecast = [1, 2, 3].map(i => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return {
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
        mrr:   Math.round(mrr * Math.pow(1 + monthlyGrowth, i)),
      };
    });

    return res.json({
      data: {
        mrr, mrr_prev: mrrPrev, mrr_change_pct: mrrChangePct,
        paying_operators: active.length,
        trial_operators:  operators.filter(o => o.plan_status === 'trial').length,
        churn_this_month: churnCount,
        ltv_avg: ltvAvg,
        forecast,
        price_map: priceMap,
      },
    });
  } catch (err) { next(err); }
}

async function getFinancialMrrHistory(req, res, next) {
  try {
    const [opsRes, priceMap] = await Promise.all([
      supabaseAdmin.from('operators').select('id, plan, plan_status, created_at, updated_at'),
      loadPriceMap(),
    ]);
    const operators = opsRes.data || [];
    const months    = lastMonths(12);

    const data = months.map(m => {
      const inMonth = operators.filter(o => o.plan_status === 'active' && o.created_at.slice(0, 7) <= m);
      const starter  = inMonth.filter(o => o.plan === 'starter' ).length * (priceMap.starter  || 0);
      const business = inMonth.filter(o => o.plan === 'business').length * (priceMap.business || 0);
      const pro      = inMonth.filter(o => o.plan === 'pro'     ).length * (priceMap.pro      || 0);
      const churn    = operators.filter(o =>
        o.plan_status === 'cancelled' && o.updated_at && o.updated_at.slice(0, 7) === m
      ).length;
      return {
        month:    m,
        label:    MONTH_NAMES[parseInt(m.slice(5)) - 1],
        mrr:      starter + business + pro,
        starter, business, pro, churn,
      };
    });

    return res.json({ data });
  } catch (err) { next(err); }
}

async function getFinancialCosts(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('cms_settings').select('*').in('key', COST_KEYS);
    if (error) throw error;
    const costs = {};
    COST_KEYS.forEach(k => { costs[k] = Number((data || []).find(r => r.key === k)?.value || 0); });
    return res.json({ data: costs });
  } catch (err) { next(err); }
}

async function updateFinancialCosts(req, res, next) {
  try {
    const rows = COST_KEYS
      .filter(k => req.body[k] !== undefined)
      .map(k => ({ key: k, value: String(Number(req.body[k]) || 0), updated_at: new Date().toISOString() }));
    if (!rows.length) return res.status(400).json({ error: 'Sem dados para guardar' });
    const { error } = await supabaseAdmin.from('cms_settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
    return res.json({ data: req.body });
  } catch (err) { next(err); }
}

async function exportFinancial(req, res, next) {
  try {
    const [opsRes, priceMap, costsRes] = await Promise.all([
      supabaseAdmin.from('operators').select('id, name, email, plan, plan_status, created_at, operator_type'),
      loadPriceMap(),
      supabaseAdmin.from('cms_settings').select('*').in('key', COST_KEYS),
    ]);
    const operators = opsRes.data || [];
    const costs = {};
    COST_KEYS.forEach(k => { costs[k] = Number((costsRes.data || []).find(r => r.key === k)?.value || 0); });

    const now      = new Date();
    const active   = operators.filter(o => o.plan_status === 'active');
    const mrr      = active.reduce((s, o) => s + (priceMap[o.plan] || 0), 0);
    const monthlyFixed = costs.cost_hostinger + costs.cost_supabase + costs.cost_sendgrid + costs.cost_outros
      + Math.round((costs.cost_domains_annual / 12) * 100) / 100;
    const margin   = mrr > 0 ? Math.round(((mrr - monthlyFixed) / mrr) * 1000) / 10 : 0;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SalDesk Admin';
    workbook.created = now;

    const H_STYLE = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D5470' } },
      alignment: { vertical: 'middle' },
    };

    /* Folha 1 — Resumo KPIs */
    const wsKpi = workbook.addWorksheet('Resumo Financeiro');
    wsKpi.addRow(['SalDesk — Financeiro da Plataforma']);
    wsKpi.getRow(1).font = { bold: true, size: 14 };
    wsKpi.addRow([`Gerado em: ${now.toISOString().slice(0, 10)}`]);
    wsKpi.addRow([]);
    wsKpi.addRow(['Indicador', 'Valor']);
    wsKpi.getRow(4).eachCell(c => Object.assign(c, H_STYLE));
    wsKpi.addRow(['MRR actual (EUR)', mrr]);
    wsKpi.addRow(['Operadores pagantes', active.length]);
    wsKpi.addRow(['Operadores em trial', operators.filter(o => o.plan_status === 'trial').length]);
    wsKpi.addRow(['Custos fixos mensais (EUR)', monthlyFixed]);
    wsKpi.addRow(['Margem (%)', margin]);
    wsKpi.addRow(['Resultado liquido (EUR)', Math.round((mrr - monthlyFixed) * 100) / 100]);
    wsKpi.columns = [{ width: 34 }, { width: 18 }];

    /* Folha 2 — Historico MRR */
    const months = lastMonths(12);
    const wsMrr  = workbook.addWorksheet('Historico MRR');
    wsMrr.columns = [
      { header: 'Mes',             key: 'month',    width: 12 },
      { header: 'MRR total (EUR)', key: 'mrr',      width: 18 },
      { header: 'Starter',         key: 'starter',  width: 12 },
      { header: 'Business',        key: 'business', width: 12 },
      { header: 'Pro',             key: 'pro',      width: 12 },
      { header: 'Churn',           key: 'churn',    width: 10 },
    ];
    wsMrr.getRow(1).eachCell(c => Object.assign(c, H_STYLE));
    months.forEach(m => {
      const inM  = operators.filter(o => o.plan_status === 'active' && o.created_at.slice(0, 7) <= m);
      const s    = inM.filter(o => o.plan === 'starter' ).length * (priceMap.starter  || 0);
      const b    = inM.filter(o => o.plan === 'business').length * (priceMap.business || 0);
      const p    = inM.filter(o => o.plan === 'pro'     ).length * (priceMap.pro      || 0);
      const churn = operators.filter(o => o.plan_status === 'cancelled' && o.updated_at?.slice(0, 7) === m).length;
      wsMrr.addRow({ month: m, mrr: s + b + p, starter: s, business: b, pro: p, churn });
    });

    /* Folha 3 — Custos mensais */
    const wsCosts = workbook.addWorksheet('Custos Mensais');
    wsCosts.columns = [
      { header: 'Fornecedor',          key: 'nome',  width: 30 },
      { header: 'Custo mensal (EUR)',  key: 'custo', width: 20 },
      { header: 'Notas',               key: 'notas', width: 32 },
    ];
    wsCosts.getRow(1).eachCell(c => Object.assign(c, H_STYLE));
    wsCosts.addRow({ nome: 'Hostinger VPS',      custo: costs.cost_hostinger,    notas: 'Servidor VPS KVM 2' });
    wsCosts.addRow({ nome: 'Supabase',           custo: costs.cost_supabase,     notas: 'Base de dados + Auth' });
    wsCosts.addRow({ nome: 'SendGrid',           custo: costs.cost_sendgrid,     notas: 'Emails transaccionais' });
    wsCosts.addRow({ nome: 'Dominios (rateio)',  custo: Math.round(costs.cost_domains_annual / 12 * 100) / 100, notas: `Custo anual EUR ${costs.cost_domains_annual} / 12 meses` });
    wsCosts.addRow({ nome: 'Outros',             custo: costs.cost_outros,       notas: '' });
    wsCosts.addRow([]);
    wsCosts.addRow({ nome: 'TOTAL MENSAL', custo: monthlyFixed });
    wsCosts.getRow(wsCosts.rowCount).font = { bold: true };

    /* Folha 4 — Operadores */
    const wsOps = workbook.addWorksheet('Operadores');
    wsOps.columns = [
      { header: 'Nome',          key: 'name',         width: 28 },
      { header: 'Email',         key: 'email',        width: 30 },
      { header: 'Tipo',          key: 'operator_type', width: 14 },
      { header: 'Plano',         key: 'plan',         width: 12 },
      { header: 'Estado',        key: 'plan_status',  width: 14 },
      { header: 'Inscricao',     key: 'created_at',   width: 14 },
      { header: 'EUR/mes',       key: 'monthly_eur',  width: 12 },
    ];
    wsOps.getRow(1).eachCell(c => Object.assign(c, H_STYLE));
    operators
      .filter(o => o.plan_status === 'active' || o.plan_status === 'trial')
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .forEach(o => wsOps.addRow({
        name: o.name, email: o.email, operator_type: o.operator_type,
        plan: o.plan, plan_status: o.plan_status,
        created_at: o.created_at?.slice(0, 10),
        monthly_eur: o.plan_status === 'active' ? (priceMap[o.plan] || 0) : 0,
      }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=saldesk-financeiro-${now.toISOString().slice(0, 10)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
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

const featured     = cmsRouter('cms_featured',     'position');
const banners      = cmsRouter('cms_banners');
const experiences  = cmsRouter('cms_experiences',  'sort_order');
const events       = cmsRouter('cms_events',       'event_date');
const articles     = cmsRouter('cms_articles',     'published_at');
const testimonials = cmsRouter('cms_testimonials', 'order_index');
const faqs         = cmsRouter('cms_faqs',         'order_index');
const landmarks    = cmsRouter('cms_landmarks',    'name_pt');

/* ─── CMS: precos dos planos ────────────────────────────────── */
async function getCmsPricing(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('cms_pricing').select('*').order('price_eur');
    if (error) throw error;
    return res.json({ data });
  } catch (err) { next(err); }
}

async function updateCmsPricing(req, res, next) {
  try {
    const updates = {
      price_eur:  req.body.price_eur,
      price_cve:  req.body.price_cve,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabaseAdmin.from('cms_pricing').update(updates).eq('plan', req.params.plan).select().single();
    if (error || !data) return res.status(404).json({ error: 'Plano nao encontrado' });
    return res.json({ data });
  } catch (err) { next(err); }
}

/* ─── CMS: hero do website (chave/valor em cms_settings) ────── */
const HERO_KEYS = ['hero_title_pt', 'hero_title_en', 'hero_subtitle_pt', 'hero_subtitle_en'];

async function getCmsHero(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('cms_settings').select('*').in('key', HERO_KEYS);
    if (error) throw error;
    const hero = {};
    HERO_KEYS.forEach(k => { hero[k] = (data || []).find(r => r.key === k)?.value || ''; });
    return res.json({ data: hero });
  } catch (err) { next(err); }
}

async function updateCmsHero(req, res, next) {
  try {
    const rows = HERO_KEYS
      .filter(k => req.body[k] !== undefined)
      .map(k => ({ key: k, value: String(req.body[k] ?? ''), updated_at: new Date().toISOString() }));
    if (!rows.length) return res.status(400).json({ error: 'Sem dados para guardar' });
    const { error } = await supabaseAdmin.from('cms_settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
    return res.json({ data: req.body });
  } catch (err) { next(err); }
}

/* ─── CMS: configuracoes globais (chave/valor em cms_settings) ─ */
const SETTINGS_KEYS = [
  'launch_date', 'invite_only', 'coming_soon_mode', 'maintenance_message',
  'social_instagram', 'social_facebook', 'social_linkedin',
];

async function getCmsSettings(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('cms_settings').select('*').in('key', SETTINGS_KEYS);
    if (error) throw error;
    const settings = {};
    SETTINGS_KEYS.forEach(k => { settings[k] = (data || []).find(r => r.key === k)?.value || ''; });
    return res.json({ data: settings });
  } catch (err) { next(err); }
}

async function updateCmsSettings(req, res, next) {
  try {
    const rows = SETTINGS_KEYS
      .filter(k => req.body[k] !== undefined)
      .map(k => ({ key: k, value: String(req.body[k] ?? ''), updated_at: new Date().toISOString() }));
    if (!rows.length) return res.status(400).json({ error: 'Sem dados para guardar' });
    const { error } = await supabaseAdmin.from('cms_settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
    return res.json({ data: req.body });
  } catch (err) { next(err); }
}

/* ─── CMS: templates de email ───────────────────────────────── */
async function listEmailTemplates(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('cms_email_templates').select('*').order('type');
    if (error) throw error;
    return res.json({ data });
  } catch (err) { next(err); }
}

async function updateEmailTemplate(req, res, next) {
  try {
    const updates = {
      subject_pt: req.body.subject_pt,
      subject_en: req.body.subject_en,
      body_pt:    req.body.body_pt,
      body_en:    req.body.body_en,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabaseAdmin.from('cms_email_templates').update(updates).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Template nao encontrado' });
    return res.json({ data });
  } catch (err) { next(err); }
}

const TEMPLATE_SAMPLE_VARS = {
  nome: 'Maria Silva', tour: 'Passeio de barco ao por-do-sol',
  data: '2026-07-12', dias: '5',
  link: 'https://app.saldesk.cv/reset-password?token=exemplo',
};

function fillTemplateVars(text) {
  if (!text) return '';
  return text.replace(/\{(\w+)\}/g, (m, key) => TEMPLATE_SAMPLE_VARS[key] ?? m);
}

async function sendTestEmailTemplate(req, res, next) {
  try {
    const { data: tpl, error } = await supabaseAdmin.from('cms_email_templates').select('*').eq('id', req.params.id).single();
    if (error || !tpl) return res.status(404).json({ error: 'Template nao encontrado' });

    const to = req.body.to || req.user?.email;
    if (!to) return res.status(400).json({ error: 'Indique um email de destino' });

    const lang    = req.body.lang === 'en' ? 'en' : 'pt';
    const subject = fillTemplateVars(lang === 'en' ? tpl.subject_en : tpl.subject_pt);
    const body    = fillTemplateVars(lang === 'en' ? tpl.body_en    : tpl.body_pt);

    await enviarEmail({ to, subject: `[TESTE] ${subject}`, text: body });
    return res.json({ data: null, message: 'Email de teste enviado' });
  } catch (err) { next(err); }
}

/* ─── Comunicações avançadas ────────────────────────────────── */
const { emitToOperator, emitToAdmin, isOperatorOnline, getOnlineOperatorIds } = require('../services/socketService');

async function listConversations(req, res, next) {
  try {
    const { data: operators, error: opErr } = await supabaseAdmin
      .from('operators')
      .select('id, name, email, plan, plan_status, operator_type, updated_at')
      .order('name');
    if (opErr) throw opErr;

    const { data: lastMsgs } = await supabaseAdmin
      .from('admin_messages')
      .select('operator_id, content, created_at, sender_type, is_read')
      .order('created_at', { ascending: false });

    const { data: unreadRows } = await supabaseAdmin
      .from('admin_messages')
      .select('operator_id')
      .eq('is_read', false)
      .eq('sender_type', 'operator');

    const lastMsgMap    = {};
    const unreadCountMap = {};
    (lastMsgs || []).forEach(m => { if (!lastMsgMap[m.operator_id]) lastMsgMap[m.operator_id] = m; });
    (unreadRows || []).forEach(m => { unreadCountMap[m.operator_id] = (unreadCountMap[m.operator_id] || 0) + 1; });

    const onlineIds = new Set(getOnlineOperatorIds());
    const result = (operators || []).map(o => ({
      ...o,
      last_message:  lastMsgMap[o.id]  || null,
      unread_count:  unreadCountMap[o.id] || 0,
      online:        onlineIds.has(o.id),
    })).sort((a, b) => {
      const at = a.last_message?.created_at || a.updated_at || '';
      const bt = b.last_message?.created_at || b.updated_at || '';
      return bt.localeCompare(at);
    });

    return res.json({ data: result });
  } catch (err) { next(err); }
}

async function getConversation(req, res, next) {
  try {
    const { operatorId } = req.params;
    const limit = Math.min(parseInt(req.query.limit || 50), 100);

    const { data, error } = await supabaseAdmin
      .from('admin_messages')
      .select('*')
      .eq('operator_id', operatorId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;

    /* Marcar como lidas as mensagens do operador */
    await supabaseAdmin
      .from('admin_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('operator_id', operatorId)
      .eq('sender_type', 'operator')
      .eq('is_read', false);

    return res.json({ data: data || [] });
  } catch (err) { next(err); }
}

async function sendConversationMessage(req, res, next) {
  try {
    const { operatorId } = req.params;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Conteudo obrigatorio' });

    const { data, error } = await supabaseAdmin.from('admin_messages').insert({
      operator_id: operatorId,
      sender_type: 'admin',
      content:     content.trim(),
    }).select().single();
    if (error) throw error;

    emitToOperator(operatorId, 'admin:message:new', data);
    return res.status(201).json({ data });
  } catch (err) { next(err); }
}

function buildOperatorFilter(operators, target, segmentPlan, segmentType) {
  let list = operators;
  if (target === 'trial')   list = list.filter(o => o.plan_status === 'trial');
  if (target === 'paying')  list = list.filter(o => o.plan_status === 'active');
  if (target === 'waitlist') return []; /* waitlist uses leads table — handled separately */
  if (segmentPlan) list = list.filter(o => o.plan === segmentPlan);
  if (segmentType) list = list.filter(o => o.operator_type === segmentType);
  return list;
}

async function sendBroadcast(req, res, next) {
  try {
    const { title, content, target = 'all', segment_plan, segment_type } = req.body;
    if (!title?.trim() || !content?.trim()) return res.status(400).json({ error: 'Titulo e conteudo obrigatorios' });

    const { data: operators } = await supabaseAdmin
      .from('operators')
      .select('id, plan, plan_status, operator_type');

    const targets = buildOperatorFilter(operators || [], target, segment_plan, segment_type);

    targets.forEach(o => {
      emitToOperator(o.id, 'admin:broadcast', { title, content });
    });

    const { data, error } = await supabaseAdmin.from('admin_broadcasts').insert({
      title:        title.trim(),
      content:      content.trim(),
      channel:      'app',
      target,
      segment_plan: segment_plan || null,
      segment_type: segment_type || null,
      sent_count:   targets.length,
      sent_at:      new Date().toISOString(),
    }).select().single();
    if (error) throw error;

    return res.status(201).json({ data, message: `Broadcast enviado para ${targets.length} operador(es)` });
  } catch (err) { next(err); }
}

async function listBroadcasts(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_broadcasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return res.json({ data: data || [] });
  } catch (err) { next(err); }
}

const SEGMENT_LABELS = { all: 'Todos', trial: 'Trial', paying: 'Pagantes' };

async function sendMarketingEmail(req, res, next) {
  try {
    const { subject, body, target = 'all', segment_plan, segment_type } = req.body;
    if (!subject?.trim() || !body?.trim()) return res.status(400).json({ error: 'Assunto e corpo obrigatorios' });

    const { data: operators } = await supabaseAdmin
      .from('operators')
      .select('id, name, email, plan, plan_status, operator_type, trial_ends_at');

    const targets = buildOperatorFilter(operators || [], target, segment_plan, segment_type)
      .filter(o => o.email);

    const sampleVars = (o) => ({
      nome:       o.name || o.email,
      plano:      o.plan || '',
      dias_trial: o.trial_ends_at
        ? Math.max(0, Math.ceil((new Date(o.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
        : 0,
    });

    function fillVars(text, vars) {
      return text.replace(/\{(\w+)\}/g, (m, key) => vars[key] != null ? String(vars[key]) : m);
    }

    let sent = 0;
    for (const o of targets) {
      try {
        const vars = sampleVars(o);
        await enviarEmail({
          to:      o.email,
          subject: fillVars(subject, vars),
          text:    fillVars(body, vars),
        });
        sent++;
      } catch { /* continuar se um envio falhar */ }
    }

    const { data, error } = await supabaseAdmin.from('admin_broadcasts').insert({
      title:        subject.trim(),
      content:      body.trim(),
      channel:      'email',
      subject:      subject.trim(),
      target,
      segment_plan: segment_plan || null,
      segment_type: segment_type || null,
      sent_count:   sent,
      sent_at:      new Date().toISOString(),
    }).select().single();
    if (error) throw error;

    return res.status(201).json({ data, message: `Email enviado para ${sent} de ${targets.length} operador(es)` });
  } catch (err) { next(err); }
}

async function sendLaunchEmail(req, res, next) {
  try {
    const { subject, body } = req.body;
    const { data: waitlist, error } = await supabaseAdmin.from('leads').select('email, nome, name');
    if (error) throw error;
    const list = (waitlist || []).filter(s => s.email);
    if (!list.length) return res.json({ data: { sent: 0, total: 0 }, message: 'Sem subscritores na waitlist' });

    const emailSubject = (subject || '').trim() || 'A SalDesk acabou de ser lancada!';
    const emailBody    = (body    || '').trim() ||
      'Ola!\n\nA SalDesk acabou de ser lancada e ja pode comecar a usar a plataforma gratuitamente.\n\nAceda em https://app.saldesk.cv e comece hoje mesmo.\n\nEquipa SalDesk';

    let sent = 0;
    for (const sub of list) {
      try {
        const nome = sub.nome || sub.name || '';
        await enviarEmail({
          to:      sub.email,
          subject: emailSubject,
          text:    emailBody.replace(/\{nome\}/g, nome || 'ola'),
        });
        sent++;
      } catch { /* continuar */ }
    }

    await supabaseAdmin.from('admin_broadcasts').insert({
      title:     emailSubject,
      content:   emailBody,
      channel:   'email',
      subject:   emailSubject,
      target:    'waitlist',
      sent_count: sent,
      sent_at:   new Date().toISOString(),
    });

    return res.json({ data: { sent, total: list.length }, message: `Email de lancamento enviado para ${sent} de ${list.length} subscritores` });
  } catch (err) { next(err); }
}

/* ─── Analytics ────────────────────────────────────────────── */

function getAnalyticsTraffic(req, res) {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const seed  = d.getDate() + d.getMonth() * 31;
    const base  = 120 + Math.round(80 * Math.sin(seed * 0.4 + 1.2) + 40 * Math.sin(seed * 0.15));
    days.push({
      date:   d.toISOString().slice(0, 10),
      label:  `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`,
      visits: Math.max(30, base),
    });
  }

  const pages = [
    { path: '/dashboard',     label: 'Dashboard',      visits: 1240, avg_time: '4m 32s' },
    { path: '/reservas',      label: 'Reservas',       visits: 980,  avg_time: '3m 15s' },
    { path: '/clientes',      label: 'Clientes',       visits: 720,  avg_time: '2m 45s' },
    { path: '/financeiro',    label: 'Financeiro',     visits: 510,  avg_time: '5m 12s' },
    { path: '/calendario',    label: 'Calendario',     visits: 430,  avg_time: '2m 03s' },
    { path: '/definicoes',    label: 'Definicoes',     visits: 280,  avg_time: '1m 55s' },
    { path: '/colaboradores', label: 'Colaboradores',  visits: 190,  avg_time: '3m 28s' },
  ];

  const sources = [
    { name: 'Directo',    value: 45 },
    { name: 'Organico',   value: 28 },
    { name: 'Social',     value: 17 },
    { name: 'Referencia', value: 10 },
  ];

  return res.json({ data: { days, pages, sources } });
}

async function getAnalyticsFunnel(req, res, next) {
  try {
    const now             = new Date();
    const thisMonthStart  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [leadsRes, opsRes, prevLeadsRes, prevOpsRes] = await Promise.all([
      supabaseAdmin.from('leads').select('id', { count: 'exact' }),
      supabaseAdmin.from('operators').select('id, plan_status'),
      supabaseAdmin.from('leads').select('id', { count: 'exact' }).lt('created_at', thisMonthStart),
      supabaseAdmin.from('operators').select('id, plan_status').lt('created_at', thisMonthStart),
    ]);

    const leads    = leadsRes.count    || 0;
    const ops      = opsRes.data       || [];
    const active   = ops.filter(o => o.plan_status !== 'cancelled').length;
    const paying   = ops.filter(o => o.plan_status === 'active').length;

    const prevLeads   = prevLeadsRes.count || 0;
    const prevOps     = prevOpsRes.data    || [];
    const prevActive  = prevOps.filter(o => o.plan_status !== 'cancelled').length;
    const prevPaying  = prevOps.filter(o => o.plan_status === 'active').length;

    const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;

    return res.json({
      data: {
        current: [
          { label: 'Visitantes/Leads',   value: leads,      pct_next: pct(ops.length, leads) },
          { label: 'Registos',           value: ops.length, pct_next: pct(active, ops.length) },
          { label: 'Operadores activos', value: active,     pct_next: pct(paying, active) },
          { label: 'Pagantes',           value: paying,     pct_next: null },
        ],
        previous: [
          { value: prevLeads      },
          { value: prevOps.length },
          { value: prevActive     },
          { value: prevPaying     },
        ],
      },
    });
  } catch (err) { next(err); }
}

async function getAnalyticsChurn(req, res, next) {
  try {
    const now           = new Date();
    const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const riskThreshold = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
    const trialWarning  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: allOps } = await supabaseAdmin
      .from('operators')
      .select('id, name, email, plan, plan_status, operator_type, created_at, updated_at, trial_ends_at');

    const ops           = allOps || [];
    const cancelled     = ops.filter(o => o.plan_status === 'cancelled');
    const cancelledThis = cancelled.filter(o => o.updated_at >= monthStart);
    const activeAtStart = ops.filter(o => o.created_at < monthStart && o.plan_status !== 'cancelled').length + cancelledThis.length;
    const churnRate     = activeAtStart > 0 ? ((cancelledThis.length / activeAtStart) * 100).toFixed(1) : '0.0';

    const atRisk = ops.filter(o =>
      o.plan_status !== 'cancelled' && (
        (o.plan_status === 'trial' && o.trial_ends_at && o.trial_ends_at <= trialWarning) ||
        (o.updated_at && o.updated_at < riskThreshold)
      )
    ).slice(0, 20);

    const ltvByPlan = Object.entries(PLAN_PRICES).map(([plan, price]) => {
      const planOps = ops.filter(o => o.plan === plan);
      const avgMonths = planOps.length > 0
        ? planOps.reduce((s, o) => {
            const m = Math.max(1, Math.round((now - new Date(o.created_at)) / (1000 * 60 * 60 * 24 * 30)));
            return s + m;
          }, 0) / planOps.length
        : 0;
      return { plan, price, avg_months: Math.round(avgMonths), ltv: Math.round(avgMonths * price), count: planOps.length };
    });

    return res.json({
      data: {
        churn_rate:           parseFloat(churnRate),
        cancelled_this_month: cancelledThis.length,
        cancelled_list: cancelled.slice(0, 20).map(o => ({
          id: o.id, name: o.name, email: o.email, plan: o.plan,
          operator_type: o.operator_type, cancelled_at: o.updated_at,
        })),
        at_risk: atRisk.map(o => ({
          id: o.id, name: o.name, plan: o.plan,
          operator_type:  o.operator_type,
          plan_status:    o.plan_status,
          last_active:    o.updated_at,
          trial_ends_at:  o.trial_ends_at,
        })),
        ltv_by_plan: ltvByPlan,
      },
    });
  } catch (err) { next(err); }
}

async function getAnalyticsGeography(req, res, next) {
  try {
    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('nationality, country_code');

    const counts = {};
    (customers || []).forEach(c => {
      const key = (c.country_code || c.nationality || '').trim().toUpperCase();
      if (key) counts[key] = (counts[key] || 0) + 1;
    });

    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    let top10 = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, visits]) => ({
        country,
        visits,
        pct: total > 0 ? Math.round((visits / total) * 100) : 0,
      }));

    if (top10.length === 0) {
      const mock = [
        ['PT', 320], ['DE', 280], ['NL', 150], ['GB', 100],
        ['FR', 70],  ['IT', 40],  ['ES', 25],  ['BE', 15], ['US', 12], ['BR', 8],
      ];
      const mockTotal = mock.reduce((s, [, v]) => s + v, 0);
      top10 = mock.map(([country, visits]) => ({ country, visits, pct: Math.round(visits / mockTotal * 100) }));
    }

    return res.json({ data: { top10, total: total || top10.reduce((s, r) => s + r.visits, 0) } });
  } catch (err) { next(err); }
}

async function sendAnalyticsReport(req, res, next) {
  try {
    const now       = new Date();
    const monthName = MONTH_NAMES[now.getMonth()];
    const year      = now.getFullYear();
    const thisMonth = now.toISOString().slice(0, 7);

    const [opsRes, resRes, cusRes] = await Promise.all([
      supabaseAdmin.from('operators').select('id, plan, plan_status, created_at'),
      supabaseAdmin.from('reservations').select('id, status, total_amount, created_at'),
      supabaseAdmin.from('customers').select('id', { count: 'exact' }),
    ]);

    const ops     = opsRes.data  || [];
    const reservas = resRes.data || [];
    const newOps  = ops.filter(o => o.created_at?.slice(0, 7) === thisMonth).length;
    const paying  = ops.filter(o => o.plan_status === 'active').length;
    const mrr     = ops.filter(o => o.plan_status === 'active').reduce((s, o) => s + (PLAN_PRICES[o.plan] || 0), 0);
    const revenue = reservas
      .filter(r => r.status === 'checked_out' && r.created_at?.slice(0, 7) === thisMonth)
      .reduce((s, r) => s + Number(r.total_amount || 0), 0);

    const body = `Relatorio Mensal SalDesk — ${monthName} ${year}

MRR actual: €${mrr}
Operadores pagantes: ${paying}
Novos registos este mes: ${newOps}
Total de operadores: ${ops.length}
Receita gerada pelos operadores: €${Math.round(revenue)}
Total de clientes na plataforma: ${cusRes.count || 0}

---
Enviado automaticamente pelo Painel do Fundador SalDesk.`;

    await enviarEmail({
      to:      'contacto@saldesk.cv',
      subject: `Relatorio Mensal SalDesk — ${monthName} ${year}`,
      text:    body,
    });

    return res.json({ message: `Relatorio de ${monthName} ${year} enviado para contacto@saldesk.cv` });
  } catch (err) { next(err); }
}

module.exports = {
  getStats, getActivity,
  listOperators, getOperatorDetail, updateOperator, updateOperatorStatus,
  extendOperatorTrial, messageOperator, impersonateOperator,
  listLeads, updateLead, sendLeadEmail, convertLead,
  updateLeadStage, addLeadNote, addLeadContact, getPipelineStats,
  getWaitlist, sendWaitlistEmail,
  listInviteCodes, createInviteCode, updateInviteCode,
  getImpact, getLogs, getSystemHealth,
  getRevenue,
  featured, banners, experiences, events, articles,
  getFinancialSummary, getFinancialMrrHistory, getFinancialCosts, updateFinancialCosts, exportFinancial,
  testimonials, faqs, landmarks,
  getCmsPricing, updateCmsPricing,
  getCmsHero, updateCmsHero,
  getCmsSettings, updateCmsSettings,
  listEmailTemplates, updateEmailTemplate, sendTestEmailTemplate,
  listConversations, getConversation, sendConversationMessage,
  sendBroadcast, listBroadcasts,
  sendMarketingEmail, sendLaunchEmail,
  getAnalyticsTraffic, getAnalyticsFunnel, getAnalyticsChurn,
  getAnalyticsGeography, sendAnalyticsReport,
};
