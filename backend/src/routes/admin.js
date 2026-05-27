const express = require('express');
const router  = express.Router();
const {
  getStats, listOperators, getOperatorDetail, updateOperator, updateOperatorStatus,
  listLeads, updateLead,
  getImpact, getLogs, getSystemHealth,
  getRevenue,
  featured, banners, experiences, events, articles,
} = require('../controllers/adminController');
const auth           = require('../middleware/auth');
const requireFounder = require('../middleware/requireFounder');

router.use(auth);
router.use(requireFounder);

/* Stats + operadores */
router.get('/stats',                    getStats);
router.get('/revenue',                  getRevenue);
router.get('/operators',                listOperators);
router.get('/operators/:id',            getOperatorDetail);
router.put('/operators/:id',            updateOperator);
router.put('/operators/:id/status',     updateOperatorStatus);  /* compat */

/* Leads */
router.get('/leads',                    listLeads);
router.put('/leads/:id',                updateLead);

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
