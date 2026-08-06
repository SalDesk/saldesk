const { supabaseAdmin } = require('../config/supabase');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

/* ── Despesas ── */

async function listarDespesas(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('expenses')
      .select('*')
      .eq('operator_id', getOperatorId(req))
      .order('date', { ascending: false });
    if (error) throw error;
    return res.json({ data, message: 'Despesas listadas' });
  } catch (err) { next(err); }
}

async function criarDespesa(req, res, next) {
  try {
    const { category, amount, currency, date, staff_id, is_recurring, notes, receipt_url } = req.body;
    if (!category || amount === undefined || !date) {
      return res.status(400).json({ error: 'category, amount e date sao obrigatorios', code: 'MISSING_FIELDS' });
    }
    const { data, error } = await supabaseAdmin
      .from('expenses')
      .insert({
        operator_id:  getOperatorId(req),
        category,
        amount:       Number(amount),
        currency:     currency || 'EUR',
        date,
        staff_id:     staff_id || null,
        is_recurring: !!is_recurring,
        notes:        notes || null,
        receipt_url:  receipt_url || null,
      })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Despesa registada' });
  } catch (err) { next(err); }
}

async function actualizarDespesa(req, res, next) {
  try {
    const { category, amount, currency, date, staff_id, is_recurring, notes, receipt_url } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (category !== undefined)     updates.category = category;
    if (amount !== undefined)       updates.amount = Number(amount);
    if (currency !== undefined)     updates.currency = currency;
    if (date !== undefined)         updates.date = date;
    if (staff_id !== undefined)     updates.staff_id = staff_id || null;
    if (is_recurring !== undefined) updates.is_recurring = !!is_recurring;
    if (notes !== undefined)        updates.notes = notes || null;
    if (receipt_url !== undefined)  updates.receipt_url = receipt_url || null;

    const { data, error } = await supabaseAdmin
      .from('expenses')
      .update(updates)
      .eq('id', req.params.id)
      .eq('operator_id', getOperatorId(req))
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Despesa nao encontrada', code: 'NOT_FOUND' });
    return res.json({ data, message: 'Despesa actualizada' });
  } catch (err) { next(err); }
}

async function eliminarDespesa(req, res, next) {
  try {
    const { error } = await supabaseAdmin
      .from('expenses')
      .delete()
      .eq('id', req.params.id)
      .eq('operator_id', getOperatorId(req));
    if (error) throw error;
    return res.json({ data: null, message: 'Despesa eliminada' });
  } catch (err) { next(err); }
}

/* ── Configuracao salarial (uma linha por colaborador) ── */

async function listarSalaryConfigs(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('salary_configs')
      .select('*')
      .eq('operator_id', getOperatorId(req));
    if (error) throw error;
    const byStaff = {};
    for (const c of data || []) {
      byStaff[c.staff_id] = { base: Number(c.base), food: Number(c.food), transport: Number(c.transport), inps_pct: Number(c.inps_pct) };
    }
    return res.json({ data: byStaff, message: 'Configuracao salarial' });
  } catch (err) { next(err); }
}

async function actualizarSalaryConfig(req, res, next) {
  try {
    const { staffId } = req.params;
    const { base, food, transport, inps_pct } = req.body;
    const { data, error } = await supabaseAdmin
      .from('salary_configs')
      .upsert({
        operator_id: getOperatorId(req),
        staff_id:    staffId,
        base:        Number(base) || 0,
        food:        Number(food) || 0,
        transport:   Number(transport) || 0,
        inps_pct:    inps_pct !== undefined ? Number(inps_pct) : 15,
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'operator_id,staff_id' })
      .select()
      .single();
    if (error) throw error;
    return res.json({ data, message: 'Configuracao salarial actualizada' });
  } catch (err) { next(err); }
}

/* ── Pagamentos de salario ── */

async function listarSalaryPayments(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('salary_payments')
      .select('*, staff(name)')
      .eq('operator_id', getOperatorId(req))
      .order('paid_at', { ascending: false });
    if (error) throw error;
    const mapped = (data || []).map(p => ({
      id: p.id, staffId: p.staff_id, staffName: p.staff?.name, month: p.month, year: p.year, amount: Number(p.amount), paid_at: p.paid_at,
    }));
    return res.json({ data: mapped, message: 'Pagamentos de salario' });
  } catch (err) { next(err); }
}

async function criarSalaryPayment(req, res, next) {
  try {
    const { staffId, month, year, amount } = req.body;
    if (!staffId || !month || !year || amount === undefined) {
      return res.status(400).json({ error: 'staffId, month, year e amount sao obrigatorios', code: 'MISSING_FIELDS' });
    }
    const { data, error } = await supabaseAdmin
      .from('salary_payments')
      .insert({ operator_id: getOperatorId(req), staff_id: staffId, month: Number(month), year: Number(year), amount: Number(amount) })
      .select('*, staff(name)')
      .single();
    if (error) throw error;
    return res.status(201).json({
      data: { id: data.id, staffId: data.staff_id, staffName: data.staff?.name, month: data.month, year: data.year, amount: Number(data.amount), paid_at: data.paid_at },
      message: 'Pagamento registado',
    });
  } catch (err) { next(err); }
}

/* ── Obrigacoes financeiras (config unica por operador) ── */

async function obterObligations(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('operator_obligations')
      .select('data')
      .eq('operator_id', getOperatorId(req))
      .maybeSingle();
    if (error) throw error;
    return res.json({ data: data?.data || {}, message: 'Obrigacoes financeiras' });
  } catch (err) { next(err); }
}

async function actualizarObligations(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('operator_obligations')
      .upsert({ operator_id: getOperatorId(req), data: req.body || {}, updated_at: new Date().toISOString() }, { onConflict: 'operator_id' })
      .select('data')
      .single();
    if (error) throw error;
    return res.json({ data: data.data, message: 'Obrigacoes actualizadas' });
  } catch (err) { next(err); }
}

module.exports = {
  listarDespesas, criarDespesa, actualizarDespesa, eliminarDespesa,
  listarSalaryConfigs, actualizarSalaryConfig,
  listarSalaryPayments, criarSalaryPayment,
  obterObligations, actualizarObligations,
};
