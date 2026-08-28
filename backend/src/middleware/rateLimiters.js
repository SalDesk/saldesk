const rateLimit = require('express-rate-limit');

/* Extraido de server.js para poder ser reutilizado por rotas individuais
   (ex: travelerAuth.js aplica authLimiter por rota em vez de ao router
   inteiro, para a nova rota /session poder usar publicLimiter em vez de
   authLimiter -- ver travelerAuth.js). */
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiadas tentativas.', code: 'RATE_LIMIT' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiadas tentativas de autenticacao.', code: 'RATE_LIMIT' },
});

/* /auth/demo-login partilha o mesmo IP entre visitantes diferentes (todos
   clicam o mesmo botao "Ver demo" em saldesk.cv) e nunca tenta adivinhar
   uma credencial -- usar authLimiter aqui esgotava o orcamento partilhado
   de 20/15min com login real em minutos, mostrando "Demonstracao
   indisponivel" a visitantes genuinos. Limite proprio, generoso mas ainda
   protegido contra abuso automatizado. */
const demoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 60,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiadas tentativas de acesso a demonstracao.', code: 'RATE_LIMIT' },
});

/* O widget de chat da pagina publica faz polling do historico enquanto o
   painel esta aberto -- o publicLimiter (100/15min, partilhado por TODAS as
   rotas publicas do mesmo IP) esgotava-se em minutos so com isto, bloqueando
   o resto da pagina para esse visitante. Limite proprio, generoso o
   suficiente para um poll de poucos segundos sem abrir a porta a abuso. */
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiadas tentativas.', code: 'RATE_LIMIT' },
});

module.exports = { publicLimiter, authLimiter, chatLimiter, demoLimiter };
