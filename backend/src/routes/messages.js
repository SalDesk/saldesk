const express = require('express');
const router  = express.Router();
const { listar, enviar, marcarLida, unreadCount, listarGrupos, criarGrupo, adicionarMembro, listarUltimaActividade } = require('../controllers/messageController');
const auth          = require('../middleware/auth');
const reqOp         = require('../middleware/requireOperator');
const reqOpOrStaff  = require('../middleware/requireOperatorOrStaff');
const requirePlanActive = require('../middleware/requirePlanActive');

router.use(auth);
router.use(requirePlanActive);

router.get('/unread-count',        reqOp,        unreadCount);
router.get('/last-activity',       reqOpOrStaff, listarUltimaActividade);
router.get('/groups',              reqOpOrStaff, listarGrupos);
router.post('/groups',             reqOp,        criarGrupo);
router.post('/groups/:id/members', reqOp,        adicionarMembro);
router.get('/',                    reqOpOrStaff, listar);
router.post('/',                   reqOpOrStaff, enviar);
router.put('/:id/read',            reqOpOrStaff, marcarLida);

module.exports = router;
