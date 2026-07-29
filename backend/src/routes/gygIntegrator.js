const express = require('express');
const router = express.Router();
const {
  queryAvailability, createReservation, cancelReservation,
  createBooking, cancelBooking,
} = require('../controllers/gygIntegratorController');
const verifyGygIntegrator = require('../middleware/verifyGygIntegrator');

/* Endpoints que a GetYourGuide chama PARA DENTRO do SalDesk.
   Esqueleto de melhor esforco — ver comentarios no controller. */
router.use(verifyGygIntegrator);

router.get('/tours/:product_id/availability',        queryAvailability);
router.post('/tours/:product_id/reservations',        createReservation);
router.delete('/reservations/:reservation_id',        cancelReservation);
router.post('/reservations/:reservation_id/booking',  createBooking);
router.delete('/bookings/:booking_id',                cancelBooking);

module.exports = router;
