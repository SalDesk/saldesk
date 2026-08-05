const { supabaseAdmin } = require('../config/supabase');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

/* Mapeia entre o nome do campo usado no frontend (limit) e a coluna real (sales_limit) */
function toRow(body) {
  const row = {};
  if (body.name_pt !== undefined) row.name_pt = body.name_pt;
  if (body.name_en !== undefined) row.name_en = body.name_en || null;
  if (body.description_pt !== undefined) row.description_pt = body.description_pt || null;
  if (body.description_en !== undefined) row.description_en = body.description_en || null;
  if (body.tour_ids !== undefined) row.tour_ids = body.tour_ids;
  if (body.valid_from !== undefined) row.valid_from = body.valid_from || null;
  if (body.valid_to !== undefined) row.valid_to = body.valid_to || null;
  if (body.price !== undefined) row.price = Number(body.price) || 0;
  if (body.original_price !== undefined) row.original_price = Number(body.original_price) || 0;
  if (body.limit !== undefined) row.sales_limit = Number(body.limit) || 0;
  if (body.photo_url !== undefined) row.photo_url = body.photo_url || null;
  if (body.status !== undefined) row.status = body.status;
  return row;
}

function toApi(row) {
  if (!row) return row;
  const { sales_limit, ...rest } = row;
  return { ...rest, limit: sales_limit };
}

async function listar(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('packages').select('*').eq('operator_id', getOperatorId(req)).order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ data: (data || []).map(toApi), message: 'Pacotes' });
  } catch (err) { next(err); }
}

async function criar(req, res, next) {
  try {
    const { name_pt, price } = req.body;
    if (!name_pt || price === undefined) return res.status(400).json({ error: 'Nome e preco sao obrigatorios', code: 'MISSING_FIELDS' });

    const { data, error } = await supabaseAdmin
      .from('packages').insert({ operator_id: getOperatorId(req), ...toRow(req.body) }).select().single();
    if (error) throw error;
    return res.status(201).json({ data: toApi(data), message: 'Pacote criado' });
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('packages')
      .update({ ...toRow(req.body), updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('operator_id', getOperatorId(req))
      .select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Pacote nao encontrado', code: 'NOT_FOUND' });
    return res.json({ data: toApi(data), message: 'Pacote actualizado' });
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { error } = await supabaseAdmin.from('packages').delete().eq('id', req.params.id).eq('operator_id', getOperatorId(req));
    if (error) throw error;
    return res.json({ message: 'Pacote eliminado' });
  } catch (err) { next(err); }
}

module.exports = { listar, criar, actualizar, eliminar };
