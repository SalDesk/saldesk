const { supabaseAdmin } = require('../config/supabase');
const { emitToAdmin }   = require('../services/socketService');

/* Lado do operador da conversa com o fundador (admin_messages) -- ate aqui
   so existia o lado do painel do fundador (AdminCommunications.jsx). O
   operador nunca tinha forma de ler nem responder as mensagens que o
   fundador lhe enviava. */
async function getConversation(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_messages')
      .select('*')
      .eq('operator_id', req.operator.id)
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) throw error;

    await supabaseAdmin
      .from('admin_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('operator_id', req.operator.id)
      .eq('sender_type', 'admin')
      .eq('is_read', false);

    /* sendConversationMessage tambem grava uma notification (founder_message)
       para o sino do Topbar -- sem isto, abrir a conversa por aqui (sidebar,
       link directo) limpa admin_messages mas deixa a notificacao por ler
       para sempre, so o clique no proprio sino a limpava. */
    await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('operator_id', req.operator.id)
      .eq('notification_type', 'founder_message')
      .eq('is_read', false);

    return res.json({ data: data || [] });
  } catch (err) { next(err); }
}

async function sendMessage(req, res, next) {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Conteudo obrigatorio' });

    const { data, error } = await supabaseAdmin.from('admin_messages').insert({
      operator_id: req.operator.id,
      sender_type: 'operator',
      content:     content.trim(),
    }).select().single();
    if (error) throw error;

    emitToAdmin('admin:message:new', data);
    return res.status(201).json({ data });
  } catch (err) { next(err); }
}

module.exports = { getConversation, sendMessage };
