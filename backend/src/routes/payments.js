const express = require('express');
const router  = express.Router();
const {
  createPayPalIntent, confirmPayPalPayment, paypalWebhook,
  initSisp, sispCallback,
  registerManualPayment, getHistory, refund,
} = require('../controllers/paymentController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');

/* Webhooks e callbacks — sem auth. A Vinti4 faz POST directo para
   urlMerchantResponse (nao ha webhook separado como no PayPal). */
router.post('/webhook/paypal',  paypalWebhook);
router.post('/sisp/callback',   express.urlencoded({ extended: false }), sispCallback);

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
