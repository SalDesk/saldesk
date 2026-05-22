const express = require('express');
const router  = express.Router();
const {
  getOperador,
  verificarDisponibilidadePublica,
  criarReserva,
  discover,
  cmsExperiences,
  cmsEvents,
  cmsBanners,
  publicReviews,
  publicContact,
  slugReviews,
  slugContact,
} = require('../controllers/publicController');

/* ─── Discover / directorio ─── */
router.get('/discover',            discover);

/* ─── CMS público ─── */
router.get('/cms/experiences',     cmsExperiences);
router.get('/cms/events',          cmsEvents);
router.get('/cms/banners',         cmsBanners);

/* ─── Avaliações públicas recentes ─── */
router.get('/reviews',             publicReviews);

/* ─── Formulário de contacto / newsletter ─── */
router.post('/contact',            publicContact);

/* ─── Operador individual ─── */
router.get('/:slug',               getOperador);
router.get('/:slug/reviews',       slugReviews);
router.get('/:slug/availability',  verificarDisponibilidadePublica);
router.post('/:slug/reservations', criarReserva);
router.post('/:slug/contact',      slugContact);

/* ─── QR Code público — sem autenticação ─── */
router.get('/:slug/qrcode', (req, res) => {
  const base = process.env.FRONTEND_URL || 'https://app.saldesk.cv';
  const url  = encodeURIComponent(`${base}/book/${req.params.slug}`);
  return res.redirect(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${url}&format=png`);
});

module.exports = router;
