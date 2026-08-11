const express = require('express');
const router  = express.Router();
const { createCheckout, confirmCheckout, webhookPaypal, getBillingHistory } = require('../controllers/billingController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');

/* Webhook publico -- sem auth, a PayPal chama isto directamente. */
router.post('/webhook', webhookPaypal);

/* Deliberadamente FORA de requirePlanActive -- um operador suspenso ou
   com trial expirado tem de conseguir chegar aqui para pagar e reactivar. */
router.use(auth);
router.use(reqOp);

router.post('/checkout', createCheckout);
router.post('/confirm',  confirmCheckout);
router.get('/history',   getBillingHistory);

module.exports = router;
