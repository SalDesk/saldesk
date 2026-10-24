const express = require('express');
const router  = express.Router();
const {
  enviarParaReserva, marcarAberto, listar, listarTemplates, guardarTemplate, previewTemplate, canal,
} = require('../controllers/messagingController');
const auth              = require('../middleware/auth');
const reqOp             = require('../middleware/requireOperator');
const reqOpOrStaff      = require('../middleware/requireOperatorOrStaff');
const requirePlanActive = require('../middleware/requirePlanActive');

router.use(auth);
router.use(requirePlanActive);

router.post('/reservations/:id/send',      reqOpOrStaff, enviarParaReserva);
router.post('/outbox/:id/opened',          reqOpOrStaff, marcarAberto);
router.get('/outbox',                      reqOpOrStaff, listar);
router.get('/channel',                     reqOp,        canal);
router.get('/templates',                   reqOp,        listarTemplates);
router.post('/templates/preview',          reqOp,        previewTemplate);
router.put('/templates/:trigger/:locale',  reqOp,        guardarTemplate);

module.exports = router;
