function requireFounder(req, res, next) {
  const role = req.user?.user_metadata?.role;
  if (role !== 'FUNDADOR') {
    return res.status(403).json({ error: 'Acesso restrito ao Fundador', code: 'FORBIDDEN' });
  }
  next();
}

module.exports = requireFounder;
