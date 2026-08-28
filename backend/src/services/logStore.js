const MAX = 100;

const apiLogs      = [];
const securityLogs = [];
const failedLogins = [];
let   seq          = 0;

function id() { return ++seq; }

/* ─── API error logs ─────────────────────────────────────── */
function addLog({ level = 'error', endpoint = '', message = '', code = 500, ip = '' }) {
  apiLogs.unshift({ id: id(), level, endpoint, message, code: String(code), ip, timestamp: new Date().toISOString() });
  if (apiLogs.length > MAX) apiLogs.length = MAX;
}

function getLogs(level, limit = 50) {
  let r = apiLogs;
  if (level && level !== 'all') r = r.filter(e => e.level === level);
  return r.slice(0, Math.min(limit, MAX));
}

function clearLogs() { apiLogs.length = 0; }

/* ─── Security / access logs ─────────────────────────────── */
function addSecurityEvent({ ip = '', user_agent = '', action = '', suspicious = false }) {
  securityLogs.unshift({ id: id(), ip, user_agent, action, suspicious, timestamp: new Date().toISOString() });
  if (securityLogs.length > MAX) securityLogs.length = MAX;
}

function getSecurityLogs(limit = 50) { return securityLogs.slice(0, limit); }

/* ─── Failed logins ──────────────────────────────────────── */
function addFailedLogin({ ip = '', email = '' }) {
  failedLogins.unshift({ id: id(), ip, email, timestamp: new Date().toISOString() });
  if (failedLogins.length > 50) failedLogins.length = 50;
}

function getFailedLogins(limit = 30) { return failedLogins.slice(0, limit); }

/* ─── Bloqueio de conta por tentativas falhadas ──────────────
   Antes disto, o "bloqueio" so existia no frontend (localStorage) --
   contornavel com um curl directo ao endpoint. Isto e a fonte de
   verdade real, por email (nao por IP -- um IP partilhado, ex. rede de
   hotel, nao deve bloquear todos os hospedes por causa de um). Em
   memoria, tal como o resto deste ficheiro -- perdido num restart do
   servidor, o mesmo trade-off ja aceite para os outros logs aqui. */
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS         = 15 * 60 * 1000;
const loginLocks         = new Map(); // email normalizado -> {count, lockedUntil}

function normEmail(email) { return String(email || '').toLowerCase().trim(); }

function recordFailedLoginAttempt(email) {
  const key = normEmail(email);
  if (!key) return { count: 0, lockedUntil: 0 };
  const cur   = loginLocks.get(key) || { count: 0, lockedUntil: 0 };
  const count = cur.count + 1;
  const next  = { count, lockedUntil: count >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0 };
  loginLocks.set(key, next);
  return next;
}

function getLoginLockState(email) {
  const key = normEmail(email);
  return loginLocks.get(key) || { count: 0, lockedUntil: 0 };
}

function clearLoginLock(email) {
  loginLocks.delete(normEmail(email));
}

module.exports = {
  addLog, getLogs, clearLogs,
  addSecurityEvent, getSecurityLogs,
  addFailedLogin, getFailedLogins,
  MAX_LOGIN_ATTEMPTS, recordFailedLoginAttempt, getLoginLockState, clearLoginLock,
};
