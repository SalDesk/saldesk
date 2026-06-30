const express = require('express');
const router  = express.Router();
const { listar, enviar, marcarLida, unreadCount, listarGrupos, criarGrupo, adicionarMembro } = require('../controllers/messageController');
const auth          = require('../middleware/auth');
const reqOp         = require('../middleware/requireOperator');
const reqOpOrStaff  = require('../middleware/requireOperatorOrStaff');

router.use(auth);

router.get('/unread-count',        reqOp,        unreadCount);
router.get('/groups',              reqOpOrStaff, listarGrupos);
router.post('/groups',             reqOp,        criarGrupo);
router.post('/groups/:id/members', reqOp,        adicionarMembro);
router.get('/',                    reqOpOrStaff, listar);
router.post('/',                   reqOpOrStaff, enviar);
router.put('/:id/read',            reqOpOrStaff, marcarLida);

module.exports = router;
