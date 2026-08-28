const express = require('express');
const router = express.Router();
const { createOperator, updateOperator, getStatus, markTourSeen } = require('../controllers/onboardingController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/operator', createOperator);
router.put('/operator',  updateOperator);
router.get('/status',    getStatus);
router.put('/tour-seen', markTourSeen);

module.exports = router;
