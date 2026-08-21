const express = require('express');
const router = express.Router();
const {
  resumo, receita, unidades, topClientes, canais, exportExcel, exportPdf, forecast, transacoes,
  listarReceitasManuais, criarReceitaManual, actualizarReceitaManual, eliminarReceitaManual,
} = require('../controllers/financeiroController');
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
router.get('/transacoes',  transacoes);

router.get('/receitas-manuais',      listarReceitasManuais);
router.post('/receitas-manuais',     criarReceitaManual);
router.put('/receitas-manuais/:id',  actualizarReceitaManual);
router.delete('/receitas-manuais/:id', eliminarReceitaManual);

module.exports = router;
