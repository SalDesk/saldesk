const express = require('express');
const router = express.Router();
const { listar, mudarStatus } = require('../controllers/ordersController');
const authMiddleware = require('../middleware/auth');
const requireOperatorOrStaff = require('../middleware/requireOperatorOrStaff');
const requirePlanActive = require('../middleware/requirePlanActive');

router.use(authMiddleware);
router.use(requireOperatorOrStaff);
router.use(requirePlanActive);

router.get('/', listar);
router.put('/:id/status', mudarStatus);

module.exports = router;
