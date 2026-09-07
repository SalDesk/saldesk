const express = require('express');
const router  = express.Router();
const { previewOperator, previewUnit } = require('../controllers/socialPreviewController');

/* So alcancada via nginx (deteccao de bot no User-Agent) -- ver
   /book/:slug e /book/:slug/servico/:id na config do app.saldesk.cv.
   Publica, sem auth -- os crawlers nunca enviam nenhum token. */
router.get('/book/:slug/servico/:unitId', previewUnit);
router.get('/book/:slug', previewOperator);

module.exports = router;
