const express = require('express');
const router  = express.Router();
const { listar, disponivel, criar, actualizar, eliminar, atribuir, devolver } = require('../controllers/fleetController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');

router.use(auth);
router.use(reqOp);

router.get('/available',    disponivel);
router.get('/',             listar);
router.post('/',            criar);
router.put('/:id',          actualizar);
router.delete('/:id',       eliminar);
router.post('/:id/assign',  atribuir);
router.put('/:id/return',   devolver);

module.exports = router;
