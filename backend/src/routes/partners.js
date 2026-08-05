const express = require('express');
const router  = express.Router();
const { listar, criar, actualizar, eliminar, registarReserva } = require('../controllers/partnersController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');

router.use(auth);
router.use(reqOp);

router.get('/',           listar);
router.post('/',          criar);
router.put('/:id',        actualizar);
router.delete('/:id',     eliminar);
router.post('/:id/bookings', registarReserva);

module.exports = router;
