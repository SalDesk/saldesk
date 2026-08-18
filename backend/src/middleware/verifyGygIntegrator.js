/* Autenticacao das chamadas que a GetYourGuide faz PARA DENTRO do SalDesk
   (Availability Query, Reservation, Booking, etc.).
   Confirmado na documentacao oficial (Integrator Portal): autenticacao e
   sempre HTTP Basic Auth (username+password no header Authorization) --
   OAuth e Bearer token nao sao aceites pela GYG neste fluxo. As credenciais
   sao definidas por nos (uma unica combinacao para toda a integracao, nao
   por operador) e comunicadas a GYG no formulario "Configuracao de Teste"
   do Integrator Portal. */

const crypto = require('crypto');

function hash(str) {
  return crypto.createHash('sha256').update(String(str)).digest();
}

function timingSafeEqualStr(a, b) {
  return crypto.timingSafeEqual(hash(a), hash(b));
}

function verifyGygIntegrator(req, res, next) {
  const username = process.env.GYG_INTEGRATOR_USERNAME;
  const password = process.env.GYG_INTEGRATOR_PASSWORD;
  if (!username || !password) {
    return res.status(200).json({ errorCode: 'AUTHORIZATION_FAILURE', errorMessage: 'Integration not configured.' });
  }

  const header = req.headers['authorization'] || '';
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (!match) {
    return res.status(200).json({ errorCode: 'AUTHORIZATION_FAILURE', errorMessage: 'The provided authentication credentials are not valid.' });
  }

  let decoded;
  try {
    decoded = Buffer.from(match[1], 'base64').toString('utf8');
  } catch {
    return res.status(200).json({ errorCode: 'AUTHORIZATION_FAILURE', errorMessage: 'The provided authentication credentials are not valid.' });
  }

  const sepIdx = decoded.indexOf(':');
  const providedUser = sepIdx === -1 ? decoded : decoded.slice(0, sepIdx);
  const providedPass = sepIdx === -1 ? ''      : decoded.slice(sepIdx + 1);

  if (!timingSafeEqualStr(providedUser, username) || !timingSafeEqualStr(providedPass, password)) {
    return res.status(200).json({ errorCode: 'AUTHORIZATION_FAILURE', errorMessage: 'The provided authentication credentials are not valid.' });
  }

  next();
}

module.exports = verifyGygIntegrator;
