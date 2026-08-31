/* Autenticacao das chamadas que a GetYourGuide faz PARA DENTRO do SalDesk
   (Availability Query, Reservation, Booking, etc.).
   Confirmado na documentacao oficial (Integrator Portal): autenticacao e
   sempre HTTP Basic Auth (username+password no header Authorization) --
   OAuth e Bearer token nao sao aceites pela GYG neste fluxo.

   2026-08-31: o Integrator Portal passou a EXIGIR credenciais unicas para
   Sandbox e Producao ("Voce deve fornecer credenciais unicas para seus
   ambientes de teste e producao", bloqueia o guardar da config de Teste
   enquanto o username for igual ao de Producao) -- deixou de chegar uma
   unica combinacao. Aceita QUALQUER par valido entre os dois ambientes
   (GYG nunca diz de qual ambiente o pedido vem, so o par de credenciais
   permite distinguir). Confirmado ao vivo no mesmo dia: as 4 combinacoes
   de certificacao (Time point/Time period x Individuals/Groups) correram
   com sucesso em Producao usando as novas credenciais -- removido o par
   antigo unico (GYG_INTEGRATOR_USERNAME/PASSWORD) que so servia de
   fallback durante a transicao. */

const crypto = require('crypto');

function hash(str) {
  return crypto.createHash('sha256').update(String(str)).digest();
}

function timingSafeEqualStr(a, b) {
  return crypto.timingSafeEqual(hash(a), hash(b));
}

function matchesPair(providedUser, providedPass, envUserVar, envPassVar) {
  const username = process.env[envUserVar];
  const password = process.env[envPassVar];
  if (!username || !password) return false;
  return timingSafeEqualStr(providedUser, username) && timingSafeEqualStr(providedPass, password);
}

function verifyGygIntegrator(req, res, next) {
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

  const valido =
    matchesPair(providedUser, providedPass, 'GYG_INTEGRATOR_SANDBOX_USERNAME',    'GYG_INTEGRATOR_SANDBOX_PASSWORD') ||
    matchesPair(providedUser, providedPass, 'GYG_INTEGRATOR_PRODUCTION_USERNAME', 'GYG_INTEGRATOR_PRODUCTION_PASSWORD') ||
    /* 2026-08-31 09:53 -- REPOSTO DE URGENCIA: tinha sido removido (ver git
       log), mas o trafego REAL de producao da GYG (IPs okhttp confirmados
       nos logs do pm2) comecou a falhar AUTHORIZATION_FAILURE no minuto
       exacto da remocao -- confirmado que o par antigo e DIFERENTE dos
       pares Sandbox/Producao novos, ou seja a GYG ainda esta a autenticar
       com este par antigo do lado de Producao, apesar do portal supostamente
       ja ter as credenciais novas gravadas. Manter ate confirmar com a GYG
       porque o portal nao esta a usar o par novo, so depois remover. */
    matchesPair(providedUser, providedPass, 'GYG_INTEGRATOR_USERNAME',            'GYG_INTEGRATOR_PASSWORD');

  if (!valido) {
    return res.status(200).json({ errorCode: 'AUTHORIZATION_FAILURE', errorMessage: 'The provided authentication credentials are not valid.' });
  }

  next();
}

module.exports = verifyGygIntegrator;
