const express = require('express');
const router = express.Router();
const { getCalendar, criarBloqueio, eliminarBloqueio } = require('../controllers/calendarController');
const authMiddleware = require('../middleware/auth');
const requireOperator = require('../middleware/requireOperator');

router.use(authMiddleware);
router.use(requireOperator);

router.get('/', getCalendar);
router.post('/blocked-dates', criarBloqueio);
router.delete('/blocked-dates/:id', eliminarBloqueio);

module.exports = router;
