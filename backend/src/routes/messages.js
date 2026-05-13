const express = require('express');
const router  = express.Router();
const { listar, enviar, marcarLida, unreadCount, listarGrupos, criarGrupo, adicionarMembro } = require('../controllers/messageController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');

router.use(auth);
router.use(reqOp);

router.get('/unread-count',        unreadCount);
router.get('/groups',              listarGrupos);
router.post('/groups',             criarGrupo);
router.post('/groups/:id/members', adicionarMembro);
router.get('/',                    listar);
router.post('/',                   enviar);
router.put('/:id/read',            marcarLida);

module.exports = router;
