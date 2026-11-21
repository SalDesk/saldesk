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

/* Separa as reservas recentes do cliente:
   - retidosProprios: lugares retidos com cartao ainda dentro do prazo (por pagar);
   - igualSemCartao: a mesma reserva sem cartao (enviada duas vezes) -- devolve-se esta;
   - igualCartao: a mesma reserva com cartao e lugar ainda retido -- renova-se o prazo. */
function classificarRecentes(recentes, nova, agora = new Date()) {
  const linhas = recentes || [];
  const retidosProprios = linhas.filter((r) => r.status === 'pending'
    && r.payment_status === 'pending'
    && eMetodoCartao(r.payment_method)
    && !!r.hold_expires_at
    && new Date(r.hold_expires_at).getTime() > agora.getTime());
  const igual = (r) => r.check_out === nova.checkOut
    && horaCurta(r.start_time) === horaCurta(nova.startTime)
    && Number(r.guests) === Number(nova.guests)
    && !!r.is_group_booking === !!nova.isGroupBooking
    && metodoDaLinha(r) === (nova.metodo || null);
  return {
    igualSemCartao: linhas.find((r) => igual(r) && metodoDaLinha(r) === null),
    igualCartao: retidosProprios.find(igual),
    retidosProprios,
  };
}

module.exports = {
  MINUTOS_RETENCAO, eMetodoCartao, fimDaRetencao, lugarAindaLivre, expirarReservasNaoPagas,
  reservasRecentesDoCliente, classificarRecentes,
};
