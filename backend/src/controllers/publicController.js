const { supabaseAdmin } = require('../config/supabase');
const { verificarDisponibilidade, calcularPreco } = require('../helpers/bookingHelpers');
const { obterOuCriarCliente } = require('../helpers/customerHelper');
const { enviarEmail } = require('../helpers/emailHelper');
const { detectarIdioma } = require('../helpers/languageHelper');

async function getOperador(req, res, next) {
  try {
    const { data: operator, error } = await supabaseAdmin
      .from('operators')
      .select('id, name, slug, operator_type, email, phone, address, logo_url')
      .eq('slug', req.params.slug)
      .eq('onboarding_complete', true)
      .single();

    if (error || !operator) {
      return res.status(404).json({ error: 'Página não encontrada', code: 'NOT_FOUND' });
    }

    const { data: units } = await supabaseAdmin
      .from('units')
      .select('id, name, description, unit_type, base_price, capacity, images, pricing_rules(*)')
      .eq('operator_id', operator.id)
      .eq('status', 'active')
      .order('name');

    return res.json({
      data: { operator, units: units || [] },
      message: 'Operador encontrado'
    });
  } catch (err) {
    next(err);
  }
}

async function verificarDisponibilidadePublica(req, res, next) {
  try {
    const { unitId, checkIn, checkOut } = req.query;

    if (!unitId || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'unitId, checkIn e checkOut são obrigatórios', code: 'MISSING_FIELDS' });
    }
    if (checkOut <= checkIn) {
      return res.status(400).json({ error: 'Checkout deve ser posterior ao check-in', code: 'INVALID_DATES' });
    }

    const { data: unit } = await supabaseAdmin
      .from('units')
      .select('*, pricing_rules(*)')
      .eq('id', unitId)
      .eq('status', 'active')
      .single();

    if (!unit) {
      return res.status(404).json({ error: 'Unidade não encontrada', code: 'NOT_FOUND' });
    }

    const disponivel = await verificarDisponibilidade(supabaseAdmin, unitId, checkIn, checkOut);
    const { total, dias } = calcularPreco(unit, checkIn, checkOut);

    return res.json({
      data: { disponivel, total_price: total, dias },
      message: disponivel ? 'Disponível' : 'Indisponível'
    });
  } catch (err) {
    next(err);
  }
}

async function criarReserva(req, res, next) {
  try {
    const { unit_id, customer_name, customer_email, customer_phone,
            customer_country, check_in, check_out, guests, notes } = req.body;

    if (!unit_id || !customer_name || !customer_email || !check_in || !check_out) {
      return res.status(400).json({ error: 'Campos obrigatórios em falta', code: 'MISSING_FIELDS' });
    }
    if (check_out <= check_in) {
      return res.status(400).json({ error: 'Checkout deve ser posterior ao check-in', code: 'INVALID_DATES' });
    }

    const { data: operator } = await supabaseAdmin
      .from('operators')
      .select('id')
      .eq('slug', req.params.slug)
      .eq('onboarding_complete', true)
      .single();

    if (!operator) {
      return res.status(404).json({ error: 'Operador não encontrado', code: 'NOT_FOUND' });
    }

    const { data: unit } = await supabaseAdmin
      .from('units')
      .select('*, pricing_rules(*)')
      .eq('id', unit_id)
      .eq('operator_id', operator.id)
      .eq('status', 'active')
      .single();

    if (!unit) {
      return res.status(404).json({ error: 'Unidade não encontrada', code: 'NOT_FOUND' });
    }

    const disponivel = await verificarDisponibilidade(supabaseAdmin, unit_id, check_in, check_out);
    if (!disponivel) {
      return res.status(409).json({ error: 'Unidade indisponível nas datas seleccionadas', code: 'UNAVAILABLE' });
    }

    const { total } = calcularPreco(unit, check_in, check_out);

    // Criar ou obter cliente CRM
    const customer = await obterOuCriarCliente(operator.id, {
      name: customer_name,
      email: customer_email,
      phone: customer_phone,
      country_code: customer_country
    });

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .insert({
        operator_id: operator.id,
        unit_id,
        customer_id: customer.id,
        customer_name,
        customer_email,
        customer_phone: customer_phone || null,
        customer_country: customer_country || null,
        check_in,
        check_out,
        guests: guests || 1,
        total_price: total,
        status: 'pending',
        source: 'public',
        notes: notes || null
      })
      .select()
      .single();

    if (error) throw error;

    // Email de recepção imediata (a confirmação via automação chega quando admin confirmar)
    const idioma = detectarIdioma(customer_country);
    enviarEmail({
      to: customer_email,
      subject: idioma === 'en' ? 'Reservation request received' : 'Pedido de reserva recebido',
      text: idioma === 'en'
        ? `Hello ${customer_name},\n\nWe received your reservation request for ${unit.name} (${check_in} → ${check_out}).\n\nWe will confirm your booking shortly.\n\nThank you!`
        : `Olá ${customer_name},\n\nRecebemos o seu pedido de reserva para ${unit.name} (${check_in} → ${check_out}).\n\nIremos confirmar a sua reserva em breve.\n\nObrigado!`
    }).catch((err) => console.error('[Email] Erro ao enviar recepção:', err.message));

    return res.status(201).json({
      data,
      message: 'Reserva submetida com sucesso. Aguarde confirmação.'
    });
  } catch (err) {
    next(err);
  }
}

async function discover(req, res, next) {
  try {
    const { type, search } = req.query;

    let q = supabaseAdmin
      .from('operators')
      .select('id, name, slug, operator_type, description, address, phone, logo_url')
      .eq('onboarding_complete', true)
      .order('name');

    if (type && ['hotel','activity','rentacar','restaurant'].includes(type)) {
      q = q.eq('operator_type', type);
    }
    if (search) {
      q = q.ilike('name', `%${search}%`);
    }

    const { data, error } = await q;
    if (error) throw error;

    return res.json({ data: data || [], message: 'Operadores listados' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getOperador, verificarDisponibilidadePublica, criarReserva, discover };
