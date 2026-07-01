const { supabaseAdmin } = require('../config/supabase');
const { verificarDisponibilidade, calcularPreco } = require('../helpers/bookingHelpers');
const { obterOuCriarCliente, actualizarStatsCheckout } = require('../helpers/customerHelper');
const { enviarEmail } = require('../helpers/emailHelper');
const { confirmacaoClienteEmail, notificacaoOperadorEmail } = require('../helpers/emailTemplates');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

const TRANSICOES = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['checked_in', 'cancelled'],
  checked_in: ['checked_out', 'cancelled'],
  checked_out: [],
  cancelled:  []
};

async function listar(req, res, next) {
  try {
    const { status, unit_id, check_in_from, check_in_to } = req.query;

    let q = supabaseAdmin
      .from('reservations')
      .select('*, units(name, unit_type)')
      .eq('operator_id', getOperatorId(req))
      .order('check_in', { ascending: false });

    if (status) q = q.eq('status', status);
    if (unit_id) q = q.eq('unit_id', unit_id);
    if (check_in_from) q = q.gte('check_in', check_in_from);
    if (check_in_to) q = q.lte('check_in', check_in_to);

    const { data, error } = await q;
    if (error) throw error;

    return res.json({ data, message: 'Reservas listadas' });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const { unit_id, customer_name, customer_email, customer_phone, customer_country,
            check_in, check_out, guests, notes, notes_internal, notes_guest,
            total_amount, source, payment_method, payment_status, fleet_id } = req.body;

    if (!unit_id || !customer_name || !customer_email || !check_in || !check_out) {
      return res.status(400).json({ error: 'Campos obrigatórios em falta', code: 'MISSING_FIELDS' });
    }
    if (check_out < check_in) {
      return res.status(400).json({ error: 'Checkout não pode ser anterior ao check-in', code: 'INVALID_DATES' });
    }

    const { data: unit } = await supabaseAdmin
      .from('units')
      .select('*, pricing_rules(*)')
      .eq('id', unit_id)
      .eq('operator_id', getOperatorId(req))
      .single();

    if (!unit) {
      return res.status(404).json({ error: 'Unidade não encontrada', code: 'NOT_FOUND' });
    }

    const disponivel = await verificarDisponibilidade(supabaseAdmin, unit_id, check_in, check_out);
    if (!disponivel) {
      return res.status(409).json({ error: 'Unidade indisponível nas datas seleccionadas', code: 'UNAVAILABLE' });
    }

    const { total } = calcularPreco(unit, check_in, check_out);
    const finalPrice = (total_amount !== undefined && total_amount !== null) ? Number(total_amount) : total;
    const finalNotes = notes_internal || notes_guest || notes || null;
    const finalSource = source || 'admin';

    // Criar ou obter cliente CRM
    const customer = await obterOuCriarCliente(getOperatorId(req), {
      name: customer_name,
      email: customer_email,
      phone: customer_phone,
      country_code: customer_country
    });

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .insert({
        operator_id: getOperatorId(req),
        unit_id,
        customer_id: customer.id,
        customer_name,
        customer_email,
        customer_phone: customer_phone || null,
        customer_country: customer_country || null,
        check_in,
        check_out,
        guests: guests || 1,
        total_price: finalPrice,
        status: 'confirmed',
        source: finalSource,
        notes: finalNotes,
        fleet_id: fleet_id || null
      })
      .select('*, units(name, unit_type)')
      .single();

    if (error) throw error;

    // Buscar dados do operador para os emails (idioma, moeda, nome, email)
    const { data: operatorData } = await supabaseAdmin
      .from('operators')
      .select('name, email, currency, language')
      .eq('id', getOperatorId(req))
      .single();

    const idioma = operatorData?.language || 'pt';
    const currency = operatorData?.currency || 'EUR';

    // Email de confirmacao ao cliente
    const clienteEmail = confirmacaoClienteEmail({
      idioma,
      customerName: customer_name,
      tourName: unit.name,
      checkIn: check_in,
      checkOut: check_out,
      guests: guests || 1,
      total: finalPrice,
      currency,
      operator: operatorData,
    });
    enviarEmail({
      to: customer_email,
      subject: clienteEmail.subject,
      html: clienteEmail.html,
      text: clienteEmail.text,
    }).catch((err) => console.error('[Email] Erro ao enviar confirmacao ao cliente:', err.message));

    // Email de notificacao ao operador (com nome do vendedor, se aplicavel)
    if (operatorData?.email) {
      const sellerName = req.staff?.name || null;
      const operadorEmail = notificacaoOperadorEmail({
        operatorName: operatorData.name,
        tourName: unit.name,
        checkIn: check_in,
        checkOut: check_out,
        guests: guests || 1,
        total: finalPrice,
        currency,
        customer: {
          name: customer_name,
          email: customer_email,
          phone: customer_phone,
          country: customer_country,
        },
        notes: finalNotes,
        sellerName,
      });
      enviarEmail({
        to: operatorData.email,
        subject: operadorEmail.subject,
        html: operadorEmail.html,
        text: operadorEmail.text,
      }).catch((err) => console.error('[Email] Erro ao enviar notificacao ao operador:', err.message));
    }

    return res.status(201).json({ data, message: 'Reserva criada com sucesso' });
  } catch (err) {
    next(err);
  }
}

async function obter(req, res, next) {
  try {
    if (!req.operator) {
      return res.status(403).json({ error: 'Apenas operadores podem gerir esta reserva', code: 'OPERATOR_ONLY' });
    }

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .select('*, units(name, unit_type, base_price)')
      .eq('id', req.params.id)
      .eq('operator_id', getOperatorId(req))
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Reserva não encontrada', code: 'NOT_FOUND' });
    }

    return res.json({ data, message: 'Reserva encontrada' });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    if (!req.operator) {
      return res.status(403).json({ error: 'Apenas operadores podem gerir esta reserva', code: 'OPERATOR_ONLY' });
    }

    const { customer_name, customer_email, customer_phone, customer_country, guests, notes } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (customer_name !== undefined) updates.customer_name = customer_name;
    if (customer_email !== undefined) updates.customer_email = customer_email;
    if (customer_phone !== undefined) updates.customer_phone = customer_phone;
    if (customer_country !== undefined) updates.customer_country = customer_country;
    if (guests !== undefined) updates.guests = guests;
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .update(updates)
      .eq('id', req.params.id)
      .eq('operator_id', getOperatorId(req))
      .select('*, units(name, unit_type)')
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Reserva não encontrada', code: 'NOT_FOUND' });
    }

    return res.json({ data, message: 'Reserva actualizada' });
  } catch (err) {
    next(err);
  }
}

async function mudarStatus(req, res, next) {
  try {
    if (!req.operator) {
      return res.status(403).json({ error: 'Apenas operadores podem gerir esta reserva', code: 'OPERATOR_ONLY' });
    }

    const { status } = req.body;

    if (!Object.keys(TRANSICOES).includes(status)) {
      return res.status(400).json({ error: 'Status inválido', code: 'INVALID_STATUS' });
    }

    const { data: reserva } = await supabaseAdmin
      .from('reservations')
      .select('status, customer_id, total_price')
      .eq('id', req.params.id)
      .eq('operator_id', getOperatorId(req))
      .single();

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva não encontrada', code: 'NOT_FOUND' });
    }

    if (!TRANSICOES[reserva.status].includes(status)) {
      return res.status(400).json({
        error: `Transição de "${reserva.status}" para "${status}" não permitida`,
        code: 'INVALID_TRANSITION'
      });
    }

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('operator_id', getOperatorId(req))
      .select('*, units(name, unit_type)')
      .single();

    if (error) throw error;

    // Actualizar stats do cliente após checkout
    if (status === 'checked_out' && reserva.customer_id) {
      await actualizarStatsCheckout(reserva.customer_id, reserva.total_price);
    }

    return res.json({ data, message: `Status actualizado para "${status}"` });
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    if (!req.operator) {
      return res.status(403).json({ error: 'Apenas operadores podem gerir esta reserva', code: 'OPERATOR_ONLY' });
    }

    const { error } = await supabaseAdmin
      .from('reservations')
      .delete()
      .eq('id', req.params.id)
      .eq('operator_id', getOperatorId(req));

    if (error) throw error;

    return res.json({ data: null, message: 'Reserva eliminada' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, criar, obter, actualizar, mudarStatus, eliminar };
