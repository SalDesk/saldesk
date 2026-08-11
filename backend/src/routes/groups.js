const express = require('express');
const router  = express.Router();
const { listar, criar, actualizar, eliminar, criarPagamento } = require('../controllers/groupsController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');
const requirePlanActive = require('../middleware/requirePlanActive');

router.use(auth);
router.use(reqOp);
router.use(requirePlanActive);

router.get('/',           listar);
router.post('/',          criar);
router.put('/:id',        actualizar);
router.delete('/:id',     eliminar);
router.post('/:id/payments', criarPagamento);

module.exports = router;
