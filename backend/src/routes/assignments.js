const express = require('express');
const router  = express.Router();
const { listar, criar, criarComposta, mudarStatus, actualizarNotas, getAvailableStaff } = require('../controllers/assignmentController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');
const reqOpOrStaff = require('../middleware/requireOperatorOrStaff');

router.use(auth);

router.get('/available-staff', reqOp, getAvailableStaff);
router.get('/',                reqOp, listar);
router.post('/',               reqOp, criar);
router.post('/composta',       reqOp, criarComposta);
router.put('/:id/confirm',     reqOpOrStaff, (req, res, next) => { req.body.status = 'confirmed';   mudarStatus(req, res, next); });
router.put('/:id/start',       reqOpOrStaff, (req, res, next) => { req.body.status = 'in_progress'; mudarStatus(req, res, next); });
router.put('/:id/complete',    reqOpOrStaff, (req, res, next) => { req.body.status = 'completed';   mudarStatus(req, res, next); });
router.put('/:id/cancel',      reqOp, (req, res, next) => { req.body.status = 'cancelled';   mudarStatus(req, res, next); });
router.put('/:id/status',      reqOp, mudarStatus);
router.put('/:id/notes',       reqOpOrStaff, actualizarNotas);

module.exports = router;
