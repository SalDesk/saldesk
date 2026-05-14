const express = require('express');
const router  = express.Router();
const { listar, stats, requestReview, submitReview, reply, publicReviews } = require('../controllers/reviewController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');

/* Sem auth */
router.post('/submit',          submitReview);
router.get('/public/:slug',     publicReviews);

/* Autenticadas */
router.use(auth);
router.use(reqOp);

router.get('/stats',            stats);
router.get('/',                 listar);
router.post('/request',         requestReview);
router.put('/:id/reply',        reply);

module.exports = router;
