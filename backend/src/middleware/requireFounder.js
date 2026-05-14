function requireFounder(req, res, next) {
  const founderEmail = process.env.FOUNDER_EMAIL;
  if (!founderEmail) {
    return res.status(403).json({ error: 'Admin nao configurado', code: 'FORBIDDEN' });
  }
  if (req.user?.email !== founderEmail) {
    return res.status(403).json({ error: 'Acesso restrito ao fundador', code: 'FORBIDDEN' });
  }
  next();
}

module.exports = requireFounder;
