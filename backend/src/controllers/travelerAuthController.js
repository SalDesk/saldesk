const { supabaseAdmin } = require('../config/supabase');
const https = require('https');
const { addFailedLogin } = require('../services/logStore');
const { enviarEmail } = require('../helpers/emailHelper');
const { passwordResetEmail } = require('../helpers/emailTemplates');

/* Chama o endpoint de token do Supabase Auth (password ou refresh_token grant) --
   mesma mecânica de authController.js, mesma pool de utilizadores Supabase Auth,
   só o discriminador (tabela travelers em vez de operators) é que muda. */
function supabaseTokenRequest(grantType, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=${grantType}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (r) => {
      let data = '';
      r.on('data', (chunk) => data += chunk);
      r.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function register(req, res, next) {
  try {
    const { email, password, name, phone } = req.body;

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: 'TRAVELER' },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        return res.status(409).json({ error: 'Email ja registado', code: 'EMAIL_EXISTS' });
      }
      return res.status(400).json({ error: error.message, code: 'REGISTER_ERROR' });
    }

    const { data: traveler, error: travelerError } = await supabaseAdmin
      .from('travelers')
      .insert({ user_id: data.user.id, name, email, phone: phone || null })
      .select()
      .single();

    if (travelerError) {
      /* Sem isto o utilizador Auth ficava orfao -- conseguia fazer login mas
         req.traveler nunca resolvia, bloqueando permanentemente em requireTraveler. */
      await supabaseAdmin.auth.admin.deleteUser(data.user.id).catch(() => {});
      return res.status(409).json({ error: 'Email ja registado', code: 'EMAIL_EXISTS' });
    }

    return res.status(201).json({
      data: { user_id: data.user.id, email: data.user.email, traveler },
      message: 'Conta criada com sucesso',
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const authJson = await supabaseTokenRequest('password', { email, password });
    if (!authJson.access_token || authJson.error) {
      addFailedLogin({ ip: req.ip || '', email: email || '' });
      return res.status(401).json({ error: 'Credenciais invalidas', code: 'INVALID_CREDENTIALS' });
    }

    const { data: traveler } = await supabaseAdmin
      .from('travelers')
      .select('*')
      .eq('user_id', authJson.user.id)
      .single();

    if (!traveler) {
      return res.status(403).json({ error: 'Esta conta nao e uma conta de viajante', code: 'NOT_TRAVELER' });
    }

    return res.json({
      data: {
        access_token: authJson.access_token,
        refresh_token: authJson.refresh_token,
        user: authJson.user,
        traveler,
      },
      message: 'Login efectuado com sucesso',
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: 'refresh_token em falta', code: 'MISSING_FIELDS' });
    }

    const authJson = await supabaseTokenRequest('refresh_token', { refresh_token });
    if (!authJson.access_token || authJson.error) {
      return res.status(401).json({ error: 'Sessao expirada, faca login novamente', code: 'INVALID_REFRESH_TOKEN' });
    }

    const { data: traveler } = await supabaseAdmin
      .from('travelers')
      .select('*')
      .eq('user_id', authJson.user.id)
      .single();

    return res.json({
      data: {
        access_token: authJson.access_token,
        refresh_token: authJson.refresh_token,
        user: authJson.user,
        traveler: traveler || null,
      },
      message: 'Sessao renovada',
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res) {
  return res.json({
    data: { user: req.user, traveler: req.traveler },
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

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token e password são obrigatórios', code: 'MISSING_FIELDS' });
    }

    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) {
      return res.status(400).json({ error: 'Link expirado ou inválido', code: 'INVALID_TOKEN' });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password });
    if (error) {
      return res.status(400).json({ error: error.message, code: 'PASSWORD_ERROR' });
    }

    return res.json({ data: null, message: 'Password definida com sucesso' });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  const generic = { data: null, message: 'Se o email existir, ira receber um link de recuperacao.' };
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório', code: 'MISSING_FIELDS' });
    }

    try {
      const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: 'https://app.saldesk.cv/viajante/recuperar-password' },
      });
      if (!error && link?.properties?.action_link) {
        const { subject, html, text } = passwordResetEmail({
          name: link.user?.user_metadata?.name,
          link: link.properties.action_link,
        });
        await enviarEmail({ to: email, subject, html, text });
      }
    } catch (err) {
      console.error('[Viajante ForgotPassword] Erro ao gerar/enviar link:', err.message);
    }

    return res.json(generic);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, getMe, logout, changePassword, resetPassword, forgotPassword };
