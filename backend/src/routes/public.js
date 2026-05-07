const express = require('express');
const router = express.Router();
const { getOperador, verificarDisponibilidadePublica, criarReserva, discover } = require('../controllers/publicController');

router.get('/discover', discover);
router.get('/:slug', getOperador);
router.get('/:slug/availability', verificarDisponibilidadePublica);
router.post('/:slug/reservations', criarReserva);

module.exports = router;
