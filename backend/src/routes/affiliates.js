const express = require('express');
const router  = express.Router();
const { listar, criar, actualizar, eliminar, criarPagamento, obterConfig, actualizarConfig } = require('../controllers/affiliatesController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');

router.use(auth);
router.use(reqOp);

router.get('/config',    obterConfig);
router.put('/config',    actualizarConfig);
router.get('/',           listar);
router.post('/',          criar);
router.put('/:id',        actualizar);
router.delete('/:id',     eliminar);
router.post('/:id/payments', criarPagamento);

module.exports = router;
