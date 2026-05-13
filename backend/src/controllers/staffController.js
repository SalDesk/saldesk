const { supabaseAdmin } = require('../config/supabase');

async function listar(req, res, next) {
  try {
    const { status } = req.query;
    let q = supabaseAdmin
      .from('staff')
      .select('*')
      .eq('operator_id', req.operator.id)
      .order('name');
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ data, message: 'Colaboradores listados' });
  } catch (err) { next(err); }
}

async function obter(req, res, next) {
  try {
    const [staffRes, jobsRes] = await Promise.all([
      supabaseAdmin.from('staff').select('*').eq('id', req.params.id).eq('operator_id', req.operator.id).single(),
      supabaseAdmin.from('job_assignments').select('*, reservations(check_in, check_out, customer_name, units(name))').eq('staff_id', req.params.id).order('created_at', { ascending: false }).limit(20),
    ]);
    if (!staffRes.data) return res.status(404).json({ error: 'Colaborador nao encontrado', code: 'NOT_FOUND' });
    return res.json({ data: { ...staffRes.data, jobs: jobsRes.data || [] }, message: 'Colaborador encontrado' });
  } catch (err) { next(err); }
}

async function criar(req, res, next) {
  try {
    const { name, role, phone, email, whatsapp } = req.body;
    if (!name || !role) return res.status(400).json({ error: 'Nome e cargo sao obrigatorios', code: 'MISSING_FIELDS' });
    const { data, error } = await supabaseAdmin
      .from('staff')
      .insert({ operator_id: req.operator.id, name, role, phone: phone || null, email: email || null, whatsapp: whatsapp || null })
      .select().single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Colaborador criado' });
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { name, role, phone, email, whatsapp, status } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined)    updates.name = name;
    if (role !== undefined)    updates.role = role;
    if (phone !== undefined)   updates.phone = phone;
    if (email !== undefined)   updates.email = email;
    if (whatsapp !== undefined) updates.whatsapp = whatsapp;
    if (status !== undefined)  updates.status = status;
    const { data, error } = await supabaseAdmin
      .from('staff').update(updates).eq('id', req.params.id).eq('operator_id', req.operator.id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Nao encontrado', code: 'NOT_FOUND' });
    return res.json({ data, message: 'Colaborador actualizado' });
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { error } = await supabaseAdmin.from('staff').delete().eq('id', req.params.id).eq('operator_id', req.operator.id);
    if (error) throw error;
    return res.json({ data: null, message: 'Colaborador eliminado' });
  } catch (err) { next(err); }
}

async function getJobs(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('job_assignments')
      .select('*, reservations(check_in, check_out, customer_name, total_amount, units(name, unit_type))')
      .eq('staff_id', req.params.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ data, message: 'Trabalhos listados' });
  } catch (err) { next(err); }
}

async function getEarnings(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('job_assignments')
      .select('earnings_amount, earnings_paid, completed_at')
      .eq('staff_id', req.params.id)
      .eq('status', 'completed');
    if (error) throw error;
    const total = (data || []).reduce((s, j) => s + Number(j.earnings_amount), 0);
    const paid  = (data || []).filter((j) => j.earnings_paid).reduce((s, j) => s + Number(j.earnings_amount), 0);
    return res.json({ data: { total, paid, pending: total - paid, jobs: data || [] }, message: 'Ganhos calculados' });
  } catch (err) { next(err); }
}

async function setAvailability(req, res, next) {
  try {
    const { dates } = req.body;
    if (!Array.isArray(dates)) return res.status(400).json({ error: 'dates[] obrigatorio', code: 'MISSING_FIELDS' });
    const rows = dates.map((d) => ({
      staff_id: req.params.id, operator_id: req.operator.id,
      date: d.date, is_available: d.is_available ?? true, notes: d.notes || null,
    }));
    const { data, error } = await supabaseAdmin
      .from('staff_availability').upsert(rows, { onConflict: 'staff_id,date' }).select();
    if (error) throw error;
    return res.json({ data, message: 'Disponibilidade actualizada' });
  } catch (err) { next(err); }
}

async function savePushSubscription(req, res, next) {
  try {
    const { subscription } = req.body;
    await supabaseAdmin.from('staff').update({ push_subscription: subscription }).eq('id', req.params.id).eq('operator_id', req.operator.id);
    return res.json({ data: null, message: 'Subscricao push guardada' });
  } catch (err) { next(err); }
}

module.exports = { listar, obter, criar, actualizar, eliminar, getJobs, getEarnings, setAvailability, savePushSubscription };
