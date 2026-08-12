function requireTraveler(req, res, next) {
  if (!req.traveler) {
    return res.status(403).json({ error: 'Autenticação de viajante necessária', code: 'TRAVELER_REQUIRED' });
  }
  next();
}

module.exports = requireTraveler;
