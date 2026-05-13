const { supabaseAdmin } = require('../config/supabase');
const { emitToOperator, emitToUser } = require('../services/socketService');

async function listar(req, res, next) {
  try {
    const { recipient_id, group_id, limit = 50, offset = 0 } = req.query;
    let q = supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('operator_id', req.operator.id)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);
    if (group_id)     q = q.eq('group_id', group_id);
    else if (recipient_id) {
      q = q.or(`and(sender_id.eq.${req.userId},recipient_id.eq.${recipient_id}),and(sender_id.eq.${recipient_id},recipient_id.eq.${req.userId})`);
    }
    const { data, error, count } = await q;
    if (error) throw error;
    return res.json({ data: (data || []).reverse(), total: count, message: 'Mensagens listadas' });
  } catch (err) { next(err); }
}

async function enviar(req, res, next) {
  try {
    const { content, recipient_id, recipient_type, group_id, message_type = 'direct' } = req.body;
    if (!content) return res.status(400).json({ error: 'Conteudo obrigatorio', code: 'MISSING_FIELDS' });

    const senderId   = req.operator?.id || req.staffId;
    const senderType = req.operator ? 'manager' : 'staff';

    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({
        operator_id: req.operator.id, sender_id: senderId, sender_type: senderType,
        recipient_id: recipient_id || null, recipient_type: recipient_type || null,
        group_id: group_id || null, content, message_type,
      })
      .select().single();
    if (error) throw error;

    emitToOperator(req.operator.id, 'message:new', data);
    return res.status(201).json({ data, message: 'Mensagem enviada' });
  } catch (err) { next(err); }
}

async function marcarLida(req, res, next) {
  try {
    const { error } = await supabaseAdmin
      .from('messages').update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('operator_id', req.operator.id);
    if (error) throw error;
    emitToOperator(req.operator.id, 'message:read', { id: req.params.id });
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
    const { data, error } = await supabaseAdmin
      .from('message_groups').select('*').eq('operator_id', req.operator.id).order('name');
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

module.exports = { listar, enviar, marcarLida, unreadCount, listarGrupos, criarGrupo, adicionarMembro };
