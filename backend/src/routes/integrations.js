const express = require('express');
const router = express.Router();
const {
  connectChannel, disconnectChannel, getStatus,
  syncManual, getLogs, viatorWebhook, gygWebhook,
} = require('../controllers/integrationController');
const authMiddleware   = require('../middleware/auth');
const requireOperator  = require('../middleware/requireOperator');

/* Webhooks — sem autenticacao, verificacao HMAC interna */
router.post('/webhooks/viator',       viatorWebhook);
router.post('/webhooks/getyourguide', gygWebhook);

/* Rotas autenticadas */
router.use(authMiddleware);
router.use(requireOperator);

router.post('/:channel/connect',      connectChannel);
router.delete('/:channel',            disconnectChannel);
router.get('/status',                 getStatus);
router.post('/sync',                  syncManual);
router.get('/logs',                   getLogs);

module.exports = router;
