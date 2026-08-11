const { supabaseAdmin } = require('../config/supabase');
const { createOrder, captureOrder, verifyWebhookSignature } = require('../services/platformPaypalService');
const { loadPriceMap } = require('../helpers/pricing');
const { enviarEmail } = require('../helpers/emailHelper');
const { frontendBase } = require('../utils/urls');

const PLANS = ['starter', 'business', 'pro'];

/* Erros da PayPal (ex: 401 por credenciais invalidas/em falta) tem o seu
   proprio .status vindo do axios -- nunca deixar isso propagar tal e qual
   para o frontend: um 401 aqui seria mal-interpretado pelo interceptor
   global como sessao do operador expirada, forcando logout indevido. */
async function chamarGatewayPaypal(fn) {
  try {
    return await fn();
  } catch (err) {
    console.error('[Billing] Erro ao comunicar com a PayPal:', err.response?.data || err.message);
    const gatewayErr = new Error('Nao foi possivel comunicar com o gateway de pagamento. Tenta novamente em breve.');
    gatewayErr.status = 502;
    gatewayErr.code = 'PAYPAL_GATEWAY_ERROR';
    throw gatewayErr;
  }
}

/* ─── Checkout ───────────────────────────────────────────────
   Fluxo de redirect simples: cria a ordem, guarda um platform_payments
   pending, devolve o link de aprovacao da PayPal. A confirmacao real
   acontece em confirmCheckout (quando o browser volta) e, como reforco
   idempotente, no webhook. */
async function createCheckout(req, res, next) {
  try {
    const { plan } = req.body;
    if (!PLANS.includes(plan)) {
      return res.status(400).json({ error: 'Plano invalido', code: 'INVALID_PLAN' });
    }

    const priceMap = await loadPriceMap();
    const amount = priceMap[plan];
    if (!amount) {
      return res.status(400).json({ error: 'Preco nao configurado para este plano', code: 'PRICE_NOT_FOUND' });
    }

    const base = frontendBase();
    const order = await chamarGatewayPaypal(() => createOrder(
      amount, plan,
      `${base}/definicoes/facturacao/sucesso`,
      `${base}/definicoes/facturacao/cancelado`
    ));

    const { error: insertError } = await supabaseAdmin.from('platform_payments').insert({
      operator_id: req.operator.id,
      plan,
      amount_eur: amount,
      gateway: 'paypal',
      gateway_order_id: order.id,
      status: 'pending',
    });
    if (insertError) throw insertError;

    const approveLink = (order.links || []).find((l) => l.rel === 'approve');
    if (!approveLink) throw new Error('PayPal nao devolveu link de aprovacao');

    return res.json({ data: { approval_url: approveLink.href, order_id: order.id }, message: 'Checkout criado' });
  } catch (err) { next(err); }
}

/* Chamada pela pagina de sucesso (BillingSuccess.jsx) assim que a PayPal
   redirecciona de volta com ?token=<orderId> -- confirmacao imediata e
   sincrona, sem depender só do webhook assincrono. Idempotente: se o
   pagamento ja estiver 'completed' (ex. o webhook chegou primeiro), so
   devolve o estado actual sem capturar de novo. */
async function confirmCheckout(req, res, next) {
  try {
    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id obrigatorio', code: 'MISSING_FIELDS' });

    const { data: payment } = await supabaseAdmin
      .from('platform_payments').select('*')
      .eq('gateway_order_id', order_id).eq('operator_id', req.operator.id).maybeSingle();
    if (!payment) return res.status(404).json({ error: 'Pagamento nao encontrado', code: 'NOT_FOUND' });

    if (payment.status === 'completed') {
      return res.json({ data: { status: 'completed' }, message: 'Pagamento ja confirmado' });
    }

    const capture = await chamarGatewayPaypal(() => captureOrder(order_id));
    const captured = capture.status === 'COMPLETED';
    if (!captured) {
      await supabaseAdmin.from('platform_payments').update({ status: 'failed' }).eq('id', payment.id);
      return res.status(402).json({ error: 'Pagamento nao foi concluido', code: 'PAYMENT_NOT_COMPLETED' });
    }

    await aplicarPagamentoConfirmado(payment);
    return res.json({ data: { status: 'completed' }, message: 'Pagamento confirmado' });
  } catch (err) { next(err); }
}

async function aplicarPagamentoConfirmado(payment) {
  const nowIso = new Date().toISOString();
  const paidUntil = new Date(Date.now() + 30 * 86400000).toISOString();

  await supabaseAdmin.from('platform_payments')
    .update({ status: 'completed', completed_at: nowIso })
    .eq('id', payment.id);

  const { data: current } = await supabaseAdmin
    .from('operators').select('name, email, plan, notes_log').eq('id', payment.operator_id).single();

  const logEntry = {
    text: `Pagamento PayPal confirmado — plano "${payment.plan}", €${payment.amount_eur}`,
    at: nowIso, type: 'payment',
  };
  const log = Array.isArray(current?.notes_log) ? current.notes_log : [];

  await supabaseAdmin.from('operators').update({
    plan: payment.plan,
    plan_status: 'active',
    plan_paid_until: paidUntil,
    notes_log: [...log, logEntry],
    updated_at: nowIso,
  }).eq('id', payment.operator_id);

  if (current?.email) {
    enviarEmail({
      to: current.email,
      subject: 'Pagamento confirmado — SalDesk',
      text: `Ola ${current.name},\n\nO teu pagamento de €${payment.amount_eur} para o plano ${payment.plan} foi confirmado.\n\nA tua subscricao esta activa ate ${paidUntil.split('T')[0]}.\n\nObrigado por usares a SalDesk.`,
    }).catch(() => {});
  }
}

async function webhookPaypal(req, res, next) {
  res.status(200).json({ received: true });
  try {
    const valid = await verifyWebhookSignature(req.headers, req.body);
    if (!valid) { console.warn('[Billing Webhook] Assinatura invalida, ignorado'); return; }

    const event = req.body;
    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') return;

    const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
    if (!orderId) return;

    const { data: payment } = await supabaseAdmin
      .from('platform_payments').select('*').eq('gateway_order_id', orderId).maybeSingle();
    if (!payment || payment.status === 'completed') return;

    await aplicarPagamentoConfirmado(payment);
  } catch (err) { console.error('[Billing Webhook]', err.message); }
}

async function getBillingHistory(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_payments').select('*')
      .eq('operator_id', req.operator.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ data, message: 'Historico de facturacao' });
  } catch (err) { next(err); }
}

module.exports = { createCheckout, confirmCheckout, webhookPaypal, getBillingHistory };
