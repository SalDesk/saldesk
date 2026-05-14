const express = require('express');
const router  = express.Router();
const {
  createPayPalIntent, confirmPayPalPayment, paypalWebhook,
  initSisp, sispCallback, sispWebhook,
  registerManualPayment, getHistory, refund,
} = require('../controllers/paymentController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');

/* Webhooks e callbacks — sem auth */
router.post('/webhook/paypal',  paypalWebhook);
router.post('/webhook/sisp',    sispWebhook);
router.get('/sisp/callback',    sispCallback);

/* Rotas autenticadas */
router.use(auth);
router.use(reqOp);

router.post('/create-intent',  createPayPalIntent);
router.post('/confirm',        confirmPayPalPayment);
router.post('/sisp/init',      initSisp);
router.post('/manual',         registerManualPayment);
router.get('/history',         getHistory);
router.post('/refund',         refund);

module.exports = router;
