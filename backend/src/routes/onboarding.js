const express = require('express');
const router = express.Router();
const { createOperator, getStatus } = require('../controllers/onboardingController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/operator', createOperator);
router.get('/status', getStatus);

module.exports = router;
