function errorHandler(err, req, res, next) {
  console.error(`[ERRO] ${err.message}`, err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor',
    code: err.code || 'INTERNAL_ERROR'
  });
}

module.exports = errorHandler;
