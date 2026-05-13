const { supabaseAdmin } = require('../config/supabase');

async function listar(req, res, next) {
  try {
    const { status, type } = req.query;
    let q = supabaseAdmin.from('fleet').select('*').eq('operator_id', req.operator.id).order('name');
    if (status) q = q.eq('status', status);
    if (type)   q = q.eq('type', type);
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ data, message: 'Frota listada' });
  } catch (err) { next(err); }
}

async function disponivel(req, res, next) {
  try {
    const { date } = req.query;
    let q = supabaseAdmin.from('fleet').select('*').eq('operator_id', req.operator.id).eq('status', 'available');
    if (date) {
      const { data: emUso } = await supabaseAdmin
        .from('fleet_assignments').select('fleet_id')
        .is('returned_at', null).lte('assigned_at', date);
      const idsEmUso = (emUso || []).map((a) => a.fleet_id);
      if (idsEmUso.length) q = q.not('id', 'in', `(${idsEmUso.join(',')})`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ data, message: 'Frota disponivel' });
  } catch (err) { next(err); }
}

async function criar(req, res, next) {
  try {
    const { name, type, description, notes, next_maintenance_at } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Nome e tipo sao obrigatorios', code: 'MISSING_FIELDS' });
    const { data, error } = await supabaseAdmin
      .from('fleet')
      .insert({ operator_id: req.operator.id, name, type, description: description || null, notes: notes || null, next_maintenance_at: next_maintenance_at || null })
      .select().single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Item de frota criado' });
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { name, type, description, status, notes, last_maintenance_at, next_maintenance_at } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined)                updates.name = name;
    if (type !== undefined)                updates.type = type;
    if (description !== undefined)         updates.description = description;
    if (status !== undefined)              updates.status = status;
    if (notes !== undefined)               updates.notes = notes;
    if (last_maintenance_at !== undefined) updates.last_maintenance_at = last_maintenance_at;
    if (next_maintenance_at !== undefined) updates.next_maintenance_at = next_maintenance_at;
    const { data, error } = await supabaseAdmin
      .from('fleet').update(updates).eq('id', req.params.id).eq('operator_id', req.operator.id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Nao encontrado', code: 'NOT_FOUND' });
    return res.json({ data, message: 'Item actualizado' });
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { error } = await supabaseAdmin.from('fleet').delete().eq('id', req.params.id).eq('operator_id', req.operator.id);
    if (error) throw error;
    return res.json({ data: null, message: 'Item eliminado' });
  } catch (err) { next(err); }
}

async function atribuir(req, res, next) {
  try {
    const { reservation_id, staff_id } = req.body;
    if (!reservation_id) return res.status(400).json({ error: 'reservation_id obrigatorio', code: 'MISSING_FIELDS' });
    await supabaseAdmin.from('fleet').update({ status: 'in_use', updated_at: new Date().toISOString() }).eq('id', req.params.id);
    const { data, error } = await supabaseAdmin
      .from('fleet_assignments').insert({ fleet_id: req.params.id, reservation_id, staff_id: staff_id || null }).select().single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Atribuido com sucesso' });
  } catch (err) { next(err); }
}

async function devolver(req, res, next) {
  try {
    const { notes } = req.body;
    await supabaseAdmin
      .from('fleet_assignments').update({ returned_at: new Date().toISOString(), notes: notes || null })
      .eq('fleet_id', req.params.id).is('returned_at', null);
    await supabaseAdmin.from('fleet').update({ status: 'available', updated_at: new Date().toISOString() }).eq('id', req.params.id);
    return res.json({ data: null, message: 'Devolvido com sucesso' });
  } catch (err) { next(err); }
}

module.exports = { listar, disponivel, criar, actualizar, eliminar, atribuir, devolver };
