const { supabaseAdmin } = require('../config/supabase');
const { createOrder, captureOrder, refundCapture, verifyWebhookSignature } = require('../services/paypalService');
const { iniciarPagamento, verificarPagamento } = require('../services/sispService');
const { emitToOperator } = require('../services/socketService');
const { notifyOperator } = require('../services/pushService');

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

/* ─── SISP ───────────────────────────────────────────────── */

async function initSisp(req, res, next) {
  try {
    const { reservation_id, amount } = req.body;
    if (!reservation_id || !amount) {
      return res.status(400).json({ error: 'reservation_id e amount obrigatorios', code: 'MISSING_FIELDS' });
    }
    const apiBase = process.env.API_URL || 'http://localhost:3001/api/v1';
    const frontBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const result = await iniciarPagamento({
      amount, currency: 'EUR', reservationId: reservation_id,
      returnUrl: `${apiBase}/payments/sisp/callback?res=${reservation_id}`,
      cancelUrl:  `${frontBase}/book/cancel`,
    });
    return res.json({ data: result, message: 'Sessao SISP iniciada' });
  } catch (err) { next(err); }
}

async function sispCallback(req, res, next) {
  try {
    const { res: reservationId, sisp_sim, ref } = req.query;
    if (sisp_sim) {
      await supabaseAdmin
        .from('reservations')
        .update({ payment_status: 'paid', payment_method: 'sisp', sisp_transaction_id: ref, status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', reservationId);
      const frontBase = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontBase}/book/success?res=${reservationId}`);
    }
    const txId = req.query.TransactionID || req.query.transactionId;
    if (txId) {
      const status = await verificarPagamento(txId);
      if (status.status === 'paid') {
        await supabaseAdmin
          .from('reservations')
          .update({ payment_status: 'paid', payment_method: 'sisp', sisp_transaction_id: txId, status: 'confirmed', updated_at: new Date().toISOString() })
          .eq('id', reservationId);
      }
    }
    const frontBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontBase}/book/success?res=${reservationId}`);
  } catch (err) { next(err); }
}

async function sispWebhook(req, res, next) {
  res.status(200).json({ received: true });
  try {
    const { TransactionID, Status, ReservationID } = req.body;
    if (Status === '0' && ReservationID) {
      await supabaseAdmin
        .from('reservations')
        .update({ payment_status: 'paid', payment_method: 'sisp', sisp_transaction_id: TransactionID, status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', ReservationID);
    }
  } catch (err) { console.error('[SISP Webhook]', err.message); }
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

module.exports = { createPayPalIntent, confirmPayPalPayment, paypalWebhook, initSisp, sispCallback, sispWebhook, registerManualPayment, getHistory, refund };
