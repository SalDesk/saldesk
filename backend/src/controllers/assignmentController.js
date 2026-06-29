const { supabaseAdmin } = require('../config/supabase');
const { emitToOperator, emitToUser } = require('../services/socketService');
const { notifyStaff, notifyOperator } = require('../services/pushService');

const TRANSITIONS = {
  pending:     ['confirmed','cancelled'],
  confirmed:   ['in_progress','cancelled'],
  in_progress: ['completed','cancelled'],
  completed:   [],
  cancelled:   [],
};

async function listar(req, res, next) {
  try {
    const { status, staff_id, date_from, date_to } = req.query;
    let q = supabaseAdmin
      .from('job_assignments')
      .select('*, staff(name, role, photo_url), reservations(check_in, check_out, customer_name, total_amount, units(name, unit_type))')
      .eq('operator_id', req.operator.id)
      .order('created_at', { ascending: false });
    if (status)    q = q.eq('status', status);
    if (staff_id)  q = q.eq('staff_id', staff_id);
    if (date_from) q = q.gte('created_at', date_from);
    if (date_to)   q = q.lte('created_at', date_to);
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ data, message: 'Atribuicoes listadas' });
  } catch (err) { next(err); }
}

async function criar(req, res, next) {
  try {
    const { reservation_id, staff_id, earnings_amount, notes_manager } = req.body;
    if (!reservation_id || !staff_id) return res.status(400).json({ error: 'reservation_id e staff_id sao obrigatorios', code: 'MISSING_FIELDS' });

    const [resRes, staffRes] = await Promise.all([
      supabaseAdmin.from('reservations').select('id, check_in, check_out, customer_name, units(name)').eq('id', reservation_id).eq('operator_id', req.operator.id).single(),
      supabaseAdmin.from('staff').select('*').eq('id', staff_id).eq('operator_id', req.operator.id).single(),
    ]);
    if (!resRes.data) return res.status(404).json({ error: 'Reserva nao encontrada', code: 'NOT_FOUND' });
    if (!staffRes.data) return res.status(404).json({ error: 'Colaborador nao encontrado', code: 'NOT_FOUND' });

    const { data, error } = await supabaseAdmin
      .from('job_assignments')
      .insert({ reservation_id, staff_id, operator_id: req.operator.id, earnings_amount: earnings_amount || 0, notes_manager: notes_manager || null })
      .select('*, staff(name, role), reservations(check_in, check_out, customer_name, units(name))')
      .single();
    if (error) throw error;

    /* Emitir via Socket.io */
    emitToOperator(req.operator.id, 'assignment:new', data);

    /* Push notification ao colaborador */
    const res_ = resRes.data;
    await notifyStaff(staffRes.data, {
      title: 'Novo trabalho atribuido',
      body:  `${res_.units?.name} — ${res_.customer_name} (${res_.check_in})`,
      tag:   'new_assignment',
      url:   '/staff/jobs',
    });

    return res.status(201).json({ data, message: 'Atribuicao criada' });
  } catch (err) { next(err); }
}

async function mudarStatus(req, res, next) {
  try {
    const { status, notes_staff, notes_manager } = req.body;
    const { data: current } = await supabaseAdmin
      .from('job_assignments').select('*, staff(*)').eq('id', req.params.id).single();
    if (!current) return res.status(404).json({ error: 'Nao encontrada', code: 'NOT_FOUND' });

    const isOwnerOperator = req.operator && current.operator_id === req.operator.id;
    const isOwnerStaff    = req.staff && current.staff_id === req.staff.id;
    if (!isOwnerOperator && !isOwnerStaff) {
      return res.status(403).json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' });
    }

    if (!TRANSITIONS[current.status]?.includes(status)) {
      return res.status(400).json({ error: `Transicao ${current.status} -> ${status} invalida`, code: 'INVALID_TRANSITION' });
    }

    const updates = { status, updated_at: new Date().toISOString() };
    if (notes_staff)   updates.notes_staff   = notes_staff;
    if (notes_manager && isOwnerOperator) updates.notes_manager = notes_manager;
    if (status === 'confirmed')   updates.confirmed_at  = new Date().toISOString();
    if (status === 'in_progress') updates.started_at    = new Date().toISOString();
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
      await supabaseAdmin.from('staff').update({
        total_jobs_completed: (current.staff?.total_jobs_completed || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', current.staff_id);
    }

    const { data, error } = await supabaseAdmin
      .from('job_assignments').update(updates).eq('id', req.params.id).select('*, staff(name, role), reservations(check_in, check_out, customer_name, units(name))').single();
    if (error) throw error;

    emitToOperator(current.operator_id, 'assignment:updated', data);
    return res.json({ data, message: `Estado actualizado para ${status}` });
  } catch (err) { next(err); }
}

async function criarComposta(req, res, next) {
  try {
    const { reservation_id, vehicle_id, guide_id, driver_id } = req.body;
    if (!reservation_id || !vehicle_id || !guide_id || !driver_id) {
      return res.status(400).json({ error: 'reservation_id, vehicle_id, guide_id e driver_id sao obrigatorios', code: 'MISSING_FIELDS' });
    }

    const isCombined = guide_id === driver_id;
    const rows = [];

    if (isCombined) {
      rows.push({
        reservation_id, vehicle_id,
        staff_id: guide_id,
        operator_id: req.operator.id,
        role: 'guide',
        role_combined: true,
        status: 'pending',
      });
    } else {
      rows.push({
        reservation_id, vehicle_id,
        staff_id: guide_id,
        operator_id: req.operator.id,
        role: 'guide',
        role_combined: false,
        status: 'pending',
      });
      rows.push({
        reservation_id, vehicle_id,
        staff_id: driver_id,
        operator_id: req.operator.id,
        role: 'driver',
        role_combined: false,
        status: 'pending',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('job_assignments')
      .insert(rows)
      .select('*, staff(name, role), reservations(check_in, check_out, customer_name, units(name)), fleet(name, type)');
    if (error) throw error;
    return res.status(201).json({ data, message: 'Atribuicao criada' });
  } catch (err) { next(err); }
}

async function actualizarNotas(req, res, next) {
  try {
    const { notes_staff } = req.body;
    if (!notes_staff) return res.status(400).json({ error: 'notes_staff e obrigatorio', code: 'MISSING_FIELDS' });

    const { data: current } = await supabaseAdmin
      .from('job_assignments').select('staff_id, operator_id').eq('id', req.params.id).single();
    if (!current) return res.status(404).json({ error: 'Nao encontrada', code: 'NOT_FOUND' });

    const isOwnerOperator = req.operator && current.operator_id === req.operator.id;
    const isOwnerStaff    = req.staff && current.staff_id === req.staff.id;
    if (!isOwnerOperator && !isOwnerStaff) {
      return res.status(403).json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' });
    }

    const { data, error } = await supabaseAdmin
      .from('job_assignments')
      .update({ notes_staff, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    return res.json({ data, message: 'Nota guardada' });
  } catch (err) { next(err); }
}

async function getAvailableStaff(req, res, next) {
  try {
    const { date } = req.query;
    const { data: allStaff } = await supabaseAdmin
      .from('staff').select('id, name, role, photo_url, average_rating')
      .eq('operator_id', req.operator.id).eq('status', 'active');

    if (!date) return res.json({ data: allStaff || [], message: 'Staff listado' });

    const { data: unavailable } = await supabaseAdmin
      .from('staff_availability').select('staff_id').eq('operator_id', req.operator.id).eq('date', date).eq('is_available', false);

    const unavailableIds = new Set((unavailable || []).map((u) => u.staff_id));
    const available = (allStaff || []).filter((s) => !unavailableIds.has(s.id));
    return res.json({ data: available, message: 'Staff disponivel' });
  } catch (err) { next(err); }
}

module.exports = { listar, criar, criarComposta, mudarStatus, actualizarNotas, getAvailableStaff };
