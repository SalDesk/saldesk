const express = require('express');
const router  = express.Router();
const { listar, obter, criar, actualizar, eliminar, getJobs, getEarnings, setAvailability, savePushSubscription } = require('../controllers/staffController');
const auth    = require('../middleware/auth');
const reqOp   = require('../middleware/requireOperator');

router.use(auth);
router.use(reqOp);

router.get('/',                        listar);
router.get('/:id',                     obter);
router.post('/',                       criar);
router.put('/:id',                     actualizar);
router.delete('/:id',                  eliminar);
router.get('/:id/jobs',                getJobs);
router.get('/:id/earnings',            getEarnings);
router.put('/:id/availability',        setAvailability);
router.post('/:id/push-subscription',  savePushSubscription);

module.exports = router;
