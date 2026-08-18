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
  const jsonOriginal = res.json.bind(res);
  let corpoEnviado = null;
  res.json = (body) => { corpoEnviado = body; return jsonOriginal(body); };
  res.on('finish', () => {
    const corpo = corpoEnviado ? JSON.stringify(corpoEnviado).slice(0, 500) : '(sem corpo JSON)';
    console.log(`[GYG Integrator] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio}ms) ${corpo}`);
  });
  next();
});

router.use(verifyGygIntegrator);

/* /1/get-availabilities confirmado ao vivo pelo self-testing tool da GYG
   (2026-08-18): GET /1/get-availabilities?productId=...&fromDateTime=...
   &toDateTime=... -- nem path params nem snake_case, tudo em query string
   camelCase. Os outros 4 paths abaixo seguem a mesma convencao "/1/{verbo-
   kebab-case}" e os nomes de verbo do SLA da documentacao (reserve/book/
   cancel-reservation/cancel-booking), mas ainda NAO foram confirmados ao
   vivo -- ajustar assim que o self-testing tool os exercitar. */
router.get('/1/get-availabilities',   queryAvailability);
router.post('/1/reserve',             createReservation);
router.post('/1/cancel-reservation',  cancelReservation);
router.post('/1/book',                createBooking);
router.post('/1/cancel-booking',      cancelBooking);

module.exports = router;
