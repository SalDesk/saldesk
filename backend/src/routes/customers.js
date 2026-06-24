const express = require('express');
const router = express.Router();
const { listar, obter, actualizar, segmentos, exportCsv } = require('../controllers/customersController');
const authMiddleware = require('../middleware/auth');
const requireOperatorOrStaff = require('../middleware/requireOperatorOrStaff');

router.use(authMiddleware);
router.use(requireOperatorOrStaff);

router.get('/segments', segmentos);
router.get('/export',   exportCsv);
router.get('/',         listar);
router.get('/:id',      obter);
router.put('/:id',      actualizar);

module.exports = router;
