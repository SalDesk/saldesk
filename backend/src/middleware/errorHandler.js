const { addLog } = require('../services/logStore');

function errorHandler(err, req, res, next) {
  const status  = err.status || 500;
  const message = err.message || 'Erro interno do servidor';

  if (status >= 500) {
    addLog({
      level:    'error',
      endpoint: `${req.method} ${req.path}`,
      message,
      code:     status,
      ip:       req.ip || '',
    });
  }

  console.error(`[ERRO] ${message}`, err.stack);
  res.status(status).json({ error: message, code: err.code || 'INTERNAL_ERROR' });
}

module.exports = errorHandler;
