const { supabaseAdmin, supabaseAnon } = require('../config/supabase');

async function register(req, res, next) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password e nome são obrigatórios', code: 'MISSING_FIELDS' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres', code: 'WEAK_PASSWORD' });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        return res.status(409).json({ error: 'Email já registado', code: 'EMAIL_EXISTS' });
      }
      return res.status(400).json({ error: error.message, code: 'REGISTER_ERROR' });
    }

    return res.status(201).json({
      data: { user_id: data.user.id, email: data.user.email },
      message: 'Conta criada com sucesso'
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password são obrigatórios', code: 'MISSING_FIELDS' });
    }

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ error: 'Credenciais inválidas', code: 'INVALID_CREDENTIALS' });
    }

    const { data: operator } = await supabaseAdmin
      .from('operators')
      .select('*')
      .eq('user_id', data.user.id)
      .single();

    return res.json({
      data: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: data.user,
        operator: operator || null
      },
      message: 'Login efectuado com sucesso'
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res) {
  return res.json({
    data: { user: req.user, operator: req.operator },
    message: 'Utilizador autenticado'
  });
}

module.exports = { register, login, getMe };
