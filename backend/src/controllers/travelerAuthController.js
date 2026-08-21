const { supabaseAdmin } = require('../config/supabase');
const https = require('https');
const { addFailedLogin } = require('../services/logStore');
const { enviarEmail } = require('../helpers/emailHelper');
const { passwordResetEmail } = require('../helpers/emailTemplates');
const { COOKIE_NAME, setTravelerSessionCookie, clearTravelerSessionCookie } = require('../helpers/travelerSessionCookie');

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

/* O refresh_token do Supabase e rotativo -- de uso unico, invalidado assim
   que e trocado por um novo. O Discover (saldesk.cv) chama /session a cada
   pagina carregada, e se o utilizador tiver varios separadores abertos ao
   mesmo tempo, dois pedidos concorrentes tentam trocar o MESMO refresh_token
   -- so um ganha, o outro recebe erro e limpa a cookie inteira
   (clearTravelerSessionCookie), derrubando a sessao mesmo que a troca do
   vencedor tenha sido valida. Partilhar a mesma promise entre pedidos
   concorrentes com o mesmo token evita a corrida. */
const inFlightRefresh = new Map(); // refreshToken -> Promise<authJson>
function exchangeRefreshTokenOnce(refreshToken) {
  let p = inFlightRefresh.get(refreshToken);
  if (!p) {
    p = supabaseTokenRequest('refresh_token', { refresh_token: refreshToken });
    inFlightRefresh.set(refreshToken, p);
    p.finally(() => inFlightRefresh.delete(refreshToken));
  }
  return p;
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

    setTravelerSessionCookie(res, authJson.refresh_token);

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

/* Login via Google/Apple (OAuth) -- o handshake de redireccionamento e feito
   inteiramente pelo supabase-js no frontend (mesma pool de utilizadores
   Supabase Auth de sempre, so muda o metodo de login). Este endpoint so
   entra em jogo DEPOIS do frontend ja ter um access_token valido: verifica-o
   a serio contra o Supabase (nao um simples jwt.decode, ao contrario do
   authMiddleware -- aqui e preciso confirmar que o token e mesmo genuino
   antes de criar uma linha em travelers), e cria a linha em travelers na
   primeira vez que essa pessoa entra (o fluxo OAuth nao passa pelo
   formulario de registo, por isso o nome/email vem do proprio perfil
   Google/Apple). */
async function oauthComplete(req, res, next) {
  try {
    const { access_token, refresh_token } = req.body;
    if (!access_token) {
      return res.status(400).json({ error: 'access_token em falta', code: 'MISSING_FIELDS' });
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token);
    if (error || !user) {
      return res.status(401).json({ error: 'Sessao OAuth invalida', code: 'INVALID_TOKEN' });
    }

    let { data: traveler } = await supabaseAdmin
      .from('travelers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!traveler) {
      const nome = user.user_metadata?.full_name || user.user_metadata?.name
        || (user.email ? user.email.split('@')[0] : 'Viajante');
      const { data: novoTraveler, error: insertError } = await supabaseAdmin
        .from('travelers')
        .insert({ user_id: user.id, name: nome, email: user.email })
        .select()
        .single();
      if (insertError) throw insertError;
      traveler = novoTraveler;
    }

    if (refresh_token) setTravelerSessionCookie(res, refresh_token);

    return res.json({ data: { user, traveler }, message: 'Sessao OAuth associada' });
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

    /* Mesma protecao contra corrida de /session (ver exchangeRefreshTokenOnce)
       -- este refresh_token e o mesmo que a cookie do Discover pode estar a
       tentar usar ao mesmo tempo (ambos vem da mesma sessao Supabase), por
       isso partilham o mesmo mapa de pedidos em curso. */
    const authJson = await exchangeRefreshTokenOnce(refresh_token);
    if (!authJson.access_token || authJson.error) {
      return res.status(401).json({ error: 'Sessao expirada, faca login novamente', code: 'INVALID_REFRESH_TOKEN' });
    }

    const { data: traveler } = await supabaseAdmin
      .from('travelers')
      .select('*')
      .eq('user_id', authJson.user.id)
      .single();

    /* Supabase roda o refresh_token a cada uso (uso unico) -- reamar a
       cookie aqui e obrigatorio, senao a copia na cookie fica dessincronizada
       da copia que a app acabou de consumir e a proxima tentativa de usar a
       cookie falha. */
    setTravelerSessionCookie(res, authJson.refresh_token);

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
    clearTravelerSessionCookie(res);
    return res.json({ data: null, message: 'Sessao terminada' });
  } catch (err) {
    next(err);
  }
}

/* Chamado pelo site estatico Conect (saldesk.cv) ao carregar a pagina, com
   credentials:'include' -- se houver uma cookie de sessao valida (dominio
   .saldesk.cv), devolve um access_token fresco + o perfil do viajante, sem
   o Conect precisar de saber nada sobre passwords ou fluxos de login.
   "nao autenticado" nunca e um erro (200 sempre) -- e o estado normal para
   a maioria das visitas anonimas. */
async function session(req, res, next) {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAME];
    if (!refreshToken) {
      return res.json({ data: null, message: 'Sem sessao activa' });
    }

    const authJson = await exchangeRefreshTokenOnce(refreshToken);
    if (!authJson.access_token || authJson.error) {
      clearTravelerSessionCookie(res); // token invalido/ja consumido -- parar de o tentar reusar
      return res.json({ data: null, message: 'Sessao expirada' });
    }

    const { data: traveler } = await supabaseAdmin
      .from('travelers')
      .select('*')
      .eq('user_id', authJson.user.id)
      .single();

    if (!traveler) {
      clearTravelerSessionCookie(res);
      return res.json({ data: null, message: 'Sem sessao activa' });
    }

    setTravelerSessionCookie(res, authJson.refresh_token); // reamar com o token rodado

    return res.json({
      data: { access_token: authJson.access_token, traveler },
      message: 'Sessao valida',
    });
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

module.exports = { register, login, oauthComplete, refresh, getMe, logout, session, changePassword, resetPassword, forgotPassword };
