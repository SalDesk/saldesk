const { supabaseAdmin } = require('../config/supabase');
const { detectarIdioma } = require('../helpers/languageHelper');

async function listar(req, res, next) {
  try {
    const { search, country_code } = req.query;

    let q = supabaseAdmin
      .from('customers')
      .select('*')
      .eq('operator_id', req.operator.id)
      .order('total_spent', { ascending: false });

    if (search) {
      q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (country_code) {
      q = q.eq('country_code', country_code.toUpperCase());
    }

    const { data, error } = await q;
    if (error) throw error;

    return res.json({ data, message: 'Clientes listados' });
  } catch (err) {
    next(err);
  }
}

async function obter(req, res, next) {
  try {
    const [clienteRes, reservasRes] = await Promise.all([
      supabaseAdmin
        .from('customers')
        .select('*')
        .eq('id', req.params.id)
        .eq('operator_id', req.operator.id)
        .single(),

      supabaseAdmin
        .from('reservations')
        .select('id, check_in, check_out, total_price, status, units(name, unit_type)')
        .eq('customer_id', req.params.id)
        .order('check_in', { ascending: false })
    ]);

    if (!clienteRes.data) {
      return res.status(404).json({ error: 'Cliente não encontrado', code: 'NOT_FOUND' });
    }

    return res.json({
      data: { ...clienteRes.data, reservations: reservasRes.data || [] },
      message: 'Cliente encontrado'
    });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { name, phone, country_code, notes } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (country_code !== undefined) {
      updates.country_code = country_code.toUpperCase();
      updates.language = detectarIdioma(country_code);
    }
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabaseAdmin
      .from('customers')
      .update(updates)
      .eq('id', req.params.id)
      .eq('operator_id', req.operator.id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Cliente não encontrado', code: 'NOT_FOUND' });
    }

    return res.json({ data, message: 'Cliente actualizado' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obter, actualizar };
