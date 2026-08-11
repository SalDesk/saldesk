const express = require('express');
const router = express.Router();
const { resumo, receita, unidades, topClientes, canais, exportExcel, exportPdf, forecast } = require('../controllers/financeiroController');
const authMiddleware = require('../middleware/auth');
const requireOperator = require('../middleware/requireOperator');
const requirePlanActive = require('../middleware/requirePlanActive');

router.use(authMiddleware);
router.use(requireOperator);
router.use(requirePlanActive);

router.get('/resumo',   resumo);
router.get('/receita',  receita);
router.get('/unidades', unidades);
router.get('/clientes', topClientes);
router.get('/canais',   canais);
router.get('/export',      exportExcel);
router.get('/export-pdf',  exportPdf);
router.get('/forecast',    forecast);

module.exports = router;
