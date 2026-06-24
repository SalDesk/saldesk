function requireOperatorOrStaff(req, res, next) {
  if (!req.operator && !req.staff) {
    return res.status(403).json({
      error: 'Acesso não autorizado',
      code: 'FORBIDDEN'
    });
  }
  next();
}

module.exports = requireOperatorOrStaff;
