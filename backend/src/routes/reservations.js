const express = require('express');
const router = express.Router();
const { listar, criar, obter, actualizar, mudarStatus, eliminar } = require('../controllers/reservationsController');
const authMiddleware = require('../middleware/auth');
const requireOperatorOrStaff = require('../middleware/requireOperatorOrStaff');

router.use(authMiddleware);
router.use(requireOperatorOrStaff);

router.get('/', listar);
router.post('/', criar);
router.get('/:id', obter);
router.put('/:id', actualizar);
router.put('/:id/status', mudarStatus);
router.delete('/:id', eliminar);

module.exports = router;
