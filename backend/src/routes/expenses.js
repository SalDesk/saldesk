const express = require('express');
const router  = express.Router();
const {
  listarDespesas, criarDespesa, actualizarDespesa, eliminarDespesa,
  listarSalaryConfigs, actualizarSalaryConfig,
  listarSalaryPayments, criarSalaryPayment,
  obterObligations, actualizarObligations,
} = require('../controllers/expensesController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');
const requirePlanActive = require('../middleware/requirePlanActive');

router.use(auth);
router.use(reqOp);
router.use(requirePlanActive);

/* Rotas literais primeiro -- "/:id" abaixo apanharia "/obligations" etc.
   como se fosse um id de despesa (Express faz match por ordem). */
router.get('/salary-configs',            listarSalaryConfigs);
router.put('/salary-configs/:staffId',   actualizarSalaryConfig);

router.get('/salary-payments',  listarSalaryPayments);
router.post('/salary-payments', criarSalaryPayment);

router.get('/obligations', obterObligations);
router.put('/obligations', actualizarObligations);

router.get('/',      listarDespesas);
router.post('/',     criarDespesa);
router.put('/:id',   actualizarDespesa);
router.delete('/:id', eliminarDespesa);

module.exports = router;
