const { supabaseAdmin } = require('../config/supabase');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

/* Lista comissoes — operador ve as de todos os vendedores, vendedor so as suas */
async function listar(req, res, next) {
  try {
    const { seller_id, status, month } = req.query;

    let q = supabaseAdmin
      .from('seller_commissions')
      .select('*, staff(name), reservations(check_in, customer_name, total_price, units(name))')
      .eq('operator_id', getOperatorId(req))
      .order('created_at', { ascending: false });

    // Vendedor so pode ver as suas proprias comissoes
    if (req.staff && !req.operator) {
      q = q.eq('seller_id', req.staff.id);
    } else if (seller_id) {
      q = q.eq('seller_id', seller_id);
    }

    if (status) q = q.eq('status', status);
    if (month) {
      const [ano, mes] = month.split('-');
      const inicio = `${ano}-${mes}-01`;
      const fimDate = new Date(Number(ano), Number(mes), 0).getDate();
      const fim = `${ano}-${mes}-${String(fimDate).padStart(2, '0')}`;
      q = q.gte('created_at', inicio).lte('created_at', `${fim}T23:59:59`);
    }

    const { data, error } = await q;
    if (error) throw error;

    return res.json({ data: data || [], message: 'Comissoes listadas' });
  } catch (err) {
    next(err);
  }
}

/* Marca uma comissao como paga — so o operador pode fazer isto */
async function marcarPaga(req, res, next) {
  try {
    if (!req.operator) {
      return res.status(403).json({ error: 'Apenas o operador pode marcar comissoes como pagas', code: 'FORBIDDEN' });
    }

    const { status, notes } = req.body;
    const updates = { status: status || 'paid', paid_at: new Date().toISOString() };
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabaseAdmin
      .from('seller_commissions')
      .update(updates)
      .eq('id', req.params.id)
      .eq('operator_id', req.operator.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Comissao nao encontrada', code: 'NOT_FOUND' });
    }

    return res.json({ data, message: 'Comissao marcada como paga' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, marcarPaga };
