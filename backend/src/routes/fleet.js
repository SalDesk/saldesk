const express = require('express');
const router  = express.Router();
const { listar, disponivel, criar, actualizar, eliminar, atribuir, devolver, getAvailability } = require('../controllers/fleetController');
const auth         = require('../middleware/auth');
const reqOp        = require('../middleware/requireOperator');
const reqOpOrStaff = require('../middleware/requireOperatorOrStaff');

router.use(auth);

router.get('/available',     reqOp,        disponivel);
router.get('/availability',  reqOpOrStaff, getAvailability);
router.get('/',              reqOp,        listar);
router.post('/',             reqOp,        criar);
router.put('/:id',           reqOp,        actualizar);
router.delete('/:id',        reqOp,        eliminar);
router.post('/:id/assign',   reqOp,        atribuir);
router.put('/:id/return',    reqOp,        devolver);

module.exports = router;
