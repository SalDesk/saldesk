function requireOperator(req, res, next) {
  if (!req.operator) {
    return res.status(403).json({
      error: 'Onboarding não concluído. Crie o perfil do operador primeiro.',
      code: 'ONBOARDING_REQUIRED'
    });
  }
  next();
}

module.exports = requireOperator;
