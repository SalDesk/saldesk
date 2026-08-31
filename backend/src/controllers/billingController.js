const { supabaseAdmin } = require('../config/supabase');
const {
  createProduct, createPlan, createSubscription, getSubscription, cancelSubscription,
  verifyWebhookSignature,
} = require('../services/platformPaypalService');
const { construirPedidoPagamento, validarResposta } = require('../services/sispService');
const { loadPriceMap } = require('../helpers/pricing');
const { enviarEmail } = require('../helpers/emailHelper');
const { frontendBase } = require('../utils/urls');

const PLANS = ['starter', 'business', 'pro'];

/* Mesma taxa fixa ja usada em todo o resto do frontend (Financial.jsx,
   ServiceDetail.jsx, PublicBooking.jsx, etc.) para converter EUR->CVE --
   nunca uma taxa de cambio em tempo real, por consistencia com o resto
   da app. SISP so aceita escudos (currency code 132, ver sispService.js). */
const EUR_CVE = 110;

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

/* Garante que existe um plano PayPal (Product+Plan) para este tier,
   criando-o na primeira vez que for preciso -- sem passo manual de setup.
   Cacheia em platform_paypal_plans, chave primaria em `plan` evita duplicar
   em corridas concorrentes (upsert e idempotente). */
async function ensurePaypalPlan(plan, amount) {
  const { data: existing } = await supabaseAdmin
    .from('platform_paypal_plans').select('paypal_plan_id').eq('plan', plan).maybeSingle();
  if (existing) return existing.paypal_plan_id;

  const { data: anyPlan } = await supabaseAdmin
    .from('platform_paypal_plans').select('paypal_product_id').limit(1).maybeSingle();
  const productId = anyPlan?.paypal_product_id
    || (await chamarGatewayPaypal(() => createProduct())).id;

  const paypalPlan = await chamarGatewayPaypal(() => createPlan(productId, plan, amount));

  const { error: upsertError } = await supabaseAdmin.from('platform_paypal_plans').upsert({
    plan, paypal_product_id: productId, paypal_plan_id: paypalPlan.id,
  }, { onConflict: 'plan' });
  if (upsertError) throw upsertError;

  return paypalPlan.id;
}

/* ─── Subscricao ─────────────────────────────────────────────
   Fluxo de redirect: cria a subscricao na PayPal, guarda um
   platform_payments 'pending' com gateway_order_id = subscription_id
   (mesmo padrao ja usado no fluxo de pagamento unico da ronda anterior),
   devolve o link de aprovacao. Esta linha pending e a ligacao estavel
   entre "esta tentativa de checkout" e "este operador" -- disponivel
   desde o inicio, ANTES de confirmSubscription ou do webhook chegarem
   (evita corrida: qual dos dois chega primeiro nao importa, ambos
   encontram o mesmo pending pela mesma chave). Nao escreve nada em
   operators aqui -- so depois de confirmado, para nao alterar o plano/
   estado real do operador so por ter iniciado um checkout que pode nunca
   ser aprovado. */
async function createSubscriptionCheckout(req, res, next) {
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

    const planId = await ensurePaypalPlan(plan, amount);

    const base = frontendBase();
    const subscription = await chamarGatewayPaypal(() => createSubscription(
      planId,
      `${base}/definicoes/facturacao/sucesso`,
      `${base}/definicoes/facturacao/cancelado`
    ));

    const approveLink = (subscription.links || []).find((l) => l.rel === 'approve');
    if (!approveLink) throw new Error('PayPal nao devolveu link de aprovacao');

    const { error: insertError } = await supabaseAdmin.from('platform_payments').insert({
      operator_id: req.operator.id,
      plan,
      amount_eur: amount,
      gateway: 'paypal',
      gateway_order_id: subscription.id,
      status: 'pending',
    });
    if (insertError) throw insertError;

    return res.json({
      data: { approval_url: approveLink.href, subscription_id: subscription.id },
      message: 'Subscricao criada',
    });
  } catch (err) { next(err); }
}

/* Chamada pela pagina de sucesso (BillingSuccess.jsx) assim que a PayPal
   redirecciona de volta com ?subscription_id=... -- confirmacao imediata
   e sincrona, sem depender só do webhook assincrono. Idempotente: se o
   pending ja estiver 'completed' (ex. o webhook chegou primeiro), so
   devolve o estado actual sem reactivar. */
async function confirmSubscription(req, res, next) {
  try {
    const { subscription_id } = req.body;
    if (!subscription_id) return res.status(400).json({ error: 'subscription_id obrigatorio', code: 'MISSING_FIELDS' });

    const { data: payment } = await supabaseAdmin
      .from('platform_payments').select('*')
      .eq('gateway_order_id', subscription_id).eq('operator_id', req.operator.id).maybeSingle();
    if (!payment) return res.status(404).json({ error: 'Subscricao nao encontrada', code: 'NOT_FOUND' });

    if (payment.status === 'completed') {
      return res.json({ data: { status: 'active' }, message: 'Subscricao ja confirmada' });
    }

    const subscription = await chamarGatewayPaypal(() => getSubscription(subscription_id));
    if (subscription.status !== 'ACTIVE') {
      return res.status(402).json({ error: 'Subscricao ainda nao esta activa', code: 'SUBSCRIPTION_NOT_ACTIVE' });
    }

    await activarSubscricaoConfirmada(payment, subscription_id, subscription.billing_info?.next_billing_time);
    return res.json({ data: { status: 'active' }, message: 'Subscricao confirmada' });
  } catch (err) { next(err); }
}

/* Ponto unico onde uma subscricao passa a valer -- chamado por
   confirmSubscription (retorno sincrono do browser) OU pelo webhook
   PAYMENT.SALE.COMPLETED da primeira cobranca, o que chegar primeiro;
   qualquer um dos dois encontra o mesmo `payment` pending por
   gateway_order_id e marca 'completed', por isso nunca duplica. */
async function activarSubscricaoConfirmada(payment, subscriptionId, nextBillingTime) {
  const nowIso = new Date().toISOString();
  const paidUntil = nextBillingTime || new Date(Date.now() + 30 * 86400000).toISOString();

  await supabaseAdmin.from('platform_payments')
    .update({ status: 'completed', completed_at: nowIso })
    .eq('id', payment.id);

  const { data: current } = await supabaseAdmin
    .from('operators').select('name, email, notes_log').eq('id', payment.operator_id).single();
  const log = Array.isArray(current?.notes_log) ? current.notes_log : [];

  await supabaseAdmin.from('operators').update({
    plan: payment.plan,
    plan_status: 'active',
    paypal_subscription_id: subscriptionId,
    plan_paid_until: paidUntil,
    notes_log: [...log, { text: `Subscricao PayPal activada — plano "${payment.plan}", €${payment.amount_eur}`, at: nowIso, type: 'payment' }],
    updated_at: nowIso,
  }).eq('id', payment.operator_id);

  if (current?.email) {
    enviarEmail({
      to: current.email,
      subject: 'Subscricao activa — SalDesk',
      text: `Ola ${current.name},\n\nA tua subscricao SalDesk (plano ${payment.plan}, €${payment.amount_eur}/mes) esta activa e renova automaticamente.\n\nProxima cobranca: ${paidUntil.split('T')[0]}.\n\nObrigado por usares a SalDesk.`,
    }).catch(() => {});
  }
}

/* Renovacoes (2a cobranca em diante) -- ja nao ha pending platform_payments
   para estas, o operator ja tem paypal_subscription_id desde a primeira
   activacao. Cria uma linha nova por cada cobranca recorrente. */
async function registarRenovacao(operatorId, plan, amountEur, nextBillingTime) {
  const nowIso = new Date().toISOString();
  const paidUntil = nextBillingTime || new Date(Date.now() + 30 * 86400000).toISOString();

  await supabaseAdmin.from('platform_payments').insert({
    operator_id: operatorId, plan, amount_eur: amountEur,
    gateway: 'paypal', status: 'completed', completed_at: nowIso,
  });

  await supabaseAdmin.from('operators').update({
    plan_paid_until: paidUntil, plan_status: 'active', updated_at: nowIso,
  }).eq('id', operatorId);

  const { data: op } = await supabaseAdmin.from('operators').select('name, email').eq('id', operatorId).single();
  if (op?.email) {
    enviarEmail({
      to: op.email,
      subject: 'Pagamento confirmado — SalDesk',
      text: `Ola ${op.name},\n\nO teu pagamento de €${amountEur} para o plano ${plan} foi confirmado.\n\nA tua subscricao renova automaticamente. Proxima cobranca: ${paidUntil.split('T')[0]}.\n\nObrigado por usares a SalDesk.`,
    }).catch(() => {});
  }
}

async function cancelMySubscription(req, res, next) {
  try {
    const { data: operator } = await supabaseAdmin
      .from('operators').select('id, name, email, paypal_subscription_id, notes_log').eq('id', req.operator.id).single();
    if (!operator?.paypal_subscription_id) {
      return res.status(400).json({ error: 'Nao existe subscricao activa para cancelar', code: 'NO_SUBSCRIPTION' });
    }

    await chamarGatewayPaypal(() => cancelSubscription(operator.paypal_subscription_id, 'Cancelado pelo operador via SalDesk'));

    const nowIso = new Date().toISOString();
    const log = Array.isArray(operator.notes_log) ? operator.notes_log : [];
    await supabaseAdmin.from('operators').update({
      plan_status: 'cancelled',
      notes_log: [...log, { text: 'Subscricao PayPal cancelada pelo operador', at: nowIso, type: 'payment' }],
      updated_at: nowIso,
    }).eq('id', operator.id);

    return res.json({ data: { status: 'cancelled' }, message: 'Subscricao cancelada' });
  } catch (err) { next(err); }
}

async function actualizarEstadoPorSubscricao(subscriptionId, novoEstado, motivo) {
  const { data: op } = await supabaseAdmin
    .from('operators').select('id, name, email, notes_log').eq('paypal_subscription_id', subscriptionId).maybeSingle();
  if (!op) return;

  const nowIso = new Date().toISOString();
  const log = Array.isArray(op.notes_log) ? op.notes_log : [];
  await supabaseAdmin.from('operators').update({
    plan_status: novoEstado,
    notes_log: [...log, { text: motivo, at: nowIso, type: 'payment' }],
    updated_at: nowIso,
  }).eq('id', op.id);

  if (op.email) {
    const subject = novoEstado === 'suspended' ? 'A tua subscricao SalDesk foi suspensa' : 'A tua subscricao SalDesk foi cancelada';
    enviarEmail({
      to: op.email, subject,
      text: `Ola ${op.name},\n\n${motivo}\n\nPodes reactivar a qualquer momento em Definicoes > Facturacao.\n\nEquipa SalDesk`,
    }).catch(() => {});
  }
}

async function webhookPaypal(req, res, next) {
  res.status(200).json({ received: true });
  try {
    const valid = await verifyWebhookSignature(req.headers, req.body);
    if (!valid) { console.warn('[Billing Webhook] Assinatura invalida, ignorado'); return; }

    const event = req.body;

    if (event.event_type === 'PAYMENT.SALE.COMPLETED') {
      const subscriptionId = event.resource?.billing_agreement_id;
      if (!subscriptionId) return;
      const amount = Number(event.resource?.amount?.total || 0);

      /* Primeira cobranca: ainda ha um pending com este subscription_id
         como gateway_order_id -- pode ter chegado antes de
         confirmSubscription (corrida), activarSubscricaoConfirmada e
         idempotente por isso nao ha problema em qualquer ordem. */
      const { data: pending } = await supabaseAdmin
        .from('platform_payments').select('*')
        .eq('gateway_order_id', subscriptionId).eq('status', 'pending').maybeSingle();
      if (pending) {
        await activarSubscricaoConfirmada(pending, subscriptionId, null);
        return;
      }

      /* Renovacao: ja nao ha pending, o operator ja tem
         paypal_subscription_id da primeira activacao. */
      const { data: op } = await supabaseAdmin
        .from('operators').select('id, plan').eq('paypal_subscription_id', subscriptionId).maybeSingle();
      if (!op) return;
      await registarRenovacao(op.id, op.plan, amount, null);
      return;
    }

    if (event.event_type === 'BILLING.SUBSCRIPTION.SUSPENDED') {
      await actualizarEstadoPorSubscricao(event.resource?.id, 'suspended', 'A PayPal suspendeu a subscricao (falhas de pagamento repetidas).');
      return;
    }
    if (event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' || event.event_type === 'BILLING.SUBSCRIPTION.EXPIRED') {
      await actualizarEstadoPorSubscricao(event.resource?.id, 'cancelled', 'A subscricao PayPal foi cancelada ou expirou.');
      return;
    }
    if (event.event_type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') {
      /* So notifica -- a PayPal ainda vai retentar a cobranca pelo seu
         proprio calendario de dunning, nao mexe em plan_status aqui. */
      const { data: op } = await supabaseAdmin
        .from('operators').select('name, email').eq('paypal_subscription_id', event.resource?.id).maybeSingle();
      if (op?.email) {
        enviarEmail({
          to: op.email, subject: 'Falha no pagamento da subscricao SalDesk',
          text: `Ola ${op.name},\n\nNao foi possivel cobrar a tua subscricao SalDesk este mes. A PayPal vai tentar novamente automaticamente.\n\nSe o cartao mudou, actualiza-o directamente na tua conta PayPal.\n\nEquipa SalDesk`,
        }).catch(() => {});
      }
      return;
    }
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

/* ─── SISP Vinti4 (alternativa ao PayPal, pagamento manual mensal) ───
   Ao contrario da PayPal, o SISP nao tem API de subscricao recorrente --
   e sempre um redirect unico do browser do operador para a Vinti4 (ver
   sispService.js). Por isso esta via NUNCA marca paypal_subscription_id
   nem promete renovacao automatica: so estende plan_paid_until +30 dias,
   tal como uma renovacao normal, mas o operador tem de voltar a pagar
   manualmente no mes seguinte. Usa credenciais PROPRIAS da SalDesk
   (PLATFORM_SISP_POS_ID/POS_AUTH_CODE), nunca as de nenhum operador --
   essas continuam reservadas a paymentController.js, para os operadores
   cobrarem os SEUS clientes. */
async function createSispCheckout(req, res, next) {
  try {
    const { plan } = req.body;
    if (!PLANS.includes(plan)) {
      return res.status(400).json({ error: 'Plano invalido', code: 'INVALID_PLAN' });
    }

    const posID = process.env.PLATFORM_SISP_POS_ID;
    const posAutCode = process.env.PLATFORM_SISP_POS_AUTH_CODE;
    if (!posID || !posAutCode) {
      return res.status(503).json({ error: 'Pagamento SISP ainda nao esta disponivel para a subscricao SalDesk.', code: 'SISP_NOT_CONFIGURED' });
    }

    const priceMap = await loadPriceMap();
    const amountEur = priceMap[plan];
    if (!amountEur) {
      return res.status(400).json({ error: 'Preco nao configurado para este plano', code: 'PRICE_NOT_FOUND' });
    }
    const amountCve = Math.round(amountEur * EUR_CVE);

    const base = frontendBase();
    const apiBase = process.env.API_URL || 'http://localhost:3001';
    const pedido = construirPedidoPagamento({
      posID, posAutCode, amount: amountCve,
      urlMerchantResponse: `${apiBase}/api/v1/billing/sisp-callback`,
    });

    const { error: insertError } = await supabaseAdmin.from('platform_payments').insert({
      operator_id: req.operator.id,
      plan,
      amount_eur: amountEur,
      gateway: 'sisp',
      gateway_order_id: pedido.merchantRef,
      status: 'pending',
    });
    if (insertError) throw insertError;

    return res.json({
      data: { postUrl: pedido.postUrl, fields: pedido.fields },
      message: 'Pedido SISP preparado',
    });
  } catch (err) { next(err); }
}

/* Confirma um pagamento SISP -- NUNCA activa renovacao automatica (ver
   comentario acima). Reutilizavel se um dia a subscricao ja estiver
   activa e o operador simplesmente pagar mais um mes via SISP. */
async function activarPagamentoSisp(payment, transactionID) {
  const nowIso = new Date().toISOString();
  const paidUntil = new Date(Date.now() + 30 * 86400000).toISOString();

  await supabaseAdmin.from('platform_payments')
    .update({ status: 'completed', completed_at: nowIso })
    .eq('id', payment.id);

  const { data: current } = await supabaseAdmin
    .from('operators').select('name, email, notes_log').eq('id', payment.operator_id).single();
  const log = Array.isArray(current?.notes_log) ? current.notes_log : [];

  await supabaseAdmin.from('operators').update({
    plan: payment.plan,
    plan_status: 'active',
    plan_paid_until: paidUntil,
    notes_log: [...log, { text: `Pagamento SISP confirmado — plano "${payment.plan}", €${payment.amount_eur} (ref. ${transactionID})`, at: nowIso, type: 'payment' }],
    updated_at: nowIso,
  }).eq('id', payment.operator_id);

  if (current?.email) {
    enviarEmail({
      to: current.email,
      subject: 'Pagamento confirmado — SalDesk',
      text: `Ola ${current.name},\n\nO teu pagamento de €${payment.amount_eur} (plano ${payment.plan}) via SISP foi confirmado.\n\nA tua conta esta activa ate ${paidUntil.split('T')[0]}. Ao contrario do PayPal, o SISP nao renova automaticamente -- volta a Definicoes > Facturacao para pagar novamente antes dessa data.\n\nObrigado por usares a SalDesk.`,
    }).catch(() => {});
  }
}

/* Callback publico -- a Vinti4 faz POST DIRECTO para aqui apos o 3D
   Secure, no browser do proprio operador (nao servidor-a-servidor, ver
   sispService.js). Por isso responde sempre com um redirect, nunca JSON --
   mesmo padrao ja usado em paymentController.js's sispCallback. */
async function sispCallback(req, res, next) {
  const base = frontendBase();
  try {
    const merchantRef = req.body.merchantRespMerchantRef;
    const { data: payment } = await supabaseAdmin
      .from('platform_payments').select('*')
      .eq('gateway_order_id', merchantRef).eq('gateway', 'sisp').eq('status', 'pending')
      .maybeSingle();

    if (!payment) return res.redirect(`${base}/definicoes/facturacao/cancelado`);

    const resultado = validarResposta(process.env.PLATFORM_SISP_POS_AUTH_CODE, req.body);

    if (resultado.status === 'paid') {
      await activarPagamentoSisp(payment, resultado.transactionID);
      return res.redirect(`${base}/definicoes/facturacao/sucesso?gateway=sisp`);
    }

    if (resultado.status === 'cancelled') {
      return res.redirect(`${base}/definicoes/facturacao/cancelado`);
    }

    console.error('[Billing SISP Callback] Pagamento nao validado:', resultado.status, resultado.errorDescription || '');
    return res.redirect(`${base}/definicoes/facturacao/cancelado?erro=${resultado.status}`);
  } catch (err) {
    console.error('[Billing SISP Callback] Erro:', err.message);
    return res.redirect(`${base}/definicoes/facturacao/cancelado`);
  }
}

module.exports = {
  createSubscriptionCheckout, confirmSubscription, cancelMySubscription,
  webhookPaypal, getBillingHistory,
  createSispCheckout, sispCallback,
};
