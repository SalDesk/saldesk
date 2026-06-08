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

module.exports = {
  addLog, getLogs, clearLogs,
  addSecurityEvent, getSecurityLogs,
  addFailedLogin, getFailedLogins,
};
