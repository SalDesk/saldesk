const express = require('express');
const router  = express.Router();
const { listar, obter, criar, actualizar, eliminar, getJobs, getEarnings, setAvailability, savePushSubscription, createAccount } = require('../controllers/staffController');
const auth    = require('../middleware/auth');
const reqOp   = require('../middleware/requireOperator');
const reqOpOrStaff = require('../middleware/requireOperatorOrStaff');

router.use(auth);

router.get('/',                        reqOp, listar);
router.get('/:id',                     reqOp, obter);
router.post('/',                       reqOp, criar);
router.put('/:id',                     reqOp, actualizar);
router.delete('/:id',                  reqOp, eliminar);
router.get('/:id/jobs',                reqOpOrStaff, getJobs);
router.get('/:id/earnings',            reqOpOrStaff, getEarnings);
router.put('/:id/availability',        reqOp, setAvailability);
router.post('/:id/push-subscription',  reqOp, savePushSubscription);
router.post('/:id/create-account',     reqOp, createAccount);

module.exports = router;
