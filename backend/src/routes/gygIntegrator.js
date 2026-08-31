const express = require('express');
const router = express.Router();
const {
  queryAvailability, createReservation, cancelReservation,
  createBooking, cancelBooking,
} = require('../controllers/gygIntegratorController');
const verifyGygIntegrator = require('../middleware/verifyGygIntegrator');

/* Endpoints que a GetYourGuide chama PARA DENTRO do SalDesk.
   Esqueleto de melhor esforco — ver comentarios no controller.
   Nao havia nenhum registo de pedidos HTTP neste router (nem no resto da
   app) -- durante a certificacao com a GYG isto e critico para confirmar
   se os pedidos deles chegam mesmo a este servidor. Regista antes de
   qualquer outra logica, incluindo pedidos que a autenticacao rejeite. */
router.use((req, res, next) => {
  const inicio = Date.now();
  /* A disponibilidade tem de ser sempre em tempo real -- o Express gera
     ETag por omissao em toda a resposta JSON (visto num curl -I: "ETag:
     W/..." sem nenhum Cache-Control a acompanhar). Sem uma instrucao
     explicita, um proxy/cliente HTTP mais agressivo do lado da GYG podia
     decidir por conta propria guardar a resposta em cache com base so no
     ETag. no-store elimina essa possibilidade por completo, em todas as
     respostas desta rota (mesmo as que a autenticacao rejeitar). */
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const jsonOriginal = res.json.bind(res);
  let corpoEnviado = null;
  res.json = (body) => { corpoEnviado = body; return jsonOriginal(body); };
  res.on('finish', () => {
    /* timestamp real + IP + User-Agent -- sem isto nao ha forma de distinguir
       no log um pedido genuino da ferramenta de self-testing da GYG de um
       curl de diagnostico nosso feito ao mesmo endpoint. Critico para a
       investigacao actual (2026-08-18): confirmar se os pedidos da GYG
       chegam mesmo a este servidor quando o utilizador clica "testar". */
    const corpo = corpoEnviado ? JSON.stringify(corpoEnviado).slice(0, 500) : '(sem corpo JSON)';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?';
    const ua = req.headers['user-agent'] || '(sem User-Agent)';
    console.log(`[GYG Integrator] ${new Date().toISOString()} ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio}ms) ip=${ip} ua="${ua}" ${corpo}`);
  });
  next();
});

router.use(verifyGygIntegrator);

/* /1/get-availabilities confirmado ao vivo pelo self-testing tool da GYG
   (2026-08-18): GET /1/get-availabilities?productId=...&fromDateTime=...
   &toDateTime=... -- nem path params nem snake_case, tudo em query string
   camelCase. Os outros 4 paths abaixo tem o mesmo prefixo "/1/{verbo-
   kebab-case}" e agora seguem o spec OpenAPI publico oficial da GYG
   (ver comentario detalhado no controller), mas ainda nao foram exercitados
   individualmente pelo self-testing tool -- ajustar assim que o forem.

   2026-08-30 (email de Ahmed, Equipe de Conectividade GYG): o pedido REAL
   de producao chegou a "/1/1/get-availabilities" (um segmento a mais que o
   confirmado em sandbox) e recebeu 404 -- a rota so existia com um
   segmento. O controller nunca le req.params (so query string), por isso
   o(s) segmento(s) antes do verbo sao so uma convencao de URL da GYG, nunca
   interpretados pela logica de negocio -- acrescentar o alias com dois
   segmentos e uma alteracao aditiva e segura, sem tocar em nada que ja
   estava certificado em sandbox. Ainda por resolver do lado deles (fora do
   nosso alcance, so no Integrator Portal): o URL base registado para
   Sandbox e Producao esta identico -- Ahmed pediu para diferenciar os
   dois no portal. */
router.get('/1/get-availabilities',   queryAvailability);
router.post('/1/reserve',             createReservation);
router.post('/1/cancel-reservation',  cancelReservation);
router.post('/1/book',                createBooking);
router.post('/1/cancel-booking',      cancelBooking);

router.get('/1/1/get-availabilities',   queryAvailability);
router.post('/1/1/reserve',             createReservation);
router.post('/1/1/cancel-reservation',  cancelReservation);
router.post('/1/1/book',                createBooking);
router.post('/1/1/cancel-booking',      cancelBooking);

module.exports = router;
