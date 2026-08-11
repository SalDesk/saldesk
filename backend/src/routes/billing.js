const express = require('express');
const router  = express.Router();
const {
  createSubscriptionCheckout, confirmSubscription, cancelMySubscription,
  webhookPaypal, getBillingHistory,
} = require('../controllers/billingController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');

/* Webhook publico -- sem auth, a PayPal chama isto directamente. */
router.post('/webhook', webhookPaypal);

/* Deliberadamente FORA de requirePlanActive -- um operador suspenso ou
   com trial expirado tem de conseguir chegar aqui para subscrever e
   reactivar. */
router.use(auth);
router.use(reqOp);

router.post('/subscribe',            createSubscriptionCheckout);
router.post('/subscription/confirm', confirmSubscription);
router.post('/subscription/cancel',  cancelMySubscription);
router.get('/history',               getBillingHistory);

module.exports = router;
