const express = require('express');
const router  = express.Router();
const { listar, criar, mudarStatus, getAvailableStaff } = require('../controllers/assignmentController');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');

router.use(auth);
router.use(reqOp);

router.get('/available-staff', getAvailableStaff);
router.get('/',                listar);
router.post('/',               criar);
router.put('/:id/confirm',     (req, res, next) => { req.body.status = 'confirmed';   mudarStatus(req, res, next); });
router.put('/:id/start',       (req, res, next) => { req.body.status = 'in_progress'; mudarStatus(req, res, next); });
router.put('/:id/complete',    (req, res, next) => { req.body.status = 'completed';   mudarStatus(req, res, next); });
router.put('/:id/cancel',      (req, res, next) => { req.body.status = 'cancelled';   mudarStatus(req, res, next); });
router.put('/:id/status',      mudarStatus);

module.exports = router;
