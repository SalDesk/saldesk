const express = require('express');
const router = express.Router();
const { resumo, receita, unidades, topClientes, canais, exportExcel } = require('../controllers/financeiroController');
const authMiddleware = require('../middleware/auth');
const requireOperator = require('../middleware/requireOperator');

router.use(authMiddleware);
router.use(requireOperator);

router.get('/resumo',   resumo);
router.get('/receita',  receita);
router.get('/unidades', unidades);
router.get('/clientes', topClientes);
router.get('/canais',   canais);
router.get('/export',   exportExcel);

module.exports = router;
