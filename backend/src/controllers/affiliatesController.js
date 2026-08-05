const { supabaseAdmin } = require('../config/supabase');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

function genCode(name) {
  const prefix = (name || 'AFF').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return prefix + suffix;
}

/* Calcula, para cada afiliado, reservas reais atribuidas e comissao devida/paga */
async function comStats(operatorId, affiliateIds) {
  if (affiliateIds.length === 0) return {};

  const { data: reservas } = await supabaseAdmin
    .from('reservations')
    .select('affiliate_id, total_price, status')
    .eq('operator_id', operatorId)
    .in('affiliate_id', affiliateIds)
    .neq('status', 'cancelled');

  const { data: pagamentos } = await supabaseAdmin
    .from('affiliate_payments')
    .select('affiliate_id, amount')
    .in('affiliate_id', affiliateIds);

  const stats = {};
  for (const id of affiliateIds) stats[id] = { bookings_count: 0, revenue: 0, paid: 0 };
  for (const r of reservas || []) {
    if (!stats[r.affiliate_id]) continue;
    stats[r.affiliate_id].bookings_count += 1;
    stats[r.affiliate_id].revenue += Number(r.total_price || 0);
  }
  for (const p of pagamentos || []) {
    if (!stats[p.affiliate_id]) continue;
    stats[p.affiliate_id].paid += Number(p.amount || 0);
  }
  return stats;
}

async function listar(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const { data: affiliates, error } = await supabaseAdmin
      .from('affiliates').select('*').eq('operator_id', operatorId).order('created_at', { ascending: false });
    if (error) throw error;

    const stats = await comStats(operatorId, affiliates.map(a => a.id));
    const data = affiliates.map(a => {
      const s = stats[a.id] || { bookings_count: 0, revenue: 0, paid: 0 };
      const owed = Math.round(s.revenue * (Number(a.commission_pct) / 100) * 100) / 100;
      return { ...a, bookings_count: s.bookings_count, commission_owed: owed, commission_paid: s.paid, commission_pending: Math.max(0, owed - s.paid) };
    });
    return res.json({ data, message: 'Afiliados' });
  } catch (err) { next(err); }
}

async function criar(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const { name, email, commission_pct, code, active } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Nome e email sao obrigatorios', code: 'MISSING_FIELDS' });

    const { data, error } = await supabaseAdmin
      .from('affiliates')
      .insert({
        operator_id: operatorId,
        name, email,
        code: (code || genCode(name)).trim().toUpperCase(),
        commission_pct: commission_pct !== undefined ? Number(commission_pct) : 10,
        active: active !== undefined ? active : true,
      })
      .select().single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Ja existe um afiliado com este codigo', code: 'DUPLICATE_CODE' });
      throw error;
    }
    return res.status(201).json({ data: { ...data, bookings_count: 0, commission_owed: 0, commission_paid: 0, commission_pending: 0 }, message: 'Afiliado criado' });
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const { name, email, commission_pct, code, active } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (commission_pct !== undefined) updates.commission_pct = Number(commission_pct);
    if (code !== undefined) updates.code = code.trim().toUpperCase();
    if (active !== undefined) updates.active = active;

    const { data, error } = await supabaseAdmin
      .from('affiliates').update(updates).eq('id', req.params.id).eq('operator_id', operatorId).select().single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Ja existe um afiliado com este codigo', code: 'DUPLICATE_CODE' });
      throw error;
    }
    if (!data) return res.status(404).json({ error: 'Afiliado nao encontrado', code: 'NOT_FOUND' });

    const stats = await comStats(operatorId, [data.id]);
    const s = stats[data.id] || { bookings_count: 0, revenue: 0, paid: 0 };
    const owed = Math.round(s.revenue * (Number(data.commission_pct) / 100) * 100) / 100;
    return res.json({ data: { ...data, bookings_count: s.bookings_count, commission_owed: owed, commission_paid: s.paid, commission_pending: Math.max(0, owed - s.paid) }, message: 'Afiliado actualizado' });
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const { error } = await supabaseAdmin.from('affiliates').delete().eq('id', req.params.id).eq('operator_id', operatorId);
    if (error) throw error;
    return res.json({ message: 'Afiliado eliminado' });
  } catch (err) { next(err); }
}

async function criarPagamento(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const { amount, payment_date, note } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Montante invalido', code: 'INVALID_AMOUNT' });

    const { data: afiliado } = await supabaseAdmin
      .from('affiliates').select('id').eq('id', req.params.id).eq('operator_id', operatorId).maybeSingle();
    if (!afiliado) return res.status(404).json({ error: 'Afiliado nao encontrado', code: 'NOT_FOUND' });

    const { data, error } = await supabaseAdmin
      .from('affiliate_payments')
      .insert({ affiliate_id: afiliado.id, amount: Number(amount), payment_date: payment_date || new Date().toISOString().slice(0, 10), note: note || null })
      .select().single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Pagamento registado' });
  } catch (err) { next(err); }
}

const DEFAULT_CONF = { active: false, commission_pct: 10, min_booking_value: 0 };

async function obterConfig(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const { data } = await supabaseAdmin
      .from('affiliate_config').select('*').eq('operator_id', operatorId).maybeSingle();
    if (data) return res.json({ data, message: 'Configuracao de afiliados' });
    return res.json({ data: { operator_id: operatorId, ...DEFAULT_CONF }, message: 'Configuracao de afiliados (default)' });
  } catch (err) { next(err); }
}

async function actualizarConfig(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const { active, commission_pct, min_booking_value } = req.body;
    const updates = { operator_id: operatorId, updated_at: new Date().toISOString() };
    if (active !== undefined) updates.active = active;
    if (commission_pct !== undefined) updates.commission_pct = Number(commission_pct);
    if (min_booking_value !== undefined) updates.min_booking_value = Number(min_booking_value);

    const { data, error } = await supabaseAdmin
      .from('affiliate_config').upsert(updates, { onConflict: 'operator_id' }).select().single();
    if (error) throw error;
    return res.json({ data, message: 'Configuracao actualizada' });
  } catch (err) { next(err); }
}

/* ── Publico: usado pelo checkout (?ref=CODIGO) e pelo Portal do Afiliado ── */

async function encontrarAfiliadoActivo(operatorId, code) {
  if (!code) return null;
  const { data } = await supabaseAdmin
    .from('affiliates').select('*').eq('operator_id', operatorId).eq('code', String(code).toUpperCase()).eq('active', true).maybeSingle();
  return data || null;
}

async function portalLogin(req, res, next) {
  try {
    const { code, email } = req.body;
    if (!code || !email) return res.status(400).json({ error: 'Codigo e email sao obrigatorios', code: 'MISSING_FIELDS' });

    /* A rota do portal (/afiliado/:codigo) nao inclui o slug do operador,
       por isso o codigo tem de ser globalmente unico (ver migracao 022). */
    const { data: afiliado } = await supabaseAdmin
      .from('affiliates').select('*, operators(slug)').eq('code', String(code).toUpperCase())
      .ilike('email', email.trim()).eq('active', true).maybeSingle();
    if (!afiliado) return res.status(400).json({ error: 'Codigo ou email invalido', code: 'INVALID_CREDENTIALS' });

    const stats = await comStats(afiliado.operator_id, [afiliado.id]);
    const s = stats[afiliado.id] || { bookings_count: 0, revenue: 0, paid: 0 };
    const owed = Math.round(s.revenue * (Number(afiliado.commission_pct) / 100) * 100) / 100;

    const { data: pagamentos } = await supabaseAdmin
      .from('affiliate_payments').select('amount, payment_date, note').eq('affiliate_id', afiliado.id).order('payment_date', { ascending: false });

    const { operators, ...afiliadoData } = afiliado;
    return res.json({
      data: {
        ...afiliadoData,
        slug: operators?.slug,
        bookings_count: s.bookings_count,
        commission_owed: owed,
        commission_paid: s.paid,
        commission_pending: Math.max(0, owed - s.paid),
        payments: pagamentos || [],
      },
      message: 'Login efectuado',
    });
  } catch (err) { next(err); }
}

module.exports = { listar, criar, actualizar, eliminar, criarPagamento, obterConfig, actualizarConfig, encontrarAfiliadoActivo, portalLogin };
