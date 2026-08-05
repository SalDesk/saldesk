const { supabaseAdmin } = require('../config/supabase');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

/* Mapeia entre o nome do campo usado no frontend (date) e a coluna real (occurred_at) */
function toRow(body) {
  const row = {};
  if (body.unit_id !== undefined) row.unit_id = body.unit_id || null;
  if (body.unit_name !== undefined) row.unit_name = body.unit_name || null;
  if (body.staff_id !== undefined) row.staff_id = body.staff_id || null;
  if (body.staff_name !== undefined) row.staff_name = body.staff_name || null;
  if (body.type !== undefined) row.type = body.type;
  if (body.severity !== undefined) row.severity = body.severity;
  if (body.description !== undefined) row.description = body.description;
  if (body.actions_taken !== undefined) row.actions_taken = body.actions_taken || null;
  if (body.photo_urls !== undefined) row.photo_urls = body.photo_urls || null;
  if (body.date !== undefined) row.occurred_at = body.date || new Date().toISOString().slice(0, 10);
  return row;
}

function toApi(row) {
  if (!row) return row;
  const { occurred_at, ...rest } = row;
  return { ...rest, date: occurred_at };
}

async function listar(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('occurrences').select('*').eq('operator_id', getOperatorId(req)).order('occurred_at', { ascending: false });
    if (error) throw error;
    return res.json({ data: (data || []).map(toApi), message: 'Ocorrencias' });
  } catch (err) { next(err); }
}

async function criar(req, res, next) {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: 'Descricao e obrigatoria', code: 'MISSING_FIELDS' });

    const { data, error } = await supabaseAdmin
      .from('occurrences').insert({ operator_id: getOperatorId(req), ...toRow(req.body) }).select().single();
    if (error) throw error;
    return res.status(201).json({ data: toApi(data), message: 'Ocorrencia registada' });
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('occurrences')
      .update({ ...toRow(req.body), updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('operator_id', getOperatorId(req))
      .select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Ocorrencia nao encontrada', code: 'NOT_FOUND' });
    return res.json({ data: toApi(data), message: 'Ocorrencia actualizada' });
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { error } = await supabaseAdmin.from('occurrences').delete().eq('id', req.params.id).eq('operator_id', getOperatorId(req));
    if (error) throw error;
    return res.json({ message: 'Ocorrencia eliminada' });
  } catch (err) { next(err); }
}

module.exports = { listar, criar, actualizar, eliminar };
