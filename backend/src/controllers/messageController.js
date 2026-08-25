const { supabaseAdmin } = require('../config/supabase');
const { emitToOperator } = require('../services/socketService');
const { enviarEmail } = require('../helpers/emailHelper');
const { enviarWhatsApp } = require('../helpers/whatsappHelper');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

function getSenderId(req) {
  return req.operator?.id || req.staff?.id;
}

async function listar(req, res, next) {
  try {
    const { recipient_id, group_id, limit = 50, offset = 0 } = req.query;
    const operatorId = getOperatorId(req);
    const currentId  = getSenderId(req);

    let q = supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('operator_id', operatorId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (group_id) {
      q = q.eq('group_id', group_id);
    } else if (recipient_id) {
      q = q.or(`and(sender_id.eq.${currentId},recipient_id.eq.${recipient_id}),and(sender_id.eq.${recipient_id},recipient_id.eq.${currentId})`);
    }

    const { data, error, count } = await q;
    if (error) throw error;
    return res.json({ data: (data || []).reverse(), total: count, message: 'Mensagens listadas' });
  } catch (err) { next(err); }
}

async function enviar(req, res, next) {
  try {
    const { content, recipient_id, recipient_type, group_id, message_type = 'direct', channel = 'internal' } = req.body;
    if (!content) return res.status(400).json({ error: 'Conteudo obrigatorio', code: 'MISSING_FIELDS' });

    const operatorId = getOperatorId(req);
    const senderId   = getSenderId(req);
    const senderType = req.operator ? 'manager' : 'staff';

    /* Verify group belongs to this operator */
    if (group_id) {
      const { data: grupo } = await supabaseAdmin
        .from('message_groups').select('operator_id').eq('id', group_id).single();
      if (!grupo || grupo.operator_id !== operatorId) {
        return res.status(403).json({ error: 'Acesso negado', code: 'FORBIDDEN' });
      }
    }

    /* Hospede (cliente real) do chat publico ja recebe a mensagem a serio
       via o historico/polling do proprio widget (ver sendGuestChatMessage/
       getGuestChatHistory em publicController.js) -- isso NAO depende de
       email/WhatsApp. So quando o operador escolhe explicitamente um desses
       canais (para alcancar um cliente que nao esta com a pagina aberta)
       e que se tenta a entrega externa a serio, e so essa tentativa pode
       falhar -- antes disto, uma mensagem 'internal' era sempre forcada a
       email e aparecia com "Falha ao entregar" mesmo tendo chegado bem ao
       widget, o que era enganoso. */
    let effectiveChannel = 'internal';
    let deliveryStatus   = null;
    if (recipient_type === 'guest') {
      if (!recipient_id) return res.status(400).json({ error: 'Cliente obrigatorio', code: 'MISSING_FIELDS' });
      const { data: cliente } = await supabaseAdmin
        .from('customers').select('name, email, phone').eq('id', recipient_id).eq('operator_id', operatorId).single();
      if (!cliente) return res.status(404).json({ error: 'Cliente nao encontrado', code: 'NOT_FOUND' });

      if (channel === 'email' || channel === 'whatsapp') {
        effectiveChannel = channel;
        try {
          if (effectiveChannel === 'whatsapp') {
            await enviarWhatsApp({ to: cliente.phone, body: content });
          } else {
            await enviarEmail({ to: cliente.email, subject: `Nova mensagem de ${req.operator?.name || 'a equipa'}`, text: content });
          }
          deliveryStatus = 'sent';
        } catch (err) {
          console.error('[Messages] Falha ao entregar mensagem ao cliente:', err.message);
          deliveryStatus = 'failed';
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({
        operator_id:     operatorId,
        sender_id:       senderId,
        sender_type:     senderType,
        recipient_id:    recipient_id   || null,
        recipient_type:  recipient_type || null,
        group_id:        group_id       || null,
        content,
        message_type,
        channel:         effectiveChannel,
        delivery_status: deliveryStatus,
      })
      .select().single();
    if (error) throw error;

    emitToOperator(operatorId, 'message:new', data);
    return res.status(201).json({ data, message: 'Mensagem enviada' });
  } catch (err) { next(err); }
}

/* Ultima mensagem de cada conversa (staff, grupo ou hospede), para a
   barra lateral poder ordenar por ordem de chegada em vez de uma ordem
   fixa. Reduzido em JS a partir das mensagens mais recentes do operador
   -- uma conversa sem nenhuma mensagem nos ultimos 500 registos so fica
   de fora do mapa (sobe para o fim da lista, comportamento aceitavel:
   500 mensagens cobrem largamente a actividade recente de qualquer
   operador real). */
async function listarUltimaActividade(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const currentId  = getSenderId(req);

    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('sender_id, recipient_id, group_id, created_at')
      .eq('operator_id', operatorId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;

    const ultima = {};
    for (const m of (data || [])) {
      const cid = m.group_id || (m.sender_id === currentId ? m.recipient_id : m.sender_id);
      if (cid && !ultima[cid]) ultima[cid] = m.created_at;
    }
    return res.json({ data: ultima, message: 'Actividade recente' });
  } catch (err) { next(err); }
}

async function marcarLida(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const { error } = await supabaseAdmin
      .from('messages').update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('operator_id', operatorId);
    if (error) throw error;
    emitToOperator(operatorId, 'message:read', { id: req.params.id });
    return res.json({ data: null, message: 'Marcada como lida' });
  } catch (err) { next(err); }
}

async function unreadCount(req, res, next) {
  try {
    const { count, error } = await supabaseAdmin
      .from('messages').select('*', { count: 'exact', head: true })
      .eq('operator_id', req.operator.id).eq('is_read', false).neq('sender_type', 'manager');
    if (error) throw error;
    return res.json({ data: { count: count || 0 }, message: 'Contagem de nao lidas' });
  } catch (err) { next(err); }
}

async function listarGrupos(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const { data, error } = await supabaseAdmin
      .from('message_groups').select('*').eq('operator_id', operatorId).order('name');
    if (error) throw error;
    return res.json({ data, message: 'Grupos listados' });
  } catch (err) { next(err); }
}

async function criarGrupo(req, res, next) {
  try {
    const { name, description, members = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio', code: 'MISSING_FIELDS' });
    const { data, error } = await supabaseAdmin
      .from('message_groups')
      .insert({ operator_id: req.operator.id, name, description: description || null, created_by: req.operator.id, members })
      .select().single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Grupo criado' });
  } catch (err) { next(err); }
}

async function adicionarMembro(req, res, next) {
  try {
    const { member_id } = req.body;
    const { data: grupo } = await supabaseAdmin
      .from('message_groups').select('members').eq('id', req.params.id).eq('operator_id', req.operator.id).single();
    if (!grupo) return res.status(404).json({ error: 'Grupo nao encontrado', code: 'NOT_FOUND' });
    const members = [...new Set([...(grupo.members || []), member_id])];
    const { data, error } = await supabaseAdmin
      .from('message_groups').update({ members, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    return res.json({ data, message: 'Membro adicionado' });
  } catch (err) { next(err); }
}

module.exports = { listar, enviar, marcarLida, unreadCount, listarGrupos, criarGrupo, adicionarMembro, listarUltimaActividade };
