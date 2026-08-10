const express = require('express');
const router  = express.Router();
const { listar, obter, criar, actualizar, eliminar, getJobs, getEarnings, setAvailability, savePushSubscription, createAccount, obterPerfilProprio, actualizarPerfilProprio } = require('../controllers/staffController');
const {
  listarFerias, criarFerias, actualizarEstadoFerias, obterSaldoFerias, actualizarSaldoFerias,
  listarDocumentos, criarDocumento, eliminarDocumento,
  listarCertificacoes, criarCertificacao, eliminarCertificacao,
} = require('../controllers/staffHrController');
const auth    = require('../middleware/auth');
const reqOp   = require('../middleware/requireOperator');
const reqOpOrStaff = require('../middleware/requireOperatorOrStaff');

router.use(auth);

router.get('/',                        reqOpOrStaff, listar);
router.get('/me',                      reqOpOrStaff, obterPerfilProprio);
router.put('/me',                      reqOpOrStaff, actualizarPerfilProprio);
router.get('/:id',                     reqOp, obter);
router.post('/',                       reqOp, criar);
router.put('/:id',                     reqOp, actualizar);
router.delete('/:id',                  reqOp, eliminar);
router.get('/:id/jobs',                reqOpOrStaff, getJobs);
router.get('/:id/earnings',            reqOpOrStaff, getEarnings);
router.put('/:id/availability',        reqOpOrStaff, setAvailability);
router.post('/:id/push-subscription',  reqOp, savePushSubscription);
router.post('/:id/create-account',     reqOp, createAccount);

/* ── RH: ferias, documentos, certificacoes ── */
router.get('/:id/leave',               reqOpOrStaff, listarFerias);
router.post('/:id/leave',              reqOpOrStaff, criarFerias);
router.put('/:id/leave/:leaveId',      reqOp, actualizarEstadoFerias);
router.get('/:id/leave-balance',       reqOpOrStaff, obterSaldoFerias);
router.put('/:id/leave-balance',       reqOp, actualizarSaldoFerias);

router.get('/:id/documents',           reqOpOrStaff, listarDocumentos);
router.post('/:id/documents',          reqOp, criarDocumento);
router.delete('/:id/documents/:docId', reqOp, eliminarDocumento);

router.get('/:id/certifications',              reqOpOrStaff, listarCertificacoes);
router.post('/:id/certifications',             reqOp, criarCertificacao);
router.delete('/:id/certifications/:certId',   reqOp, eliminarCertificacao);

module.exports = router;
