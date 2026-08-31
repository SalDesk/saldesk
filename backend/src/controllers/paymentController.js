const { supabaseAdmin } = require('../config/supabase');
const { createOrder, captureOrder, refundCapture, verifyWebhookSignature } = require('../services/paypalService');
const { construirPedidoPagamento, validarResposta } = require('../services/sispService');
const { decrypt } = require('../utils/encrypt');
const { emitToOperator } = require('../services/socketService');
const { notifyOperator } = require('../services/pushService');
const { frontendBase } = require('../utils/urls');
const { criarNotificacaoViajante } = require('../helpers/travelerNotificationHelper');

/* ─── PayPal ─────────────────────────────────────────────── */

/* Credenciais PayPal sao por operador (Definicoes > Pagamentos), nunca
   globais da plataforma. */
async function obterCredenciaisPaypal(operatorId) {
  const { data: operatorRow } = await supabaseAdmin
    .from('operators')
    .select('paypal_client_id_enc, paypal_client_secret_enc')
    .eq('id', operatorId)
    .single();

  if (!operatorRow?.paypal_client_id_enc || !operatorRow?.paypal_client_secret_enc) {
    const err = new Error('Credenciais PayPal nao configuradas para este operador');
    err.status = 400; err.code = 'PAYPAL_NOT_CONFIGURED';
    throw err;
  }

  return {
    clientId: decrypt(operatorRow.paypal_client_id_enc),
    clientSecret: decrypt(operatorRow.paypal_client_secret_enc),
  };
}

async function publicPaypalClientId(req, res, next) {
  try {
    const { data: operatorRow } = await supabaseAdmin
      .from('operators').select('id, paypal_client_id_enc').eq('slug', req.params.slug).single();
    if (!operatorRow?.paypal_client_id_enc) {
      return res.status(404).json({ error: 'PayPal nao configurado para este operador', code: 'PAYPAL_NOT_CONFIGURED' });
    }
    return res.json({ data: { client_id: decrypt(operatorRow.paypal_client_id_enc) }, message: 'Client ID PayPal' });
  } catch (err) { next(err); }
}

async function createPayPalIntent(req, res, next) {
  try {
    const { reservation_id, amount, currency = 'EUR' } = req.body;
    if (!reservation_id || !amount) {
      return res.status(400).json({ error: 'reservation_id e amount obrigatorios', code: 'MISSING_FIELDS' });
    }
    const { clientId, clientSecret } = await obterCredenciaisPaypal(req.operator.id);
    const order = await createOrder(clientId, clientSecret, amount, currency, `Reserva SalDesk ${reservation_id}`);
    return res.json({ data: { order_id: order.id, status: order.status }, message: 'Order PayPal criada' });
  } catch (err) { next(err); }
}

/* Rota publica — usada pelo cliente na pagina de reserva, sem sessao de operador. */
async function publicCreatePaypalIntent(req, res, next) {
  try {
    const { reservation_id, amount, currency = 'EUR' } = req.body;
    if (!reservation_id || !amount) {
      return res.status(400).json({ error: 'reservation_id e amount obrigatorios', code: 'MISSING_FIELDS' });
    }
    const { data: reserva } = await supabaseAdmin
      .from('reservations').select('id, operator_id').eq('id', reservation_id).single();
    if (!reserva) return res.status(404).json({ error: 'Reserva nao encontrada', code: 'NOT_FOUND' });

    const { clientId, clientSecret } = await obterCredenciaisPaypal(reserva.operator_id);
    const order = await createOrder(clientId, clientSecret, amount, currency, `Reserva SalDesk ${reservation_id}`);
    return res.json({ data: { order_id: order.id, status: order.status }, message: 'Order PayPal criada' });
  } catch (err) { next(err); }
}

async function confirmarCapturaPaypal(operatorId, orderId, reservationId) {
  const { clientId, clientSecret } = await obterCredenciaisPaypal(operatorId);
  const capture = await captureOrder(clientId, clientSecret, orderId);
  const captureUnit = capture.purchase_units?.[0]?.payments?.captures?.[0];
  const amount = parseFloat(captureUnit?.amount?.value || 0);

  const { data, error } = await supabaseAdmin
    .from('reservations')
    .update({
      payment_status: 'paid', payment_method: 'paypal',
      /* refundCapture() exige o ID da CAPTURA (captureUnit.id), nao o da
         ordem -- sao valores diferentes na API da PayPal. Guardar os dois:
         paypal_order_id so para referencia/histórico, paypal_capture_id e
         o que o reembolso realmente usa. */
      paypal_order_id: orderId, paypal_capture_id: captureUnit?.id || null, amount_paid: amount,
      status: 'confirmed', updated_at: new Date().toISOString(),
    })
    .eq('id', reservationId)
    .select('*, operators(name, push_subscription)')
    .single();

  if (error) throw error;

  emitToOperator(data.operator_id, 'payment:confirmed', { reservation_id: reservationId, amount, method: 'paypal' });
  if (data.operators?.push_subscription) {
    await notifyOperator(data.operators, { title: 'Pagamento recebido', body: `€${amount} via PayPal`, tag: 'payment', url: '/reservas' });
  }
  criarNotificacaoViajante(
    data.customer_email, 'booking_confirmed',
    `A sua reserva com ${data.operators?.name || 'o operador'} foi confirmada.`,
    `${frontendBase()}/viajante`,
  ).catch(() => {});

  return data;
}

async function confirmPayPalPayment(req, res, next) {
  try {
    const { order_id, reservation_id } = req.body;
    if (!order_id || !reservation_id) {
      return res.status(400).json({ error: 'order_id e reservation_id obrigatorios', code: 'MISSING_FIELDS' });
    }
    const data = await confirmarCapturaPaypal(req.operator.id, order_id, reservation_id);
    return res.json({ data, message: 'Pagamento PayPal confirmado' });
  } catch (err) { next(err); }
}

/* Rota publica — o cliente confirma o proprio pagamento apos aprovar no PayPal. */
async function publicConfirmPaypalPayment(req, res, next) {
  try {
    const { order_id, reservation_id } = req.body;
    if (!order_id || !reservation_id) {
      return res.status(400).json({ error: 'order_id e reservation_id obrigatorios', code: 'MISSING_FIELDS' });
    }
    const { data: reserva } = await supabaseAdmin
      .from('reservations').select('id, operator_id').eq('id', reservation_id).single();
    if (!reserva) return res.status(404).json({ error: 'Reserva nao encontrada', code: 'NOT_FOUND' });

    const data = await confirmarCapturaPaypal(reserva.operator_id, order_id, reservation_id);
    return res.json({ data, message: 'Pagamento PayPal confirmado' });
  } catch (err) { next(err); }
}

async function paypalWebhook(req, res, next) {
  res.status(200).json({ received: true });
  try {
    const event = req.body;
    const orderId = event.resource?.supplementary_data?.related_ids?.order_id || event.resource?.id;
    if (!orderId) return;

    /* A conta PayPal (e por isso as credenciais/webhook ID a usar na
       verificacao) e do OPERADOR, nao da plataforma -- tem de se saber a
       que reserva/operador o evento pertence antes de conseguir verificar. */
    const { data: reserva } = await supabaseAdmin
      .from('reservations')
      .select('id, operator_id, customer_email, operators(name)')
      .eq('paypal_order_id', orderId)
      .maybeSingle();
    if (!reserva) return;

    const { data: operatorRow } = await supabaseAdmin
      .from('operators')
      .select('paypal_client_id_enc, paypal_client_secret_enc, paypal_webhook_id_enc')
      .eq('id', reserva.operator_id)
      .single();

    if (!operatorRow?.paypal_client_id_enc || !operatorRow?.paypal_client_secret_enc || !operatorRow?.paypal_webhook_id_enc) {
      console.warn(`[PayPal Webhook] Operador ${reserva.operator_id} sem Webhook ID configurado — evento ignorado (nao ha como verificar a assinatura).`);
      return;
    }

    const valid = await verifyWebhookSignature(
      decrypt(operatorRow.paypal_client_id_enc),
      decrypt(operatorRow.paypal_client_secret_enc),
      decrypt(operatorRow.paypal_webhook_id_enc),
      req.headers,
      req.body,
    );
    if (!valid) {
      console.error('[PayPal Webhook] Assinatura invalida — evento ignorado.');
      return;
    }

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      await supabaseAdmin
        .from('reservations')
        .update({ payment_status: 'paid', status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', reserva.id);
      criarNotificacaoViajante(
        reserva.customer_email, 'booking_confirmed',
        `A sua reserva com ${reserva.operators?.name || 'o operador'} foi confirmada.`,
        `${frontendBase()}/viajante`,
      ).catch(() => {});
    }
  } catch (err) { console.error('[PayPal Webhook]', err.message); }
}

/* ─── SISP (Vinti4) ──────────────────────────────────────────
   Fluxo de redirect: devolvemos ao frontend os campos de um
   formulario que ele auto-submete para a Vinti4; a resposta chega
   depois via POST directo a /payments/sisp/callback. */

/* Partilhado entre a rota autenticada (operador) e a publica (cliente
   na pagina de reserva) — so muda de onde vem o operatorId. Busca tambem os
   dados do cliente da propria reserva (email/telefone/pais) para alimentar
   o purchaseRequest -- nunca inventado, so o que a reserva ja tiver. */
async function prepararPagamentoSisp(operatorId, reservationId, amount) {
  const { data: operatorRow } = await supabaseAdmin
    .from('operators')
    .select('sisp_merchant_id_enc, sisp_api_key_enc')
    .eq('id', operatorId)
    .single();

  if (!operatorRow?.sisp_merchant_id_enc || !operatorRow?.sisp_api_key_enc) {
    const err = new Error('Credenciais SISP nao configuradas para este operador');
    err.status = 400; err.code = 'SISP_NOT_CONFIGURED';
    throw err;
  }

  const posID = decrypt(operatorRow.sisp_merchant_id_enc);
  const posAutCode = decrypt(operatorRow.sisp_api_key_enc);
  const apiBase = process.env.API_URL || 'http://localhost:3001';

  const { data: reserva } = await supabaseAdmin
    .from('reservations')
    .select('customer_email, customer_phone, customer_country')
    .eq('id', reservationId)
    .maybeSingle();

  return construirPedidoPagamento({
    posID, posAutCode, amount,
    urlMerchantResponse: `${apiBase}/api/v1/payments/sisp/callback?res=${reservationId}`,
    customer: {
      email: reserva?.customer_email,
      phone: reserva?.customer_phone,
      countryAlpha2: reserva?.customer_country,
    },
  });
}

async function initSisp(req, res, next) {
  try {
    const { reservation_id, amount } = req.body;
    if (!reservation_id || !amount) {
      return res.status(400).json({ error: 'reservation_id e amount obrigatorios', code: 'MISSING_FIELDS' });
    }
    const pedido = await prepararPagamentoSisp(req.operator.id, reservation_id, amount);
    return res.json({ data: { postUrl: pedido.postUrl, fields: pedido.fields }, message: 'Pedido SISP preparado' });
  } catch (err) { next(err); }
}

/* Rota publica — usada pelo cliente na pagina de reserva, sem sessao de operador. */
async function publicInitSisp(req, res, next) {
  try {
    const { reservation_id, amount } = req.body;
    if (!reservation_id || !amount) {
      return res.status(400).json({ error: 'reservation_id e amount obrigatorios', code: 'MISSING_FIELDS' });
    }
    const { data: reserva } = await supabaseAdmin
      .from('reservations').select('id, operator_id').eq('id', reservation_id).single();
    if (!reserva) return res.status(404).json({ error: 'Reserva nao encontrada', code: 'NOT_FOUND' });

    const pedido = await prepararPagamentoSisp(reserva.operator_id, reservation_id, amount);
    return res.json({ data: { postUrl: pedido.postUrl, fields: pedido.fields }, message: 'Pedido SISP preparado' });
  } catch (err) { next(err); }
}

async function sispCallback(req, res, next) {
  const reservationId = req.query.res;
  const frontBase = frontendBase();
  try {
    const { data: reserva } = await supabaseAdmin
      .from('reservations')
      .select('id, operator_id, customer_email, operators(name)')
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
      criarNotificacaoViajante(
        reserva.customer_email, 'booking_confirmed',
        `A sua reserva com ${reserva.operators?.name || 'o operador'} foi confirmada.`,
        `${frontBase}/viajante`,
      ).catch(() => {});
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
    const { reservation_id, amount, method } = req.body;
    if (!reservation_id || !amount || !method) {
      return res.status(400).json({ error: 'reservation_id, amount e method obrigatorios', code: 'MISSING_FIELDS' });
    }
    /* reservations nao tem coluna "total_amount" -- a coluna real e
       "total_price". Este select falhava sempre (coluna inexistente),
       fazendo o registo de pagamento manual devolver um falso 404 antes
       mesmo de tentar gravar. (notes_internal existe -- ver migracao
       reservations_notes_split_and_no_show -- so nao e usada aqui.) */
    const { data: reserva } = await supabaseAdmin.from('reservations').select('total_price, amount_paid').eq('id', reservation_id).eq('operator_id', req.operator.id).single();
    if (!reserva) return res.status(404).json({ error: 'Reserva nao encontrada', code: 'NOT_FOUND' });

    const newPaid = Number(reserva.amount_paid || 0) + Number(amount);
    const isPaid  = newPaid >= Number(reserva.total_price);

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .update({
        amount_paid: newPaid, payment_method: method,
        payment_status: isPaid ? 'paid' : 'partial',
        updated_at: new Date().toISOString(),
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
      .select('id, customer_name, total_price, amount_paid, payment_status, payment_method, check_in, units(name)')
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
    const { data: reserva } = await supabaseAdmin.from('reservations').select('paypal_capture_id, payment_method, total_price, customer_email, notes_internal, operators(name)').eq('id', reservation_id).eq('operator_id', req.operator.id).single();
    if (!reserva) return res.status(404).json({ error: 'Reserva nao encontrada', code: 'NOT_FOUND' });

    if (reserva.payment_method === 'paypal') {
      if (!reserva.paypal_capture_id) {
        /* Reserva paga antes desta correcao (ver database/040) -- nao temos o
           ID da captura, so o da ordem, que a API de reembolso da PayPal
           rejeita. Nao adivinhar: pedir reembolso manual pelo dashboard. */
        return res.status(400).json({
          error: 'Esta reserva nao tem o ID de captura PayPal guardado. Reembolse manualmente pelo dashboard da PayPal.',
          code: 'PAYPAL_CAPTURE_ID_MISSING',
        });
      }
      const { clientId, clientSecret } = await obterCredenciaisPaypal(req.operator.id);
      await refundCapture(clientId, clientSecret, reserva.paypal_capture_id, amount);
    }

    /* notes_internal tambem guarda o checklist de entrega/recolha do rent-a-car
       (JSON) para esta mesma reserva -- nunca sobrescrever, so acrescentar o
       motivo do reembolso a seguir ao que ja la estiver. */
    const refundNote = `Reembolso: ${reason || 'sem motivo indicado'}`;
    const novoNotesInternal = reserva.notes_internal ? `${reserva.notes_internal}\n${refundNote}` : refundNote;
    await supabaseAdmin
      .from('reservations')
      .update({ payment_status: 'refunded', notes_internal: novoNotesInternal, updated_at: new Date().toISOString() })
      .eq('id', reservation_id);
    criarNotificacaoViajante(
      reserva.customer_email, 'refund',
      `O pagamento da sua reserva com ${reserva.operators?.name || 'o operador'} foi reembolsado.`,
      `${frontendBase()}/viajante`,
    ).catch(() => {});

    return res.json({ data: null, message: 'Reembolso processado' });
  } catch (err) { next(err); }
}

module.exports = {
  createPayPalIntent, confirmPayPalPayment, paypalWebhook,
  publicPaypalClientId, publicCreatePaypalIntent, publicConfirmPaypalPayment,
  initSisp, publicInitSisp, sispCallback,
  registerManualPayment, getHistory, refund,
};
