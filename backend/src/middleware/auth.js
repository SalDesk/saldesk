const { supabaseAdmin } = require('../config/supabase');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido', code: 'UNAUTHORIZED' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Token inválido ou expirado', code: 'INVALID_TOKEN' });
  }

  req.user = user;

  const { data: operator } = await supabaseAdmin
    .from('operators')
    .select('*')
    .eq('user_id', user.id)
    .single();

  req.operator = operator || null;
  next();
}

module.exports = authMiddleware;
