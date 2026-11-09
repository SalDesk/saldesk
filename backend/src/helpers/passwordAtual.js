/* Verificacao da password ACTUAL antes de a alterar (PUT /auth/password e PUT /traveler-auth/password).
   Antes disto as duas rotas so recebiam a password nova: quem tivesse uma sessao aberta (ou um token
   roubado) mudava a password sem a saber.

   Reutiliza o bloqueio de tentativas do login (por email, em memoria, ver services/logStore.js) para
   que esta rota nao sirva para adivinhar a password actual sem limite. O pedido ao Supabase vem
   injectado (`tokenRequest`, o mesmo `supabaseTokenRequest` de cada controlador) para se poder
   testar sem rede. Devolve { ok: true } ou { ok: false, status, body }; erros de rede propagam-se. */

const {
  addFailedLogin, MAX_LOGIN_ATTEMPTS,
  recordFailedLoginAttempt, getLoginLockState, clearLoginLock,
} = require('../services/logStore');

function bloqueada(lockedUntil) {
  return {
    ok: false,
    status: 423,
    body: {
      error: 'Conta temporariamente bloqueada por demasiadas tentativas falhadas',
      code: 'ACCOUNT_LOCKED',
      retry_after_seconds: Math.ceil((lockedUntil - Date.now()) / 1000),
    },
  };
}

async function verificarPasswordActual({ email, password, ip = '', tokenRequest }) {
  const lock = getLoginLockState(email);
  if (lock.lockedUntil > Date.now()) return bloqueada(lock.lockedUntil);

  if (!password || typeof password !== 'string') {
    return { ok: false, status: 403, body: { error: 'Password actual incorrecta', code: 'INVALID_CURRENT_PASSWORD' } };
  }

  const authJson = await tokenRequest('password', { email, password });
  if (!authJson || !authJson.access_token || authJson.error) {
    addFailedLogin({ ip, email: email || '' });
    const novo = recordFailedLoginAttempt(email);
    if (novo.lockedUntil > Date.now()) return bloqueada(novo.lockedUntil);
    return {
      ok: false,
      status: 403,
      body: {
        error: 'Password actual incorrecta',
        code: 'INVALID_CURRENT_PASSWORD',
        attempts_remaining: Math.max(0, MAX_LOGIN_ATTEMPTS - novo.count),
      },
    };
  }

  clearLoginLock(email);
  return { ok: true };
}

module.exports = { verificarPasswordActual };
