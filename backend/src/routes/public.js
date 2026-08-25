const express = require('express');
const router  = express.Router();
const {
  getOperador,
  trackView,
  verificarDisponibilidadePublica,
  getSlotAvailability,
  verificarDisponibilidadeRestaurantePublica,
  criarReserva,
  discover,
  cmsExperiences,
  cmsEvents,
  cmsBanners,
  publicReviews,
  publicContact,
  slugReviews,
  slugContact,
  sendGuestChatMessage,
  getGuestChatHistory,
  getUnit,
  getUnitReviews,
  marcarReviewUtil,
  submitLead,
  getImpact,
  getSiteStatus,
  discoverUnits,
  getExperienceCategories,
  callWaiter,
  createOrder,
  listIslands,
  getCmsPublic,
} = require('../controllers/publicController');
const { publicInitSisp, publicPaypalClientId, publicCreatePaypalIntent, publicConfirmPaypalPayment } = require('../controllers/paymentController');
const { validarVoucherPublico } = require('../controllers/vouchersController');
const { portalLogin: affiliatePortalLogin } = require('../controllers/affiliatesController');
const { frontendBase } = require('../utils/urls');
const { publicLimiter, authLimiter, chatLimiter } = require('../middleware/rateLimiters');

/* ─── Relatório de impacto público ─── */
router.get('/impact',              getImpact);
router.get('/site-status',         getSiteStatus);
router.get('/islands',             listIslands);

/* ─── Discover / directorio ─── */
router.get('/discover',            discover);
router.get('/discover-units',      discoverUnits);
router.get('/experience-categories', getExperienceCategories);

/* ─── CMS público ─── */
router.get('/cms/experiences',     cmsExperiences);
router.get('/cms/events',          cmsEvents);
router.get('/cms/banners',         cmsBanners);

/* ─── Avaliações públicas recentes ─── */
router.get('/reviews',             publicReviews);

/* ─── Formulário de contacto / newsletter ─── */
router.post('/contact',            publicLimiter, publicContact);

/* ─── Candidatura de operador (website /operadores) ─── */
router.post('/leads',              publicLimiter, submitLead);

/* ─── CMS website público ─── */
router.get('/cms', getCmsPublic);

/* ─── Unidade individual ─── */
router.get('/:slug/units/:unitId',         getUnit);
router.get('/:slug/units/:unitId/reviews', getUnitReviews);
router.get('/:slug/units/:unitId/slot-availability', getSlotAvailability);
router.post('/:slug/units/:unitId/reviews/:reviewId/helpful', publicLimiter, marcarReviewUtil);
router.post('/:slug/units/:unitId/call-waiter', publicLimiter, callWaiter);
router.post('/:slug/units/:unitId/orders', publicLimiter, createOrder);

/* ─── Operador individual ─── */
router.get('/:slug',               getOperador);
router.post('/:slug/track-view',   publicLimiter, trackView);
router.get('/:slug/reviews',       slugReviews);
router.get('/:slug/availability',  verificarDisponibilidadePublica);
router.get('/:slug/restaurant-availability', verificarDisponibilidadeRestaurantePublica);
router.post('/:slug/reservations', publicLimiter, criarReserva);
router.post('/:slug/vouchers/validate', publicLimiter, validarVoucherPublico);
router.post('/affiliates/login', authLimiter, affiliatePortalLogin);
router.post('/:slug/contact',      publicLimiter, slugContact);
router.post('/:slug/chat/send',    chatLimiter, sendGuestChatMessage);
router.get('/:slug/chat/history',  chatLimiter, getGuestChatHistory);
router.post('/:slug/payments/sisp/init', publicLimiter, publicInitSisp);
router.get('/:slug/payments/paypal/client-id',  publicPaypalClientId);
router.post('/:slug/payments/paypal/create-intent', publicLimiter, publicCreatePaypalIntent);
router.post('/:slug/payments/paypal/confirm',   publicLimiter, publicConfirmPaypalPayment);

/* ─── QR Code público — sem autenticação ─── */
router.get('/:slug/qrcode', (req, res) => {
  const base = frontendBase();
  const url  = encodeURIComponent(`${base}/book/${req.params.slug}?ref=qr`);
  return res.redirect(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${url}&format=png`);
});

module.exports = router;
