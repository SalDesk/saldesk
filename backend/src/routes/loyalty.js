const express = require('express');
const router  = express.Router();
const { obterConfig, actualizarConfig, historicoCliente, ajustarPontos, resgatar } = require('../controllers/loyaltyController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');
const requirePlanActive = require('../middleware/requirePlanActive');

router.use(auth);
router.use(reqOp);
router.use(requirePlanActive);

router.get('/config', obterConfig);
router.put('/config', actualizarConfig);

router.get('/customers/:customerId/history', historicoCliente);
router.post('/customers/:customerId/adjust',  ajustarPontos);
router.post('/customers/:customerId/redeem',  resgatar);

module.exports = router;
