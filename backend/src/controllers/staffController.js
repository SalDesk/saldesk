const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { enviarEmail } = require('../helpers/emailHelper');
const { staffInviteEmail } = require('../helpers/emailTemplates');

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
      supabaseAdmin.from('job_assignments').select('*, reservations(check_in, check_out, customer_name, units(name)), fleet(name, type)').eq('staff_id', req.params.id).order('created_at', { ascending: false }).limit(20),
    ]);
    if (!staffRes.data) return res.status(404).json({ error: 'Colaborador nao encontrado', code: 'NOT_FOUND' });
    return res.json({ data: { ...staffRes.data, jobs: jobsRes.data || [] }, message: 'Colaborador encontrado' });
  } catch (err) { next(err); }
}

async function criar(req, res, next) {
  try {
    const {
      name, role, phone, email, whatsapp,
      photo_url, skills, schedule, commission_pct, seller_zone, seller_tour_ids,
    } = req.body;
    if (!name || !role) return res.status(400).json({ error: 'Nome e cargo sao obrigatorios', code: 'MISSING_FIELDS' });
    const { data, error } = await supabaseAdmin
      .from('staff')
      .insert({
        operator_id: req.operator.id, name, role,
        phone: phone || null, email: email || null, whatsapp: whatsapp || null,
        photo_url: photo_url || null,
        skills: skills || [],
        schedule: schedule || [],
        commission_pct: commission_pct ?? null,
        seller_zone: seller_zone || null,
        seller_tour_ids: seller_tour_ids || [],
      })
      .select().single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Colaborador criado' });
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const {
      name, role, phone, email, whatsapp, status,
      photo_url, skills, schedule, commission_pct, seller_zone, seller_tour_ids,
    } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined)            updates.name = name;
    if (role !== undefined)            updates.role = role;
    if (phone !== undefined)           updates.phone = phone;
    if (email !== undefined)           updates.email = email;
    if (whatsapp !== undefined)        updates.whatsapp = whatsapp;
    if (status !== undefined)          updates.status = status;
    if (photo_url !== undefined)       updates.photo_url = photo_url;
    if (skills !== undefined)          updates.skills = skills;
    if (schedule !== undefined)        updates.schedule = schedule;
    if (commission_pct !== undefined)  updates.commission_pct = commission_pct;
    if (seller_zone !== undefined)     updates.seller_zone = seller_zone;
    if (seller_tour_ids !== undefined) updates.seller_tour_ids = seller_tour_ids;
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
    if (req.staff && req.staff.id !== req.params.id) {
      return res.status(403).json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' });
    }
    let q = supabaseAdmin
      .from('job_assignments')
      .select('*, reservations(check_in, check_out, customer_name, total_amount, units(name, unit_type)), fleet(name, type)')
      .eq('staff_id', req.params.id)
      .order('created_at', { ascending: false });
    if (req.operator) q = q.eq('operator_id', req.operator.id);
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ data, message: 'Trabalhos listados' });
  } catch (err) { next(err); }
}

async function getEarnings(req, res, next) {
  try {
    if (req.staff && req.staff.id !== req.params.id) {
      return res.status(403).json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' });
    }
    let q = supabaseAdmin
      .from('job_assignments')
      .select('earnings_amount, earnings_paid, completed_at')
      .eq('staff_id', req.params.id)
      .eq('status', 'completed');
    if (req.operator) q = q.eq('operator_id', req.operator.id);
    const { data, error } = await q;
    if (error) throw error;
    const total = (data || []).reduce((s, j) => s + Number(j.earnings_amount), 0);
    const paid  = (data || []).filter((j) => j.earnings_paid).reduce((s, j) => s + Number(j.earnings_amount), 0);
    return res.json({ data: { total, paid, pending: total - paid, jobs: data || [] }, message: 'Ganhos calculados' });
  } catch (err) { next(err); }
}

async function setAvailability(req, res, next) {
  try {
    if (req.staff && req.staff.id !== req.params.id) {
      return res.status(403).json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' });
    }
    const { dates } = req.body;
    if (!Array.isArray(dates)) return res.status(400).json({ error: 'dates[] obrigatorio', code: 'MISSING_FIELDS' });
    const operatorId = req.operator?.id || req.staff?.operator_id;
    const rows = dates.map((d) => ({
      staff_id: req.params.id, operator_id: operatorId,
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

async function createAccount(req, res, next) {
  try {
    const { data: staff, error } = await supabaseAdmin
      .from('staff').select('*').eq('id', req.params.id).eq('operator_id', req.operator.id).single();
    if (error || !staff) return res.status(404).json({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' });
    if (!staff.email) return res.status(400).json({ error: 'Colaborador precisa de email para criar conta', code: 'MISSING_EMAIL' });
    if (staff.user_id) return res.status(400).json({ error: 'Conta já existe para este colaborador', code: 'ACCOUNT_EXISTS' });

    const tempPassword = crypto.randomBytes(18).toString('base64url');

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: staff.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        role: 'STAFF',
        staff_id: staff.id,
        operator_id: req.operator.id,
        name: staff.name,
        staff_role: staff.role,
      },
    });
    if (createErr) {
      if (createErr.message?.includes('already registered')) {
        return res.status(409).json({ error: 'Este email já está registado na SalDesk', code: 'EMAIL_EXISTS' });
      }
      throw createErr;
    }

    await supabaseAdmin.from('staff')
      .update({ user_id: created.user.id, updated_at: new Date().toISOString() })
      .eq('id', staff.id);

    const { data: link } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: staff.email,
      options: { redirectTo: 'https://app.saldesk.cv/reset-password' },
    });

    const { subject, html, text } = staffInviteEmail({
      name: staff.name,
      operatorName: req.operator.business_name || req.operator.name,
      link: link?.properties?.action_link,
    });
    await enviarEmail({ to: staff.email, subject, html, text });

    return res.status(201).json({ data: { user_id: created.user.id }, message: 'Conta criada e email enviado' });
  } catch (err) { next(err); }
}

async function obterPerfilProprio(req, res, next) {
  try {
    if (!req.staff) {
      return res.status(403).json({ error: 'Apenas colaboradores podem ver o proprio perfil', code: 'STAFF_ONLY' });
    }
    return res.json({ data: req.staff, message: 'Perfil encontrado' });
  } catch (err) { next(err); }
}

async function actualizarPerfilProprio(req, res, next) {
  try {
    if (!req.staff) {
      return res.status(403).json({ error: 'Apenas colaboradores podem editar o proprio perfil', code: 'STAFF_ONLY' });
    }
    const { phone, whatsapp, photo_url } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (phone !== undefined)     updates.phone = phone;
    if (whatsapp !== undefined)  updates.whatsapp = whatsapp;
    if (photo_url !== undefined) updates.photo_url = photo_url;
    const { data, error } = await supabaseAdmin
      .from('staff')
      .update(updates)
      .eq('id', req.staff.id)
      .select()
      .single();
    if (error || !data) return res.status(404).json({ error: 'Nao encontrado', code: 'NOT_FOUND' });
    return res.json({ data, message: 'Perfil actualizado' });
  } catch (err) { next(err); }
}

module.exports = { listar, obter, criar, actualizar, eliminar, getJobs, getEarnings, setAvailability, savePushSubscription, createAccount, obterPerfilProprio, actualizarPerfilProprio };
