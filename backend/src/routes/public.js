const express = require('express');
const router  = express.Router();
const {
  getOperador,
  verificarDisponibilidadePublica,
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
  getUnit,
  getUnitReviews,
  submitLead,
  getImpact,
  discoverUnits,
  getExperienceCategories,
  callWaiter,
} = require('../controllers/publicController');
const { publicInitSisp, publicPaypalClientId, publicCreatePaypalIntent, publicConfirmPaypalPayment } = require('../controllers/paymentController');
const { validarVoucherPublico } = require('../controllers/vouchersController');
const { portalLogin: affiliatePortalLogin } = require('../controllers/affiliatesController');
const { frontendBase } = require('../utils/urls');
const { publicLimiter } = require('../middleware/rateLimiters');

/* ─── Relatório de impacto público ─── */
router.get('/impact',              getImpact);

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
router.post('/contact',            publicContact);

/* ─── Candidatura de operador (website /operadores) ─── */
router.post('/leads',              submitLead);

/* ─── CMS website público ─── */
router.get('/cms', require('../controllers/publicController').getCmsPublic);

/* ─── Unidade individual ─── */
router.get('/:slug/units/:unitId',         getUnit);
router.get('/:slug/units/:unitId/reviews', getUnitReviews);
router.post('/:slug/units/:unitId/call-waiter', publicLimiter, callWaiter);

/* ─── Operador individual ─── */
router.get('/:slug',               getOperador);
router.get('/:slug/reviews',       slugReviews);
router.get('/:slug/availability',  verificarDisponibilidadePublica);
router.get('/:slug/restaurant-availability', verificarDisponibilidadeRestaurantePublica);
router.post('/:slug/reservations', criarReserva);
router.post('/:slug/vouchers/validate', validarVoucherPublico);
router.post('/affiliates/login', affiliatePortalLogin);
router.post('/:slug/contact',      slugContact);
router.post('/:slug/payments/sisp/init', publicInitSisp);
router.get('/:slug/payments/paypal/client-id',  publicPaypalClientId);
router.post('/:slug/payments/paypal/create-intent', publicCreatePaypalIntent);
router.post('/:slug/payments/paypal/confirm',   publicConfirmPaypalPayment);

/* ─── QR Code público — sem autenticação ─── */
router.get('/:slug/qrcode', (req, res) => {
  const base = frontendBase();
  const url  = encodeURIComponent(`${base}/book/${req.params.slug}`);
  return res.redirect(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${url}&format=png`);
});

router.get('/cms', require('../controllers/publicController').getCmsPublic);

module.exports = router;
