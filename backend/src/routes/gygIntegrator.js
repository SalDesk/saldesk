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
  res.on('finish', () => {
    console.log(`[GYG Integrator] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio}ms)`);
  });
  next();
});

router.use(verifyGygIntegrator);

router.get('/tours/:product_id/availability',        queryAvailability);
router.post('/tours/:product_id/reservations',        createReservation);
router.delete('/reservations/:reservation_id',        cancelReservation);
router.post('/reservations/:reservation_id/booking',  createBooking);
router.delete('/bookings/:booking_id',                cancelBooking);

module.exports = router;
