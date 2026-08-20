const { supabaseAdmin } = require('../config/supabase');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

const TRANSICOES = {
  received:  ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready:     ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

async function listar(req, res, next) {
  try {
    const { status, unit_id, date } = req.query;
    let q = supabaseAdmin
      .from('orders')
      .select('*, units(name, description), order_items(*), reservations(check_in, start_time, party_size:guests)')
      .eq('operator_id', getOperatorId(req))
      .order('created_at', { ascending: false })
      .limit(200);
    if (status)  q = q.eq('status', status);
    if (unit_id) q = q.eq('unit_id', unit_id);
    if (date) {
      q = q.gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ data, message: 'Pedidos listados' });
  } catch (err) { next(err); }
}

async function mudarStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!Object.keys(TRANSICOES).includes(status)) {
      return res.status(400).json({ error: 'Status inválido', code: 'INVALID_STATUS' });
    }

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('status')
      .eq('id', req.params.id)
      .eq('operator_id', getOperatorId(req))
      .single();
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado', code: 'NOT_FOUND' });

    if (!TRANSICOES[order.status].includes(status)) {
      return res.status(400).json({ error: `Transição de "${order.status}" para "${status}" não permitida`, code: 'INVALID_TRANSITION' });
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('operator_id', getOperatorId(req))
      .select('*, units(name, description), order_items(*), reservations(check_in, start_time, party_size:guests)')
      .single();
    if (error) throw error;

    return res.json({ data, message: `Status actualizado para "${status}"` });
  } catch (err) { next(err); }
}

module.exports = { listar, mudarStatus };
