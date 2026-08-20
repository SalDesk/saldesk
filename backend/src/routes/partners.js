const express = require('express');
const router  = express.Router();
const {
  listar, criar, actualizar, eliminar, registarReserva,
  pesquisarOperadores, criarPedidoParceria, responderPedidoParceria,
} = require('../controllers/partnersController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');
const requirePlanActive = require('../middleware/requirePlanActive');

router.use(auth);
router.use(reqOp);
router.use(requirePlanActive);

// Antes de qualquer rota com :id, senao o Express interpreta "search-operators" como o parametro.
router.get('/search-operators', pesquisarOperadores);
router.post('/request',         criarPedidoParceria);

router.get('/',           listar);
router.post('/',          criar);
router.put('/:id',        actualizar);
router.delete('/:id',     eliminar);
router.post('/:id/bookings', registarReserva);
router.put('/:id/respond',   responderPedidoParceria);

module.exports = router;
