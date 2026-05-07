const cron = require('node-cron');
const { supabaseAdmin } = require('../config/supabase');
const { enviarEmail } = require('../helpers/emailHelper');
const { enviarWhatsApp } = require('../helpers/whatsappHelper');

// Substitui variáveis no template: {{nome}}, {{unidade}}, {{check_in}}, {{check_out}}, {{total}}
function renderTemplate(template, dados) {
  return template
    .replace(/\{\{nome\}\}/g, dados.customer_name || '')
    .replace(/\{\{unidade\}\}/g, dados.unit_name || '')
    .replace(/\{\{check_in\}\}/g, dados.check_in || '')
    .replace(/\{\{check_out\}\}/g, dados.check_out || '')
    .replace(/\{\{total\}\}/g, dados.total_price ? `${Number(dados.total_price).toFixed(2)} €` : '')
    .replace(/\{\{operador\}\}/g, dados.operator_name || '');
}

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
    .select('id, customer_id, customer_name, customer_email, customer_phone, check_in, check_out, total_price, customers(language), units(name)')
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
  const mensagem = renderTemplate(idioma === 'en' ? auto.message_en : auto.message_pt, {
    customer_name: reserva.customer_name,
    unit_name: reserva.units?.name,
    check_in: reserva.check_in,
    check_out: reserva.check_out,
    total_price: reserva.total_price,
    operator_name: reserva.operators?.name
  });

  let status = 'sent';
  let errorMessage = null;

  try {
    if (auto.channel === 'email') {
      const subject = idioma === 'en'
        ? (auto.subject?.replace('(PT)', '').trim() || 'Message from SalDesk')
        : (auto.subject || 'Mensagem SalDesk');

      await enviarEmail({ to: reserva.customer_email, subject, text: mensagem });
    } else if (auto.channel === 'whatsapp') {
      const telefone = reserva.customer_phone;
      await enviarWhatsApp({ to: telefone, body: mensagem });
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

function iniciarCron() {
  // Executa a cada hora, no início de cada hora
  cron.schedule('0 * * * *', processarAutomacoes, { timezone: 'Atlantic/Cape_Verde' });
  console.log('[Cron] Serviço de automações iniciado — executa a cada hora (fuso: Cabo Verde)');
}

module.exports = { iniciarCron, processarAutomacoes };
