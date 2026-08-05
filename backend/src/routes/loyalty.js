const express = require('express');
const router  = express.Router();
const { obterConfig, actualizarConfig } = require('../controllers/loyaltyController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');

router.use(auth);
router.use(reqOp);

router.get('/config', obterConfig);
router.put('/config', actualizarConfig);

module.exports = router;
