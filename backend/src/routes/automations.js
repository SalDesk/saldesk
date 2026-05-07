const express = require('express');
const router = express.Router();
const { listar, criar, actualizar, eliminar, getLogs } = require('../controllers/automationsController');
const authMiddleware = require('../middleware/auth');
const requireOperator = require('../middleware/requireOperator');

router.use(authMiddleware);
router.use(requireOperator);

router.get('/', listar);
router.post('/', criar);
router.put('/:id', actualizar);
router.delete('/:id', eliminar);
router.get('/:id/logs', getLogs);

module.exports = router;
