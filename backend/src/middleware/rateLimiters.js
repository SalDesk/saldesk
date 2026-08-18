const rateLimit = require('express-rate-limit');

/* Extraido de server.js para poder ser reutilizado por rotas individuais
   (ex: travelerAuth.js aplica authLimiter por rota em vez de ao router
   inteiro, para a nova rota /session poder usar publicLimiter em vez de
   authLimiter -- ver travelerAuth.js). */
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiadas tentativas.', code: 'RATE_LIMIT' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiadas tentativas de autenticacao.', code: 'RATE_LIMIT' },
});

module.exports = { publicLimiter, authLimiter };
