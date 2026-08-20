const { supabaseAdmin } = require('../config/supabase');
const { randomUUID } = require('crypto');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

function notificarOperador(operatorId, notification_type, content, link) {
  return supabaseAdmin.from('notifications').insert({ operator_id: operatorId, notification_type, content, link })
    .then(({ error }) => { if (error) console.error('[Parcerias] Erro ao notificar:', error.message); });
}

function toRow(body) {
  const row = {};
  if (body.name !== undefined) row.name = body.name;
  if (body.partner_type !== undefined) row.partner_type = body.partner_type;
  if (body.partnership_type !== undefined) row.partnership_type = body.partnership_type;
  if (body.commission_pct !== undefined) row.commission_pct = Number(body.commission_pct) || 0;
  if (body.avg_booking_value !== undefined) row.avg_booking_value = Number(body.avg_booking_value) || 0;
  if (body.message_pt !== undefined) row.message_pt = body.message_pt || null;
  if (body.message_en !== undefined) row.message_en = body.message_en || null;
  if (body.active !== undefined) row.active = body.active;
  return row;
}

async function listar(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('partners').select('*').eq('operator_id', getOperatorId(req)).order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ data: data || [], message: 'Parceiros' });
  } catch (err) { next(err); }
}

async function criar(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome e obrigatorio', code: 'MISSING_FIELDS' });

    const { data, error } = await supabaseAdmin
      .from('partners').insert({ operator_id: getOperatorId(req), ...toRow(req.body) }).select().single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Parceiro criado' });
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('partners')
      .update({ ...toRow(req.body), updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('operator_id', getOperatorId(req))
      .select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Parceiro nao encontrado', code: 'NOT_FOUND' });
    return res.json({ data, message: 'Parceiro actualizado' });
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const { data: linha } = await supabaseAdmin
      .from('partners').select('status, partnership_group_id').eq('id', req.params.id).eq('operator_id', operatorId).maybeSingle();
    if (!linha) return res.status(404).json({ error: 'Parceiro nao encontrado', code: 'NOT_FOUND' });

    /* Um pedido ainda pendente cancelado por qualquer um dos lados nao deve
       deixar a linha do outro lado pendurada para sempre num pedido que nao
       vai a lado nenhum -- apaga as duas. Parcerias ja aceites/recusadas so
       apagam a propria linha (remover da minha lista, nao um "desfazer
       parceria" para os dois lados). */
    if (linha.status === 'pending' && linha.partnership_group_id) {
      const { error } = await supabaseAdmin.from('partners').delete().eq('partnership_group_id', linha.partnership_group_id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from('partners').delete().eq('id', req.params.id).eq('operator_id', operatorId);
      if (error) throw error;
    }
    return res.json({ message: 'Parceiro eliminado' });
  } catch (err) { next(err); }
}

async function registarReserva(req, res, next) {
  try {
    const { direction, delta } = req.body;
    if (!['sent', 'received'].includes(direction)) return res.status(400).json({ error: 'Direccao invalida', code: 'INVALID_DIRECTION' });
    const inc = Number(delta) || 1;

    const { data: parceiro } = await supabaseAdmin
      .from('partners').select('bookings_sent, bookings_received').eq('id', req.params.id).eq('operator_id', getOperatorId(req)).maybeSingle();
    if (!parceiro) return res.status(404).json({ error: 'Parceiro nao encontrado', code: 'NOT_FOUND' });

    const updates = direction === 'sent'
      ? { bookings_sent: parceiro.bookings_sent + inc }
      : { bookings_received: parceiro.bookings_received + inc };

    const { data, error } = await supabaseAdmin
      .from('partners').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw error;
    return res.json({ data, message: 'Reservas registadas' });
  } catch (err) { next(err); }
}

/* Pesquisa de operadores reais para escolher como parceiro -- scoped a esta
   funcionalidade (so campos nao sensiveis, so operadores com onboarding
   concluido, nunca o proprio operador). Nao e um directorio geral. */
async function pesquisarOperadores(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ data: [], message: 'Pesquisa demasiado curta' });

    const { data, error } = await supabaseAdmin
      .from('operators')
      .select('id, name, slug, logo_url, operator_type')
      .ilike('name', `%${q}%`)
      .eq('onboarding_complete', true)
      .neq('id', getOperatorId(req))
      .limit(10);
    if (error) throw error;
    return res.json({ data: data || [], message: 'Operadores encontrados' });
  } catch (err) { next(err); }
}

/* Pedido de parceria a um operador real -- cria DUAS linhas (uma por cada
   lado, ligadas por partnership_group_id) em vez de uma linha partilhada,
   para nao ter de inverter o significado de bookings_sent/bookings_received
   consoante quem esta a ver -- cada lado le sempre a sua propria linha,
   exactamente como ja acontecia para parceiros de texto livre. */
async function criarPedidoParceria(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const { partner_operator_id, partnership_type, commission_pct, avg_booking_value, message_pt, message_en } = req.body;

    if (!partner_operator_id) {
      return res.status(400).json({ error: 'partner_operator_id e obrigatorio', code: 'MISSING_FIELDS' });
    }
    if (partner_operator_id === operatorId) {
      return res.status(400).json({ error: 'Nao podes ser parceiro de ti proprio', code: 'INVALID_PARTNER' });
    }

    const { data: alvo } = await supabaseAdmin
      .from('operators').select('id, name, operator_type').eq('id', partner_operator_id).eq('onboarding_complete', true).maybeSingle();
    if (!alvo) return res.status(404).json({ error: 'Operador nao encontrado', code: 'NOT_FOUND' });

    const { data: existente } = await supabaseAdmin
      .from('partners')
      .select('id')
      .in('status', ['pending', 'accepted'])
      .or(`and(operator_id.eq.${operatorId},partner_operator_id.eq.${partner_operator_id}),and(operator_id.eq.${partner_operator_id},partner_operator_id.eq.${operatorId})`)
      .maybeSingle();
    if (existente) {
      return res.status(409).json({ error: 'Ja existe uma parceria (pendente ou activa) com este operador', code: 'ALREADY_EXISTS' });
    }

    const proprio = req.operator;
    const partnershipGroupId = randomUUID();
    const camposComuns = {
      partnership_type: partnership_type || 'recommendation',
      commission_pct:     Number(commission_pct) || 0,
      avg_booking_value:  Number(avg_booking_value) || 0,
      message_pt: message_pt || null,
      message_en: message_en || null,
      status: 'pending',
      partnership_group_id: partnershipGroupId,
      requested_by_operator_id: operatorId,
    };

    const { data, error } = await supabaseAdmin.from('partners').insert([
      { operator_id: operatorId, partner_operator_id: alvo.id, partner_type: alvo.operator_type, name: alvo.name, ...camposComuns },
      { operator_id: alvo.id, partner_operator_id: operatorId, partner_type: proprio.operator_type, name: proprio.name, ...camposComuns },
    ]).select();
    if (error) throw error;

    notificarOperador(alvo.id, 'partnership_request', `${proprio.name} quer ser seu parceiro`, '/parcerias?tab=pedidos');

    return res.status(201).json({ data: data.find(r => r.operator_id === operatorId), message: 'Pedido de parceria enviado' });
  } catch (err) { next(err); }
}

/* So o destinatario do pedido (dono da linha respondida) pode aceitar/
   recusar -- actualiza as DUAS linhas do partnership_group_id, ja que a
   posse da linha do destinatario confirma a legitimidade da resposta. */
async function responderPedidoParceria(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const { status } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status invalido', code: 'INVALID_STATUS' });
    }

    const { data: linha } = await supabaseAdmin
      .from('partners').select('*').eq('id', req.params.id).eq('operator_id', operatorId).maybeSingle();
    if (!linha) return res.status(404).json({ error: 'Pedido nao encontrado', code: 'NOT_FOUND' });
    if (linha.status !== 'pending') {
      return res.status(400).json({ error: 'Este pedido ja foi respondido', code: 'ALREADY_RESPONDED' });
    }
    if (linha.requested_by_operator_id === operatorId) {
      return res.status(403).json({ error: 'Nao podes responder ao teu proprio pedido', code: 'FORBIDDEN' });
    }

    const { data, error } = await supabaseAdmin
      .from('partners')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('partnership_group_id', linha.partnership_group_id)
      .select();
    if (error) throw error;

    const proprio = req.operator;
    const tipo = status === 'accepted' ? 'partnership_accepted' : 'partnership_rejected';
    const texto = status === 'accepted'
      ? `${proprio.name} aceitou o teu pedido de parceria`
      : `${proprio.name} recusou o teu pedido de parceria`;
    notificarOperador(linha.partner_operator_id, tipo, texto, '/parcerias');

    return res.json({ data: data.find(r => r.operator_id === operatorId), message: `Pedido ${status === 'accepted' ? 'aceite' : 'recusado'}` });
  } catch (err) { next(err); }
}

module.exports = {
  listar, criar, actualizar, eliminar, registarReserva,
  pesquisarOperadores, criarPedidoParceria, responderPedidoParceria,
};
