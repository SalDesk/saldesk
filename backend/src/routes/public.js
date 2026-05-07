const express = require('express');
const router = express.Router();
const { getOperador, verificarDisponibilidadePublica, criarReserva } = require('../controllers/publicController');

router.get('/:slug', getOperador);
router.get('/:slug/availability', verificarDisponibilidadePublica);
router.post('/:slug/reservations', criarReserva);

module.exports = router;
