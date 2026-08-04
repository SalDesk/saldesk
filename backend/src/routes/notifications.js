const express = require('express');
const router  = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');

router.use(auth);
router.use(reqOp);

router.post('/subscribe', async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: 'Subscricao obrigatoria', code: 'MISSING_FIELDS' });
    await supabaseAdmin.from('operators').update({ push_subscription: subscription }).eq('id', req.operator.id);
    return res.json({ data: null, message: 'Subscricao push guardada' });
  } catch (err) { next(err); }
});

router.delete('/unsubscribe', async (req, res, next) => {
  try {
    await supabaseAdmin.from('operators').update({ push_subscription: null }).eq('id', req.operator.id);
    return res.json({ data: null, message: 'Subscricao removida' });
  } catch (err) { next(err); }
});

router.get('/vapid-public-key', (_req, res) => {
  return res.json({ data: { key: process.env.VAPID_PUBLIC_KEY || null }, message: 'VAPID key publica' });
});

router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('operator_id', req.operator.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return res.json({ data, message: 'Notificacoes listadas' });
  } catch (err) { next(err); }
});

router.put('/:id/read', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('operator_id', req.operator.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Notificacao nao encontrada', code: 'NOT_FOUND' });
    return res.json({ data, message: 'Notificacao marcada como lida' });
  } catch (err) { next(err); }
});

module.exports = router;
