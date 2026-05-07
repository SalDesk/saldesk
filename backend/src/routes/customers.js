const express = require('express');
const router = express.Router();
const { listar, obter, actualizar } = require('../controllers/customersController');
const authMiddleware = require('../middleware/auth');
const requireOperator = require('../middleware/requireOperator');

router.use(authMiddleware);
router.use(requireOperator);

router.get('/', listar);
router.get('/:id', obter);
router.put('/:id', actualizar);

module.exports = router;
