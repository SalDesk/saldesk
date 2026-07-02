const { supabaseAdmin, supabaseAnon } = require('../config/supabase');
const https = require('https');
const { addFailedLogin } = require('../services/logStore');
const { enviarEmail } = require('../helpers/emailHelper');
const { passwordResetEmail } = require('../helpers/emailTemplates');

async function register(req, res, next) {
  try {
    const { email, password, name, invite_code } = req.body;

    let invite = null;
    if (invite_code) {
      const { data: inviteRow, error: inviteError } = await supabaseAdmin
        .from('invite_codes')
        .select('*')
        .eq('code', invite_code.trim().toUpperCase())
        .eq('active', true)
        .maybeSingle();

      if (inviteError) throw inviteError;
      if (!inviteRow || inviteRow.uses >= inviteRow.max_uses) {
        return res.status(400).json({ error: 'Codigo de convite invalido ou expirado', code: 'INVALID_INVITE' });
      }
      invite = inviteRow;
    }

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

    if (invite) {
      await supabaseAdmin.from('invite_codes').update({ uses: invite.uses + 1 }).eq('id', invite.id);
    }

    return res.status(201).json({
      data: { user_id: data.user.id, email: data.user.email },
      message: 'Conta criada com sucesso',
    });
  } catch (err) {
    next(err);
  }
}

async function validateInvite(req, res, next) {
  try {
    const { code } = req.body;
    if (!code || !code.trim()) {
      return res.json({ data: { valid: false } });
    }

    const { data, error } = await supabaseAdmin
      .from('invite_codes')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('active', true)
      .maybeSingle();

    if (error) throw error;

    const valid = !!data && data.uses < data.max_uses;
    return res.json({ data: { valid } });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  console.log('[LOGIN] Request recebido', req.body?.email);
  try {
    const { email, password } = req.body;

    const authJson = await new Promise((resolve, reject) => {
      const body = JSON.stringify({ email, password });
      const url = new URL(process.env.SUPABASE_URL + '/auth/v1/token?grant_type=password');
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_ANON_KEY,
          'Content-Length': Buffer.byteLength(body),
        },
      };
      const req2 = https.request(options, (r) => {
        let data = '';
        r.on('data', (chunk) => data += chunk);
        r.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
      });
      req2.on('error', reject);
      req2.write(body);
      req2.end();
    });
    if (!authJson.access_token || authJson.error) {
      addFailedLogin({ ip: req.ip || '', email: email || '' });
      return res.status(401).json({ error: 'Credenciais invalidas', code: 'INVALID_CREDENTIALS' });
    }
    const data = {
      session: { access_token: authJson.access_token, refresh_token: authJson.refresh_token },
      user: authJson.user,
    };

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

    // Nunca revelar se o email existe ou nao (anti-enumeracao)
    try {
      const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: 'https://app.saldesk.cv/reset-password' },
      });
      if (!error && link?.properties?.action_link) {
        const { subject, html, text } = passwordResetEmail({
          name: link.user?.user_metadata?.name,
          link: link.properties.action_link,
        });
        await enviarEmail({ to: email, subject, html, text });
      }
    } catch (err) {
      console.error('[ForgotPassword] Erro ao gerar/enviar link:', err.message);
    }

    return res.json(generic);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe, logout, changePassword, validateInvite, resetPassword, forgotPassword };
