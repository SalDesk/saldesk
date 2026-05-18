const express = require('express');
const router  = express.Router();
const { getOperador, verificarDisponibilidadePublica, criarReserva, discover } = require('../controllers/publicController');

router.get('/discover',              discover);
router.get('/:slug',                 getOperador);
router.get('/:slug/availability',    verificarDisponibilidadePublica);
router.post('/:slug/reservations',   criarReserva);

/* QR Code publico — nao requer autenticacao */
router.get('/:slug/qrcode', (req, res) => {
  const base = process.env.FRONTEND_URL || 'https://app.saldesk.cv';
  const url  = encodeURIComponent(`${base}/book/${req.params.slug}`);
  return res.redirect(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${url}&format=png`);
});

module.exports = router;
