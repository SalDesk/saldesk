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
  getFinancialSummary, getFinancialMrrHistory, getFinancialCosts, updateFinancialCosts, exportFinancial,
  featured, banners, experiences, events, articles,
  testimonials, faqs, landmarks,
  getCmsPricing, updateCmsPricing,
  getCmsHero, updateCmsHero,
  getCmsSettings, updateCmsSettings,
  listEmailTemplates, updateEmailTemplate, sendTestEmailTemplate,
  listConversations, getConversation, sendConversationMessage,
  sendBroadcast, listBroadcasts,
  sendMarketingEmail, sendLaunchEmail,
  getAnalyticsTraffic, getAnalyticsFunnel, getAnalyticsChurn,
  getAnalyticsGeography, sendAnalyticsReport,
} = require('../controllers/adminController');
const auth           = require('../middleware/auth');
const requireFounder = require('../middleware/requireFounder');

router.use(auth);
router.use(requireFounder);

/* Stats + actividade + operadores */
router.get('/stats',                    getStats);
router.get('/activity',                 getActivity);
router.get('/revenue',                  getRevenue);

router.get('/financial/summary',        getFinancialSummary);
router.get('/financial/mrr-history',    getFinancialMrrHistory);
router.get('/financial/costs',          getFinancialCosts);
router.put('/financial/costs',          updateFinancialCosts);
router.get('/financial/export',         exportFinancial);
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

router.get('/cms/testimonials',         testimonials.list);
router.post('/cms/testimonials',        testimonials.create);
router.put('/cms/testimonials/:id',     testimonials.update);
router.delete('/cms/testimonials/:id',  testimonials.remove);

router.get('/cms/faqs',                 faqs.list);
router.post('/cms/faqs',                faqs.create);
router.put('/cms/faqs/:id',             faqs.update);
router.delete('/cms/faqs/:id',          faqs.remove);

router.get('/cms/landmarks',            landmarks.list);
router.post('/cms/landmarks',           landmarks.create);
router.put('/cms/landmarks/:id',        landmarks.update);
router.delete('/cms/landmarks/:id',     landmarks.remove);

router.get('/cms/pricing',              getCmsPricing);
router.put('/cms/pricing/:plan',        updateCmsPricing);

router.get('/cms/hero',                 getCmsHero);
router.put('/cms/hero',                 updateCmsHero);

router.get('/cms/settings',             getCmsSettings);
router.put('/cms/settings',             updateCmsSettings);

router.get('/cms/email-templates',           listEmailTemplates);
router.put('/cms/email-templates/:id',       updateEmailTemplate);
router.post('/cms/email-templates/:id/test', sendTestEmailTemplate);

/* Analytics */
router.get('/analytics/traffic',     getAnalyticsTraffic);
router.get('/analytics/funnel',      getAnalyticsFunnel);
router.get('/analytics/churn',       getAnalyticsChurn);
router.get('/analytics/geography',   getAnalyticsGeography);
router.post('/analytics/send-report', sendAnalyticsReport);

/* Comunicacoes */
router.get('/communications/conversations',                  listConversations);
router.get('/communications/conversations/:operatorId',      getConversation);
router.post('/communications/conversations/:operatorId',     sendConversationMessage);
router.post('/communications/broadcast',                     sendBroadcast);
router.get('/communications/broadcasts',                     listBroadcasts);
router.post('/communications/email',                         sendMarketingEmail);
router.post('/communications/launch-email',                  sendLaunchEmail);

module.exports = router;
