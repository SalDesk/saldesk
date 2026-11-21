/* Lugar retido: reservas publicas pagas com cartao (PayPal/SISP) guardam o lugar 30 minutos.
   Passado o prazo sem pagamento, expiram como "Pagamento nao concluido". */
const {
  verificarDisponibilidade, verificarDisponibilidadeMesa, verificarDisponibilidadeSlot,
  parseUnitMeta, hojeEHoraCaboVerde, slotJaComecou, normalizarHora,
} = require('./bookingHelpers');
const { padraoEmail, mesmoEmail } = require('./emailPadrao');

const MINUTOS_RETENCAO = 30;

// So estes metodos adiam os avisos e retem o lugar; dinheiro/outros nascem sem prazo.
function eMetodoCartao(metodo) {
  return metodo === 'paypal' || metodo === 'sisp';
}

function fimDaRetencao(agora = new Date()) {
  return new Date(agora.getTime() + MINUTOS_RETENCAO * 60 * 1000).toISOString();
}

// O lugar da propria reserva ainda esta livre? Exclui sempre reserva.id da contagem,
// para a reserva nao colidir consigo mesma.
async function lugarAindaLivre(supabase, reserva, agora = new Date()) {
  const { hoje } = hojeEHoraCaboVerde(agora);
  if (reserva.check_in < hoje) return false;

  // Mesa de restaurante
  if (reserva.duration_minutes && reserva.start_time) {
    return verificarDisponibilidadeMesa(
      supabase, reserva.unit_id, reserva.check_in, reserva.start_time, reserva.duration_minutes, reserva.id,
    );
  }

  const { data: unit } = await supabase
    .from('units').select('id, description').eq('id', reserva.unit_id).single();
  const slots = parseUnitMeta(unit).time_slots;

  // Actividade com horarios
  if (Array.isArray(slots) && slots.length && reserva.start_time) {
    const hora = normalizarHora(reserva.start_time);
    const slot = slots.find((s) => normalizarHora(s.time) === hora);
    if (!slot) return false;
    if (slotJaComecou(reserva.check_in, slot.time, agora)) return false;
    return verificarDisponibilidadeSlot(
      supabase, reserva.unit_id, reserva.check_in, hora, reserva.guests, slot.capacity, reserva.id, reserva.is_group_booking,
    );
  }

  // Alojamento / actividade sem horarios
  return verificarDisponibilidade(supabase, reserva.unit_id, reserva.check_in, reserva.check_out, reserva.id);
}

// Cancela de uma vez todas as reservas com cartao cujo prazo venceu sem pagamento e avisa o operador.
// So toca em reservas publicas ainda pendentes e por pagar: uma reserva que o operador confirmou
// a mao (status 'confirmed') nunca e expirada.
async function expirarReservasNaoPagas(supabase, agora = new Date()) {
  const { data, error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled', cancel_reason: 'payment_not_completed', updated_at: agora.toISOString() })
    .eq('source', 'public')
    .eq('status', 'pending')
    .eq('payment_status', 'pending')
    .in('payment_method', ['paypal', 'sisp'])
    .lt('hold_expires_at', agora.toISOString())
    .select('id, operator_id, customer_name, units(name)');
  if (error) throw error;

  const expiradas = data || [];
  for (const r of expiradas) {
    const { error: errNotif } = await supabase.from('notifications').insert({
      operator_id: r.operator_id,
      notification_type: 'payment_not_completed',
      content: `Pagamento não concluído — ${r.customer_name} — ${r.units?.name || ''}`,
      link: `/reservas/${r.id}`,
    });
    if (errNotif) console.error('[LugarRetido] Falha ao criar notificação:', errNotif.message);
  }
  return expiradas.length;
}

/* Reservas publicas do mesmo cliente, na mesma unidade e dia, feitas nos ultimos 30 minutos.
   O email e comparado sem curingas: o ILIKE pre-filtra (maiusculas iguais) e mesmoEmail confirma. */
async function reservasRecentesDoCliente(supabase, { operatorId, unitId, email, checkIn, agora = new Date() }) {
  const emailNormal = String(email || '').trim().toLowerCase();
  const desde = new Date(agora.getTime() - MINUTOS_RETENCAO * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('operator_id', operatorId)
    .eq('unit_id', unitId)
    .eq('check_in', checkIn)
    .eq('source', 'public')
    .in('status', ['pending', 'confirmed'])
    .gte('created_at', desde)
    .ilike('customer_email', padraoEmail(emailNormal));
  if (error) throw error;
  return (data || []).filter((r) => mesmoEmail(r.customer_email, emailNormal));
}

const horaCurta = (t) => (t === null || t === undefined || t === '' ? null : String(t).slice(0, 5));
const metodoDaLinha = (r) => (eMetodoCartao(r.payment_method) ? r.payment_method : null);
const nomeNormal = (n) => String(n || '').trim().toLowerCase();
const opcaoNormal = (o) => (o === undefined || o === null || String(o).trim() === '' ? null : String(o).trim());
// Opcao escolhida, lida da linha "Opção: <nome>" que o servidor escreve nas notas
const opcaoDaLinha = (r) => {
  const parte = String(r.notes || '').split(' | ').find((p) => p.startsWith('Opção: '));
  return parte ? opcaoNormal(parte.slice('Opção: '.length)) : null;
};

/* Separa as reservas recentes do cliente:
   - retidosProprios: lugares retidos com cartao ainda dentro do prazo (por pagar) e com o
     mesmo nome (um rececionista que reserva dois casais no mesmo email nao cancela o primeiro);
   - igualSemCartao: a mesma reserva sem cartao (enviada duas vezes) -- so se devolve se o
     total tambem for igual (o chamador compara depois de calcular o preco e o voucher);
   - igualCartao: a mesma reserva com cartao e lugar ainda retido -- renova-se o prazo.
   "A mesma" inclui o nome do cliente (o mesmo email pode reservar para outras pessoas), o
   motorista e a opcao da actividade (nova.opcao, o nome da opcao); um pedido com
   pre-pedido nunca e repetido. */
function classificarRecentes(recentes, nova, agora = new Date()) {
  const linhas = recentes || [];
  const retidosProprios = linhas.filter((r) => r.status === 'pending'
    && r.payment_status === 'pending'
    && eMetodoCartao(r.payment_method)
    && !!r.hold_expires_at
    && new Date(r.hold_expires_at).getTime() > agora.getTime()
    && nomeNormal(r.customer_name) === nomeNormal(nova.customerName));
  const igual = (r) => !nova.temPedido
    && r.check_out === nova.checkOut
    && horaCurta(r.start_time) === horaCurta(nova.startTime)
    && Number(r.guests) === Number(nova.guests)
    && !!r.is_group_booking === !!nova.isGroupBooking
    && nomeNormal(r.customer_name) === nomeNormal(nova.customerName)
    && !!r.driver_included === !!nova.driverIncluded
    && opcaoDaLinha(r) === opcaoNormal(nova.opcao)
    && metodoDaLinha(r) === (nova.metodo || null);
  return {
    igualSemCartao: linhas.find((r) => igual(r) && metodoDaLinha(r) === null),
    igualCartao: retidosProprios.find(igual),
    retidosProprios,
  };
}

/* Antes de criar ou capturar um pagamento online: o lugar ainda e desta reserva?
   - ja paga (qualquer estado): ALREADY_PAID, nunca se cobra outra vez;
   - pendente: renova o prazo (se tiver) e segue;
   - confirmada / com check-in: segue;
   - expirada por falta de pagamento: so volta a pendente se o lugar ainda estiver livre,
     com um update condicional (outra reserva pode ter ficado com ele entretanto);
   - tudo o resto (substituida, cancelada pelo operador...): HOLD_EXPIRED, nada se cobra. */
async function prepararPagamento(supabase, reservationId, agora = new Date()) {
  return decidirPagamento(supabase, reservationId, agora, true);
}

async function decidirPagamento(supabase, reservationId, agora, podeRepetir) {
  const { data: reserva, error } = await supabase
    .from('reservations')
    .select('id, unit_id, check_in, check_out, start_time, duration_minutes, guests, is_group_booking, status, cancel_reason, hold_expires_at, payment_status')
    .eq('id', reservationId)
    .maybeSingle();
  if (error) throw error;
  if (!reserva) return { ok: false, code: 'NOT_FOUND' };
  if (reserva.payment_status === 'paid') return { ok: false, code: 'ALREADY_PAID' };

  if (reserva.status === 'pending') {
    if (!reserva.hold_expires_at) return { ok: true };
    const { data: renovada, error: errRenovar } = await supabase
      .from('reservations')
      .update({ hold_expires_at: fimDaRetencao(agora) })
      .eq('id', reservationId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (errRenovar) throw errRenovar;
    if (renovada) return { ok: true };
    // Expirou entre a leitura e o update: decide de novo com o estado actual (uma vez).
    if (podeRepetir) return decidirPagamento(supabase, reservationId, agora, false);
    return { ok: false, code: 'HOLD_EXPIRED' };
  }

  if (reserva.status === 'confirmed' || reserva.status === 'checked_in') return { ok: true };

  if (reserva.status === 'cancelled' && reserva.cancel_reason === 'payment_not_completed') {
    if (!(await lugarAindaLivre(supabase, reserva, agora))) return { ok: false, code: 'HOLD_EXPIRED' };
    const { data: reposta, error: errRepor } = await supabase
      .from('reservations')
      .update({ status: 'pending', cancel_reason: null, hold_expires_at: fimDaRetencao(agora) })
      .eq('id', reservationId)
      .eq('status', 'cancelled')
      .eq('cancel_reason', 'payment_not_completed')
      .select('id')
      .maybeSingle();
    if (errRepor) {
      // 23P01: a restricao de exclusao da BD diz que o lugar ja e de outra reserva.
      if (errRepor.code === '23P01') return { ok: false, code: 'HOLD_EXPIRED' };
      throw errRepor;
    }
    return reposta ? { ok: true } : { ok: false, code: 'HOLD_EXPIRED' };
  }

  return { ok: false, code: 'HOLD_EXPIRED' };
}

/* O dinheiro entrou mas o lugar ja nao existe: regista o pagamento numa reserva cancelada
   ('paid_after_expiry') e avisa o operador para reembolsar ou remarcar. Uma reserva ja
   reembolsada nunca volta a 'paid' (a linha fica igual), mas o operador e avisado na mesma
   porque entrou dinheiro novo. Nunca lanca. */
async function registarPagoSemLugar(supabase, reservationId, { metodo, valor, campos = {} } = {}) {
  try {
    const colunas = '*, units(name), operators(name, email)';
    let { data: reserva, error } = await supabase
      .from('reservations')
      .update({
        status: 'cancelled', payment_status: 'paid', payment_method: metodo, amount_paid: valor,
        cancel_reason: 'paid_after_expiry', updated_at: new Date().toISOString(), ...campos,
      })
      .eq('id', reservationId)
      .neq('payment_status', 'refunded')
      .select(colunas)
      .maybeSingle();
    if (error) throw error;
    if (!reserva) {
      ({ data: reserva, error } = await supabase
        .from('reservations').select(colunas).eq('id', reservationId).maybeSingle());
      if (error) throw error;
    }
    if (!reserva) {
      console.error(`[LugarRetido] Pago sem lugar mas a reserva nao foi encontrada — reservation_id=${reservationId}`);
      return;
    }

    const texto = `Pagamento recebido mas o lugar já foi ocupado — reembolsar ou remarcar — ${reserva.customer_name} — ${reserva.units?.name || ''}`;
    const { error: errNotif } = await supabase.from('notifications').insert({
      operator_id: reserva.operator_id,
      notification_type: 'paid_after_expiry',
      content: texto,
      link: `/reservas/${reserva.id}`,
    });
    if (errNotif) console.error('[LugarRetido] Falha ao criar notificação:', errNotif.message);

    if (reserva.operators?.email) {
      // Carregado aqui: emailHelper puxa o cliente Supabase e o SendGrid, que os testes
      // deste modulo nao configuram.
      const { enviarEmail } = require('./emailHelper');
      // PayPal cobra sempre em euros e a SISP em escudos.
      const pago = metodo === 'sisp' ? `${valor} CVE via SISP` : `${valor} EUR via PayPal`;
      await enviarEmail({
        to: reserva.operators.email,
        subject: texto,
        text: `Olá ${reserva.operators.name || ''},\n\nRecebemos o pagamento (${pago}) da reserva de ${reserva.customer_name} — ${reserva.units?.name || ''}, mas o lugar já tinha sido ocupado. A reserva ficou cancelada e marcada como paga: reembolse o cliente ou combine outra data.\n\nReserva: ${reserva.id}`,
      });
    }
  } catch (err) {
    console.error(`[LugarRetido] Erro ao registar pago sem lugar — reservation_id=${reservationId}:`, err.message);
  }
}

/* Entrou dinheiro para uma reserva que ja tinha o pagamento registado (outra captura PayPal ou
   outra transaccao SISP): a reserva nao muda; o operador e avisado para reembolsar. Nunca lanca. */
async function registarPagamentoDuplicado(supabase, reservationId, { metodo, valor, referencia } = {}) {
  try {
    const { data: reserva, error } = await supabase
      .from('reservations')
      .select('*, units(name), operators(name, email)')
      .eq('id', reservationId)
      .maybeSingle();
    if (error) throw error;
    if (!reserva) {
      console.error(`[LugarRetido] Pagamento duplicado mas a reserva nao foi encontrada — reservation_id=${reservationId}`);
      return;
    }

    const assunto = 'Pagamento em duplicado recebido — reembolsar';
    const { error: errNotif } = await supabase.from('notifications').insert({
      operator_id: reserva.operator_id,
      notification_type: 'duplicate_payment',
      content: `${assunto} — ${reserva.customer_name} — ${reserva.units?.name || ''} (${referencia})`,
      link: `/reservas/${reserva.id}`,
    });
    if (errNotif) console.error('[LugarRetido] Falha ao criar notificação:', errNotif.message);

    if (reserva.operators?.email) {
      // Carregado aqui pela mesma razao de registarPagoSemLugar.
      const { enviarEmail } = require('./emailHelper');
      const pago = metodo === 'sisp' ? `${valor} CVE via SISP` : `${valor} EUR via PayPal`;
      await enviarEmail({
        to: reserva.operators.email,
        subject: assunto,
        text: `Olá ${reserva.operators.name || ''},\n\nRecebemos um segundo pagamento (${pago}, referência ${referencia}) da reserva de ${reserva.customer_name} — ${reserva.units?.name || ''}, que já estava paga. A reserva não foi alterada: reembolse este pagamento ao cliente.\n\nReserva: ${reserva.id}`,
      });
    }
  } catch (err) {
    console.error(`[LugarRetido] Erro ao registar pagamento duplicado — reservation_id=${reservationId}:`, err.message);
  }
}

module.exports = {
  MINUTOS_RETENCAO, eMetodoCartao, fimDaRetencao, lugarAindaLivre, expirarReservasNaoPagas,
  reservasRecentesDoCliente, classificarRecentes, prepararPagamento, registarPagoSemLugar,
  registarPagamentoDuplicado,
};
