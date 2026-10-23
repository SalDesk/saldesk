const cron = require('node-cron');
const { supabaseAdmin } = require('../config/supabase');
const { enviarEmail } = require('../helpers/emailHelper');
// WhatsApp: as automacoes entram na outbox da camada de mensagens (wa.me: o humano abre o link).
// O helpers/whatsappHelper.js (Cloud API directa, numero global) fica so para o chat do painel.
const { enfileirarAutomacao } = require('../messaging/service');
const { nomeDoGuia } = require('../messaging/context');

// Variáveis das mensagens (modelos prontos e formulário manual): ver helpers/automationTemplate.js
const { renderTemplate } = require('../helpers/automationTemplate');

function addDias(dataStr, dias) {
  const d = new Date(dataStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().split('T')[0];
}

async function processarAutomacoes() {
  console.log('[Cron] A processar automações...');

  const hoje = new Date().toISOString().split('T')[0];

  const { data: automations, error } = await supabaseAdmin
    .from('automations')
    .select('*, operators(id, name)')
    .eq('active', true);

  if (error) {
    console.error('[Cron] Erro ao carregar automações:', error.message);
    return;
  }

  for (const auto of automations || []) {
    try {
      await processarUmaAutomacao(auto, hoje);
    } catch (err) {
      console.error(`[Cron] Erro na automação ${auto.id}:`, err.message);
    }
  }

  console.log('[Cron] Automações processadas.');
}

async function processarUmaAutomacao(auto, hoje) {
  let q = supabaseAdmin
    .from('reservations')
    .select('id, customer_id, customer_name, customer_email, customer_phone, check_in, check_out, start_time, total_price, customers(language), units(name)')
    .eq('operator_id', auto.operators.id)
    .neq('status', 'cancelled');

  switch (auto.trigger_type) {
    case 'booking_confirmed':
      // Todas as reservas confirmadas criadas depois desta automação
      q = q.eq('status', 'confirmed').gte('created_at', auto.created_at);
      break;
    case 'checkin_reminder':
      // Reservas com check-in amanhã
      q = q.eq('check_in', addDias(hoje, 1)).in('status', ['confirmed', 'checked_in']);
      break;
    case 'checkout_thanks':
      // Reservas com check-out ontem
      q = q.eq('check_out', addDias(hoje, -1)).eq('status', 'checked_out');
      break;
    case 'days_before_checkin':
      q = q
        .eq('check_in', addDias(hoje, auto.trigger_days))
        .in('status', ['confirmed', 'checked_in']);
      break;
    case 'days_after_checkout':
      q = q
        .eq('check_out', addDias(hoje, -auto.trigger_days))
        .eq('status', 'checked_out');
      break;
    default:
      return;
  }

  const { data: reservas } = await q;
  if (!reservas?.length) return;

  // Carregar IDs de reservas já processadas por esta automação
  const { data: logs } = await supabaseAdmin
    .from('automation_logs')
    .select('reservation_id')
    .eq('automation_id', auto.id);

  const jaEnviados = new Set((logs || []).map((l) => l.reservation_id));
  const pendentes = reservas.filter((r) => !jaEnviados.has(r.id));

  for (const reserva of pendentes) {
    await enviarMensagem(auto, reserva);
  }
}

async function enviarMensagem(auto, reserva) {
  const idioma = reserva.customers?.language || 'pt';
  const dados = {
    customer_name: reserva.customer_name,
    unit_name: reserva.units?.name,
    check_in: reserva.check_in,
    check_out: reserva.check_out,
    start_time: reserva.start_time,
    total_price: reserva.total_price,
    // a consulta das reservas nao traz o operador: vem da propria automacao
    operator_name: auto.operators?.name,
    guide_name: await nomeDoGuia(reserva.id),
  };
  const mensagem = renderTemplate(idioma === 'en' ? auto.message_en : auto.message_pt, dados);

  let status = 'sent';
  let errorMessage = null;

  try {
    if (auto.channel === 'email') {
      const subject = renderTemplate(idioma === 'en'
        ? (auto.subject?.replace('(PT)', '').trim() || 'Message from SalDesk')
        : (auto.subject || 'Mensagem SalDesk'), dados);

      await enviarEmail({ to: reserva.customer_email, subject, text: mensagem });
    } else if (auto.channel === 'whatsapp') {
      // Fica na outbox ate alguem abrir o link no painel (status 'sent' aqui = preparada).
      await enfileirarAutomacao({
        operatorId: auto.operators.id,
        reservationId: reserva.id,
        automationId: auto.id,
        to: reserva.customer_phone,
        locale: idioma,
        text: mensagem,
        display: { customerName: reserva.customer_name, tourName: reserva.units?.name || null, date: reserva.check_in },
      });
    }
  } catch (err) {
    status = 'failed';
    errorMessage = err.message;
    console.error(`[Cron] Falha ao enviar para reserva ${reserva.id}:`, err.message);
  }

  await supabaseAdmin.from('automation_logs').insert({
    automation_id: auto.id,
    reservation_id: reserva.id,
    customer_id: reserva.customer_id || null,
    channel: auto.channel,
    status,
    error_message: errorMessage
  });
}

/* ══════════════════════════════════════════
   ALERTAS DE EXPIRACAO — RH (documentos/certificacoes)
   Um email por operador por dia, com tudo o que expira nos proximos 7
   dias (ou ja expirado). Dedupe via staff_hr_alerts: cada item so gera
   um alerta por (kind, item_id, expiry_date) -- se o operador renovar o
   documento a data muda e o alerta liberta-se sozinho.
══════════════════════════════════════════ */
async function processarAlertasExpiracaoRH() {
  console.log('[Cron] A processar alertas de expiracao de RH...');

  const hoje = new Date().toISOString().split('T')[0];
  const em7Dias = addDias(hoje, 7);

  const [{ data: docs }, { data: certs }, { data: jaEnviados }] = await Promise.all([
    supabaseAdmin.from('staff_documents')
      .select('id, name, expiry_date, operator_id, staff(name)')
      .not('expiry_date', 'is', null).lte('expiry_date', em7Dias),
    supabaseAdmin.from('staff_certifications')
      .select('id, name, expiry_date, operator_id, staff(name)')
      .not('expiry_date', 'is', null).lte('expiry_date', em7Dias),
    supabaseAdmin.from('staff_hr_alerts').select('kind, item_id, expiry_date'),
  ]);

  const enviadoSet = new Set((jaEnviados || []).map((a) => `${a.kind}:${a.item_id}:${a.expiry_date}`));
  const items = [
    ...(docs || []).map((d) => ({ kind: 'document', ...d })),
    ...(certs || []).map((c) => ({ kind: 'certification', ...c })),
  ].filter((i) => !enviadoSet.has(`${i.kind}:${i.id}:${i.expiry_date}`));

  if (!items.length) { console.log('[Cron] Sem alertas de RH novos.'); return; }

  const porOperador = {};
  for (const item of items) {
    (porOperador[item.operator_id] ||= []).push(item);
  }

  const operatorIds = Object.keys(porOperador);
  const { data: operators } = await supabaseAdmin
    .from('operators').select('id, name, email, language').in('id', operatorIds);
  const operatorById = Object.fromEntries((operators || []).map((o) => [o.id, o]));

  for (const operatorId of operatorIds) {
    const op = operatorById[operatorId];
    if (!op?.email) continue;
    try {
      await enviarAlertaRH(op, porOperador[operatorId], hoje);
      const logs = porOperador[operatorId].map((i) => ({
        operator_id: operatorId, kind: i.kind, item_id: i.id, expiry_date: i.expiry_date,
      }));
      await supabaseAdmin.from('staff_hr_alerts').insert(logs);
    } catch (err) {
      console.error(`[Cron] Falha ao enviar alerta de RH para operador ${operatorId}:`, err.message);
    }
  }

  console.log(`[Cron] Alertas de RH enviados a ${operatorIds.length} operador(es).`);
}

async function enviarAlertaRH(operator, items, hoje) {
  const idioma = operator.language || 'pt';
  const linhas = items
    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))
    .map((i) => {
      const estado = i.expiry_date < hoje
        ? (idioma === 'en' ? 'EXPIRED' : 'EXPIRADO')
        : (idioma === 'en' ? 'expires' : 'expira em');
      return `- ${i.staff?.name || '?'}: "${i.name}" — ${estado} ${i.expiry_date}`;
    })
    .join('\n');

  const subject = idioma === 'en'
    ? `SalDesk RH: ${items.length} document(s)/certification(s) expiring soon`
    : `SalDesk RH: ${items.length} documento(s)/certificacao(oes) a expirar`;

  const text = idioma === 'en'
    ? `Hello ${operator.name},\n\nThe following staff documents/certifications are expiring soon or already expired:\n\n${linhas}\n\nRenew them from the RH section of your SalDesk dashboard.`
    : `Ola ${operator.name},\n\nOs seguintes documentos/certificacoes de colaboradores estao a expirar em breve ou ja expiraram:\n\n${linhas}\n\nRenova-os na seccao RH do teu painel SalDesk.`;

  await enviarEmail({ to: operator.email, subject, text });
}

async function sincronizarCanais() {
  console.log('[Cron] A sincronizar canais OTA...');
  try {
    const { supabaseAdmin: sb } = require('../config/supabase');
    const { addSyncJob } = require('../queues/queueManager');

    const { data: canais } = await sb
      .from('operator_channels')
      .select('id, operator_id, channel')
      .eq('is_active', true);

    for (const canal of canais || []) {
      await addSyncJob({ channelId: canal.id, operatorId: canal.operator_id, channel: canal.channel });
    }
    console.log(`[Cron] Sync iniciado para ${(canais || []).length} canal(is)`);
  } catch (err) {
    console.error('[Cron] Erro no sync de canais:', err.message);
  }
}

function iniciarCron() {
  cron.schedule('0 * * * *', processarAutomacoes, { timezone: 'Atlantic/Cape_Verde' });
  cron.schedule('*/15 * * * *', sincronizarCanais, { timezone: 'Atlantic/Cape_Verde' });
  cron.schedule('0 8 * * *', processarAlertasExpiracaoRH, { timezone: 'Atlantic/Cape_Verde' });
  console.log('[Cron] Servicos iniciados — automacoes (1h) + sync OTA (15min) + alertas RH (diario 08h)');
}

module.exports = { iniciarCron, processarAutomacoes, sincronizarCanais, processarAlertasExpiracaoRH };
