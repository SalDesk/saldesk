const { supabaseAdmin } = require('../config/supabase');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

function toRow(body) {
  const row = {};
  if (body.name !== undefined) row.name = body.name;
  if (body.partner_type !== undefined) row.partner_type = body.partner_type;
  if (body.partnership_type !== undefined) row.partnership_type = body.partnership_type;
  if (body.commission_pct !== undefined) row.commission_pct = Number(body.commission_pct) || 0;
  if (body.message_pt !== undefined) row.message_pt = body.message_pt || null;
  if (body.message_en !== undefined) row.message_en = body.message_en || null;
  if (body.active !== undefined) row.active = body.active;
  return row;
}

async function listar(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('partners').select('*').eq('operator_id', getOperatorId(req)).order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ data: data || [], message: 'Parceiros' });
  } catch (err) { next(err); }
}

async function criar(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome e obrigatorio', code: 'MISSING_FIELDS' });

    const { data, error } = await supabaseAdmin
      .from('partners').insert({ operator_id: getOperatorId(req), ...toRow(req.body) }).select().single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Parceiro criado' });
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('partners')
      .update({ ...toRow(req.body), updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('operator_id', getOperatorId(req))
      .select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Parceiro nao encontrado', code: 'NOT_FOUND' });
    return res.json({ data, message: 'Parceiro actualizado' });
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { error } = await supabaseAdmin.from('partners').delete().eq('id', req.params.id).eq('operator_id', getOperatorId(req));
    if (error) throw error;
    return res.json({ message: 'Parceiro eliminado' });
  } catch (err) { next(err); }
}

async function registarReserva(req, res, next) {
  try {
    const { direction, delta } = req.body;
    if (!['sent', 'received'].includes(direction)) return res.status(400).json({ error: 'Direccao invalida', code: 'INVALID_DIRECTION' });
    const inc = Number(delta) || 1;

    const { data: parceiro } = await supabaseAdmin
      .from('partners').select('bookings_sent, bookings_received').eq('id', req.params.id).eq('operator_id', getOperatorId(req)).maybeSingle();
    if (!parceiro) return res.status(404).json({ error: 'Parceiro nao encontrado', code: 'NOT_FOUND' });

    const updates = direction === 'sent'
      ? { bookings_sent: parceiro.bookings_sent + inc }
      : { bookings_received: parceiro.bookings_received + inc };

    const { data, error } = await supabaseAdmin
      .from('partners').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw error;
    return res.json({ data, message: 'Reservas registadas' });
  } catch (err) { next(err); }
}

module.exports = { listar, criar, actualizar, eliminar, registarReserva };
