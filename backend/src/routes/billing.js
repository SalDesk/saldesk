const express = require('express');
const router  = express.Router();
const {
  createSubscriptionCheckout, confirmSubscription, cancelMySubscription,
  webhookPaypal, getBillingHistory,
  createSispCheckout, sispCallback,
} = require('../controllers/billingController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');

/* Webhooks/callbacks publicos -- sem auth, os gateways chamam isto
   directamente (PayPal servidor-a-servidor; Vinti4 via redirect do
   browser do operador, ver sispCallback). */
router.post('/webhook',       webhookPaypal);
router.post('/sisp-callback', sispCallback);

/* Deliberadamente FORA de requirePlanActive -- um operador suspenso ou
   com trial expirado tem de conseguir chegar aqui para subscrever e
   reactivar. */
router.use(auth);
router.use(reqOp);

router.post('/subscribe',            createSubscriptionCheckout);
router.post('/subscription/confirm', confirmSubscription);
router.post('/subscription/cancel',  cancelMySubscription);
router.post('/sisp-checkout',        createSispCheckout);
router.get('/history',               getBillingHistory);

module.exports = router;
