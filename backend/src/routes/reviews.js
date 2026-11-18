const express = require('express');
const router  = express.Router();
const { listar, stats, requestReview, submitReview, reply, publicReviews, obterTemplate, actualizarTemplate, tokenInfo, obterDefinicoes, guardarDefinicoes } = require('../controllers/reviewController');
const { publicLimiter } = require('../middleware/rateLimiters');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');
const requirePlanActive = require('../middleware/requirePlanActive');

/* Sem auth */
router.post('/submit',          publicLimiter, submitReview);
router.get('/token/:token',     publicLimiter, tokenInfo);
router.get('/public/:slug',     publicReviews);

/* Autenticadas */
router.use(auth);
router.use(reqOp);
router.use(requirePlanActive);

router.get('/stats',            stats);
router.get('/settings',         obterDefinicoes);
router.put('/settings',         guardarDefinicoes);
router.get('/template',         obterTemplate);
router.put('/template',         actualizarTemplate);
router.get('/',                 listar);
router.post('/request',         requestReview);
router.put('/:id/reply',        reply);

module.exports = router;
