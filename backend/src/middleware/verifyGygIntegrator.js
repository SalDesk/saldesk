/* Autenticacao das chamadas que a GetYourGuide faz PARA DENTRO do SalDesk
   (Availability Query, Reservation, Booking, etc.).
   Esqueleto de melhor esforco: usamos uma chave partilhada estatica no
   header X-ACCESS-TOKEN, seguindo a convencao vista no resto da API publica
   da GYG. O mecanismo real (pode ser diferente — mTLS, OAuth, outro header)
   so e confirmado quando formos aceites como Integrator e virmos o spec
   tecnico verdadeiro no Integrator Portal. Ajustar aqui quando isso acontecer. */

function verifyGygIntegrator(req, res, next) {
  const expected = process.env.GYG_INTEGRATOR_API_KEY;
  if (!expected) {
    return res.status(503).json({ error: 'Integracao GetYourGuide nao configurada', code: 'NOT_CONFIGURED' });
  }

  const token = req.headers['x-access-token'];
  if (!token || token !== expected) {
    return res.status(401).json({ error: 'Token invalido', code: 'UNAUTHORIZED' });
  }

  next();
}

module.exports = verifyGygIntegrator;
