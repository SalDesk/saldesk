const { supabaseAdmin } = require('../config/supabase');
const { dispararSyncImediato } = require('../helpers/otaSyncHelper');

async function getCalendar(req, res, next) {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'Parâmetros start e end são obrigatórios', code: 'MISSING_FIELDS' });
    }

    // Obter IDs das unidades do operador para filtrar blocked_dates
    const { data: unidades } = await supabaseAdmin
      .from('units')
      .select('id, name, unit_type')
      .eq('operator_id', req.operator.id)
      .eq('status', 'active')
      .order('name');

    const unitIds = (unidades || []).map((u) => u.id);

    const [reservasRes, bloqueiosRes] = await Promise.all([
      supabaseAdmin
        .from('reservations')
        .select('id, unit_id, customer_name, check_in, check_out, status, guests')
        .eq('operator_id', req.operator.id)
        .neq('status', 'cancelled')
        .lte('check_in', end)
        .gt('check_out', start)
        .order('check_in'),

      unitIds.length > 0
        ? supabaseAdmin
            .from('blocked_dates')
            .select('id, unit_id, date, reason')
            .in('unit_id', unitIds)
            .gte('date', start)
            .lte('date', end)
        : Promise.resolve({ data: [] })
    ]);

    return res.json({
      data: {
        units: unidades || [],
        reservations: reservasRes.data || [],
        blocked_dates: bloqueiosRes.data || []
      },
      message: 'Calendário carregado'
    });
  } catch (err) {
    next(err);
  }
}

async function criarBloqueio(req, res, next) {
  try {
    const { unit_id, dates, reason } = req.body;

    if (!unit_id || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'unit_id e dates[] são obrigatórios', code: 'MISSING_FIELDS' });
    }

    const { data: unit } = await supabaseAdmin
      .from('units')
      .select('id')
      .eq('id', unit_id)
      .eq('operator_id', req.operator.id)
      .single();

    if (!unit) {
      return res.status(404).json({ error: 'Unidade não encontrada', code: 'NOT_FOUND' });
    }

    const rows = dates.map((date) => ({ unit_id, date, reason: reason || null }));

    const { data, error } = await supabaseAdmin
      .from('blocked_dates')
      .upsert(rows, { onConflict: 'unit_id,date' })
      .select();

    if (error) throw error;

    dispararSyncImediato(req.operator.id);

    return res.status(201).json({ data, message: `${data.length} data(s) bloqueada(s)` });
  } catch (err) {
    next(err);
  }
}

async function eliminarBloqueio(req, res, next) {
  try {
    /* blocked_dates nao tem operator_id proprio -- sem este join, qualquer
       operador autenticado conseguia apagar o bloqueio de outro operador
       só por adivinhar/conhecer o id (sem isolamento nenhum). */
    const { data: bloqueio } = await supabaseAdmin
      .from('blocked_dates')
      .select('id, units!inner(operator_id)')
      .eq('id', req.params.id)
      .eq('units.operator_id', req.operator.id)
      .maybeSingle();

    if (!bloqueio) {
      return res.status(404).json({ error: 'Bloqueio não encontrado', code: 'NOT_FOUND' });
    }

    const { error } = await supabaseAdmin
      .from('blocked_dates')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    dispararSyncImediato(req.operator.id);

    return res.json({ data: null, message: 'Bloqueio removido' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCalendar, criarBloqueio, eliminarBloqueio };
