const { supabaseAdmin, supabaseAnon } = require('../config/supabase');

async function register(req, res, next) {
  try {
    const { email, password, name } = req.body;

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        return res.status(409).json({ error: 'Email ja registado', code: 'EMAIL_EXISTS' });
      }
      return res.status(400).json({ error: error.message, code: 'REGISTER_ERROR' });
    }

    return res.status(201).json({
      data: { user_id: data.user.id, email: data.user.email },
      message: 'Conta criada com sucesso',
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ error: 'Credenciais invalidas', code: 'INVALID_CREDENTIALS' });
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
        operator: operator || null,
      },
      message: 'Login efectuado com sucesso',
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res) {
  return res.json({
    data: { user: req.user, operator: req.operator },
    message: 'Utilizador autenticado',
  });
}

async function logout(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      await supabaseAdmin.auth.admin.signOut(token);
    }
    return res.json({ data: null, message: 'Sessao terminada' });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { password } = req.body;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password });
    if (error) {
      return res.status(400).json({ error: error.message, code: 'PASSWORD_ERROR' });
    }
    return res.json({ data: null, message: 'Password alterada com sucesso' });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe, logout, changePassword };
