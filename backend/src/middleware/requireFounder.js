const { addSecurityEvent } = require('../services/logStore');

function requireFounder(req, res, next) {
  const role = req.user?.user_metadata?.role;
  if (role !== 'FUNDADOR') {
    return res.status(403).json({ error: 'Acesso restrito ao Fundador', code: 'FORBIDDEN' });
  }
  const hour       = new Date().getHours();
  const suspicious = hour < 7 || hour > 22;
  addSecurityEvent({
    ip:         req.ip || req.connection?.remoteAddress || '::1',
    user_agent: req.headers['user-agent'] || '',
    action:     `${req.method} ${req.originalUrl || req.path}`,
    suspicious,
  });
  next();
}

module.exports = requireFounder;
