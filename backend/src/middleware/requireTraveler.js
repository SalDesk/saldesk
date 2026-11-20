const { emailConfirmado } = require('../helpers/verificacaoEmailViajante');

function requireTraveler(req, res, next) {
  if (!req.traveler) {
    return res.status(403).json({ error: 'Autenticação de viajante necessária', code: 'TRAVELER_REQUIRED' });
  }
  /* reservas, recibos e avaliacoes so com o email confirmado (helpers/verificacaoEmailViajante.js) */
  req.traveler = { ...req.traveler, email_verificado: emailConfirmado(req.user) };
  next();
}

module.exports = requireTraveler;
