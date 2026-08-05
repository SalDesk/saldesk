const { supabaseAdmin } = require('../config/supabase');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

/* Mapeia entre o nome do campo usado no frontend (date) e a coluna real (event_date) */
function toRow(body) {
  const row = {};
  if (body.company !== undefined) row.company = body.company;
  if (body.event_type !== undefined) row.event_type = body.event_type;
  if (body.tour_ids !== undefined) row.tour_ids = body.tour_ids;
  if (body.date !== undefined) row.event_date = body.date || null;
  if (body.guests !== undefined) row.guests = Number(body.guests) || 1;
  if (body.budget !== undefined) row.budget = Number(body.budget) || 0;
  if (body.notes !== undefined) row.notes = body.notes || null;
  if (body.discount_pct !== undefined) row.discount_pct = Number(body.discount_pct) || 0;
  if (body.signal_pct !== undefined) row.signal_pct = Number(body.signal_pct) || 0;
  if (body.days_before !== undefined) row.days_before = Number(body.days_before) || 0;
  if (body.proposal_expires !== undefined) row.proposal_expires = body.proposal_expires || null;
  if (body.status !== undefined) row.status = body.status;
  return row;
}

function toApi(row) {
  if (!row) return row;
  const { event_date, ...rest } = row;
  return { ...rest, date: event_date };
}

async function listar(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('groups').select('*').eq('operator_id', getOperatorId(req)).order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ data: (data || []).map(toApi), message: 'Cotacoes de grupo' });
  } catch (err) { next(err); }
}

async function criar(req, res, next) {
  try {
    const { company, guests } = req.body;
    if (!company || !guests) return res.status(400).json({ error: 'Empresa e numero de pessoas sao obrigatorios', code: 'MISSING_FIELDS' });

    const { data, error } = await supabaseAdmin
      .from('groups').insert({ operator_id: getOperatorId(req), ...toRow(req.body) }).select().single();
    if (error) throw error;
    return res.status(201).json({ data: toApi(data), message: 'Cotacao criada' });
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('groups')
      .update({ ...toRow(req.body), updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('operator_id', getOperatorId(req))
      .select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Cotacao nao encontrada', code: 'NOT_FOUND' });
    return res.json({ data: toApi(data), message: 'Cotacao actualizada' });
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { error } = await supabaseAdmin.from('groups').delete().eq('id', req.params.id).eq('operator_id', getOperatorId(req));
    if (error) throw error;
    return res.json({ message: 'Cotacao eliminada' });
  } catch (err) { next(err); }
}

async function criarPagamento(req, res, next) {
  try {
    const { amount, date, note } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Montante invalido', code: 'INVALID_AMOUNT' });

    const { data: grupo } = await supabaseAdmin
      .from('groups').select('payments').eq('id', req.params.id).eq('operator_id', getOperatorId(req)).maybeSingle();
    if (!grupo) return res.status(404).json({ error: 'Cotacao nao encontrada', code: 'NOT_FOUND' });

    const payments = [...(grupo.payments || []), { amount: Number(amount), date: date || new Date().toISOString().slice(0, 10), note: note || null }];

    const { data, error } = await supabaseAdmin
      .from('groups').update({ payments, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw error;
    return res.status(201).json({ data: toApi(data), message: 'Pagamento registado' });
  } catch (err) { next(err); }
}

module.exports = { listar, criar, actualizar, eliminar, criarPagamento };
