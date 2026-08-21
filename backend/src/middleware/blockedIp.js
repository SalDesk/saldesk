const { isBlocked } = require('../services/ipBlockStore');

/* Aplica a lista de IPs bloqueados pelo fundador (Sistema -> Seguranca).
   Precisa de 'trust proxy' configurado em server.js para req.ip reflectir o
   IP real do visitante e nao o do Nginx -- ver comentario la. */
module.exports = function blockedIpMiddleware(req, res, next) {
  if (isBlocked(req.ip)) {
    return res.status(403).json({ error: 'Acesso bloqueado', code: 'IP_BLOCKED' });
  }
  next();
};
