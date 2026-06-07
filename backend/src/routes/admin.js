const express = require('express');
const router  = express.Router();
const {
  getStats, getActivity,
  listOperators, getOperatorDetail, updateOperator, updateOperatorStatus,
  extendOperatorTrial, messageOperator, impersonateOperator,
  listLeads, updateLead, sendLeadEmail, convertLead,
  updateLeadStage, addLeadNote, addLeadContact, getPipelineStats,
  getWaitlist, sendWaitlistEmail,
  listInviteCodes, createInviteCode, updateInviteCode,
  getImpact, getLogs, getSystemHealth,
  getRevenue,
  featured, banners, experiences, events, articles,
} = require('../controllers/adminController');
const auth           = require('../middleware/auth');
const requireFounder = require('../middleware/requireFounder');

router.use(auth);
router.use(requireFounder);

/* Stats + actividade + operadores */
router.get('/stats',                    getStats);
router.get('/activity',                 getActivity);
router.get('/revenue',                  getRevenue);
router.get('/operators',                listOperators);
router.get('/operators/:id',            getOperatorDetail);
router.put('/operators/:id',            updateOperator);
router.put('/operators/:id/status',     updateOperatorStatus);  /* compat */
router.post('/operators/:id/extend-trial', extendOperatorTrial);
router.post('/operators/:id/message',      messageOperator);
router.post('/operators/:id/impersonate',  impersonateOperator);

/* Pipeline comercial */
router.get('/pipeline/stats',            getPipelineStats);

/* Leads */
router.get('/leads',                    listLeads);
router.put('/leads/:id',                updateLead);
router.put('/leads/:id/stage',           updateLeadStage);
router.post('/leads/:id/note',           addLeadNote);
router.post('/leads/:id/contact',        addLeadContact);
router.post('/leads/:id/email',         sendLeadEmail);
router.post('/leads/:id/convert',       convertLead);

/* Waitlist */
router.get('/waitlist',                 getWaitlist);
router.post('/waitlist/launch-email',   sendWaitlistEmail);

/* Códigos de convite */
router.get('/invite-codes',             listInviteCodes);
router.post('/invite-codes',            createInviteCode);
router.put('/invite-codes/:id',         updateInviteCode);

/* Métricas públicas + logs + sistema */
router.get('/impact',                   getImpact);
router.get('/logs',                     getLogs);
router.get('/system/health',            getSystemHealth);

/* CMS */
router.get('/cms/featured',             featured.list);
router.post('/cms/featured',            featured.create);
router.put('/cms/featured/:id',         featured.update);
router.delete('/cms/featured/:id',      featured.remove);

router.get('/cms/banners',              banners.list);
router.post('/cms/banners',             banners.create);
router.put('/cms/banners/:id',          banners.update);
router.delete('/cms/banners/:id',       banners.remove);

router.get('/cms/experiences',          experiences.list);
router.post('/cms/experiences',         experiences.create);
router.put('/cms/experiences/:id',      experiences.update);
router.delete('/cms/experiences/:id',   experiences.remove);

router.get('/cms/events',               events.list);
router.post('/cms/events',              events.create);
router.put('/cms/events/:id',           events.update);
router.delete('/cms/events/:id',        events.remove);

router.get('/cms/articles',             articles.list);
router.post('/cms/articles',            articles.create);
router.put('/cms/articles/:id',         articles.update);
router.delete('/cms/articles/:id',      articles.remove);

module.exports = router;
