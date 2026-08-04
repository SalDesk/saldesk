const { supabaseAdmin } = require('../config/supabase');
const { createOrder, captureOrder, refundCapture, verifyWebhookSignature } = require('../services/paypalService');
const { construirPedidoPagamento, validarResposta } = require('../services/sispService');
const { decrypt } = require('../utils/encrypt');
const { emitToOperator } = require('../services/socketService');
const { notifyOperator } = require('../services/pushService');
const { frontendBase } = require('../utils/urls');

/* ─── PayPal ─────────────────────────────────────────────── */

async function createPayPalIntent(req, res, next) {
  try {
    const { reservation_id, amount, currency = 'EUR' } = req.body;
    if (!reservation_id || !amount) {
      return res.status(400).json({ error: 'reservation_id e amount obrigatorios', code: 'MISSING_FIELDS' });
    }
    const order = await createOrder(amount, currency, `Reserva SalDesk ${reservation_id}`);
    return res.json({ data: { order_id: order.id, status: order.status }, message: 'Order PayPal criada' });
  } catch (err) { next(err); }
}

async function confirmPayPalPayment(req, res, next) {
  try {
    const { order_id, reservation_id } = req.body;
    if (!order_id || !reservation_id) {
      return res.status(400).json({ error: 'order_id e reservation_id obrigatorios', code: 'MISSING_FIELDS' });
    }

    const capture = await captureOrder(order_id);
    const captureUnit = capture.purchase_units?.[0]?.payments?.captures?.[0];
    const amount = parseFloat(captureUnit?.amount?.value || 0);

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .update({
        payment_status: 'paid', payment_method: 'paypal',
        paypal_order_id: order_id, amount_paid: amount,
        status: 'confirmed', updated_at: new Date().toISOString(),
      })
      .eq('id', reservation_id)
      .select('*, operators(name, push_subscription)')
      .single();

    if (error) throw error;

    emitToOperator(data.operator_id, 'payment:confirmed', { reservation_id, amount, method: 'paypal' });
    if (data.operators?.push_subscription) {
      await notifyOperator(data.operators, { title: 'Pagamento recebido', body: `€${amount} via PayPal`, tag: 'payment', url: '/reservas' });
    }

    return res.json({ data, message: 'Pagamento PayPal confirmado' });
  } catch (err) { next(err); }
}

async function paypalWebhook(req, res, next) {
  res.status(200).json({ received: true });
  try {
    if (!verifyWebhookSignature(req.headers, req.body, process.env.PAYPAL_WEBHOOK_ID)) return;
    const event = req.body;
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
      if (orderId) {
        await supabaseAdmin
          .from('reservations')
          .update({ payment_status: 'paid', status: 'confirmed', updated_at: new Date().toISOString() })
          .eq('paypal_order_id', orderId);
      }
    }
  } catch (err) { console.error('[PayPal Webhook]', err.message); }
}

/* ─── SISP (Vinti4) ──────────────────────────────────────────
   Fluxo de redirect: devolvemos ao frontend os campos de um
   formulario que ele auto-submete para a Vinti4; a resposta chega
   depois via POST directo a /payments/sisp/callback. */

async function initSisp(req, res, next) {
  try {
    const { reservation_id, amount } = req.body;
    if (!reservation_id || !amount) {
      return res.status(400).json({ error: 'reservation_id e amount obrigatorios', code: 'MISSING_FIELDS' });
    }

    const { data: operatorRow } = await supabaseAdmin
      .from('operators')
      .select('sisp_merchant_id_enc, sisp_api_key_enc')
      .eq('id', req.operator.id)
      .single();

    if (!operatorRow?.sisp_merchant_id_enc || !operatorRow?.sisp_api_key_enc) {
      return res.status(400).json({ error: 'Credenciais SISP nao configuradas para este operador', code: 'SISP_NOT_CONFIGURED' });
    }

    const posID = decrypt(operatorRow.sisp_merchant_id_enc);
    const posAutCode = decrypt(operatorRow.sisp_api_key_enc);
    const apiBase = process.env.API_URL || 'http://localhost:3001';

    const pedido = construirPedidoPagamento({
      posID, posAutCode, amount,
      urlMerchantResponse: `${apiBase}/api/v1/payments/sisp/callback?res=${reservation_id}`,
    });

    return res.json({ data: { postUrl: pedido.postUrl, fields: pedido.fields }, message: 'Pedido SISP preparado' });
  } catch (err) { next(err); }
}

async function sispCallback(req, res, next) {
  const reservationId = req.query.res;
  const frontBase = frontendBase();
  try {
    const { data: reserva } = await supabaseAdmin
      .from('reservations')
      .select('id, operator_id')
      .eq('id', reservationId)
      .single();

    if (!reserva) return res.redirect(`${frontBase}/book/cancel`);

    const { data: operatorRow } = await supabaseAdmin
      .from('operators')
      .select('sisp_api_key_enc')
      .eq('id', reserva.operator_id)
      .single();

    const posAutCode = operatorRow?.sisp_api_key_enc ? decrypt(operatorRow.sisp_api_key_enc) : null;
    const resultado = posAutCode ? validarResposta(posAutCode, req.body) : { status: 'error' };

    if (resultado.status === 'paid') {
      await supabaseAdmin
        .from('reservations')
        .update({
          payment_status: 'paid', payment_method: 'sisp',
          sisp_transaction_id: resultado.transactionID,
          status: 'confirmed', updated_at: new Date().toISOString(),
        })
        .eq('id', reservationId);
      return res.redirect(`${frontBase}/book/success?res=${reservationId}`);
    }

    if (resultado.status === 'cancelled') {
      return res.redirect(`${frontBase}/book/cancel?res=${reservationId}`);
    }

    console.error('[SISP Callback] Pagamento nao validado:', resultado.status, resultado.errorDescription || '');
    return res.redirect(`${frontBase}/book/cancel?res=${reservationId}&erro=${resultado.status}`);
  } catch (err) {
    console.error('[SISP Callback] Erro:', err.message);
    return res.redirect(`${frontBase}/book/cancel?res=${reservationId}`);
  }
}

/* ─── Manual + Histórico ────────────────────────────────── */

async function registerManualPayment(req, res, next) {
  try {
    const { reservation_id, amount, method, notes } = req.body;
    if (!reservation_id || !amount || !method) {
      return res.status(400).json({ error: 'reservation_id, amount e method obrigatorios', code: 'MISSING_FIELDS' });
    }
    const { data: reserva } = await supabaseAdmin.from('reservations').select('total_amount, amount_paid').eq('id', reservation_id).eq('operator_id', req.operator.id).single();
    if (!reserva) return res.status(404).json({ error: 'Reserva nao encontrada', code: 'NOT_FOUND' });

    const newPaid = Number(reserva.amount_paid || 0) + Number(amount);
    const isPaid  = newPaid >= Number(reserva.total_amount);

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .update({
        amount_paid: newPaid, payment_method: method,
        payment_status: isPaid ? 'paid' : 'partial',
        notes_internal: notes || null, updated_at: new Date().toISOString(),
      })
      .eq('id', reservation_id)
      .select().single();
    if (error) throw error;
    return res.json({ data, message: 'Pagamento manual registado' });
  } catch (err) { next(err); }
}

async function getHistory(req, res, next) {
  try {
    const { from, to } = req.query;
    let q = supabaseAdmin
      .from('reservations')
      .select('id, customer_name, total_amount, amount_paid, payment_status, payment_method, check_in, units(name)')
      .eq('operator_id', req.operator.id)
      .not('payment_status', 'eq', 'pending')
      .order('updated_at', { ascending: false });
    if (from) q = q.gte('check_in', from);
    if (to)   q = q.lte('check_in', to);
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ data, message: 'Historico listado' });
  } catch (err) { next(err); }
}

async function refund(req, res, next) {
  try {
    const { reservation_id, amount, reason } = req.body;
    const { data: reserva } = await supabaseAdmin.from('reservations').select('paypal_order_id, payment_method, total_amount').eq('id', reservation_id).eq('operator_id', req.operator.id).single();
    if (!reserva) return res.status(404).json({ error: 'Reserva nao encontrada', code: 'NOT_FOUND' });

    if (reserva.payment_method === 'paypal' && reserva.paypal_order_id) {
      await refundCapture(reserva.paypal_order_id, amount);
    }

    await supabaseAdmin
      .from('reservations')
      .update({ payment_status: 'refunded', notes_internal: reason || 'Reembolso', updated_at: new Date().toISOString() })
      .eq('id', reservation_id);

    return res.json({ data: null, message: 'Reembolso processado' });
  } catch (err) { next(err); }
}

module.exports = { createPayPalIntent, confirmPayPalPayment, paypalWebhook, initSisp, sispCallback, registerManualPayment, getHistory, refund };
