const { supabaseAdmin } = require('../config/supabase');

const TRIGGERS_VALIDOS = [
  'booking_confirmed', 'checkin_reminder', 'checkout_thanks',
  'days_before_checkin', 'days_after_checkout'
];
const TRIGGERS_COM_DIAS = ['days_before_checkin', 'days_after_checkout'];

async function listar(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('automations')
      .select('*')
      .eq('operator_id', req.operator.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({ data, message: 'Automações listadas' });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const { name, trigger_type, trigger_days, channel, subject, message_pt, message_en } = req.body;

    if (!name || !trigger_type || !channel || !message_pt || !message_en) {
      return res.status(400).json({ error: 'Campos obrigatórios em falta', code: 'MISSING_FIELDS' });
    }
    if (!TRIGGERS_VALIDOS.includes(trigger_type)) {
      return res.status(400).json({ error: 'Tipo de trigger inválido', code: 'INVALID_TRIGGER' });
    }
    if (TRIGGERS_COM_DIAS.includes(trigger_type) && !trigger_days) {
      return res.status(400).json({ error: 'trigger_days é obrigatório para este tipo', code: 'MISSING_TRIGGER_DAYS' });
    }
    if (channel === 'email' && !subject) {
      return res.status(400).json({ error: 'subject é obrigatório para canal email', code: 'MISSING_SUBJECT' });
    }

    const { data, error } = await supabaseAdmin
      .from('automations')
      .insert({
        operator_id: req.operator.id,
        name,
        trigger_type,
        trigger_days: trigger_days || null,
        channel,
        subject: subject || null,
        message_pt,
        message_en,
        active: true
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ data, message: 'Automação criada com sucesso' });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { name, trigger_days, channel, subject, message_pt, message_en, active } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (trigger_days !== undefined) updates.trigger_days = trigger_days;
    if (channel !== undefined) updates.channel = channel;
    if (subject !== undefined) updates.subject = subject;
    if (message_pt !== undefined) updates.message_pt = message_pt;
    if (message_en !== undefined) updates.message_en = message_en;
    if (active !== undefined) updates.active = active;

    const { data, error } = await supabaseAdmin
      .from('automations')
      .update(updates)
      .eq('id', req.params.id)
      .eq('operator_id', req.operator.id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Automação não encontrada', code: 'NOT_FOUND' });
    }

    return res.json({ data, message: 'Automação actualizada' });
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const { error } = await supabaseAdmin
      .from('automations')
      .delete()
      .eq('id', req.params.id)
      .eq('operator_id', req.operator.id);

    if (error) throw error;

    return res.json({ data: null, message: 'Automação eliminada' });
  } catch (err) {
    next(err);
  }
}

async function getLogs(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('automation_logs')
      .select('*, reservations(customer_name, customer_email, check_in, check_out)')
      .eq('automation_id', req.params.id)
      .order('sent_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return res.json({ data, message: 'Logs listados' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, criar, actualizar, eliminar, getLogs };
