const express = require('express');
const router  = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { encrypt, decrypt } = require('../utils/encrypt');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');
const requirePlanActive = require('../middleware/requirePlanActive');
const { frontendBase } = require('../utils/urls');

router.use(auth);
router.use(reqOp);
router.use(requirePlanActive);

/* Link de reserva */
router.get('/booking-link', (req, res) => {
  const base = frontendBase();
  return res.json({
    data: { url: `${base}/book/${req.operator.slug}` },
    message: 'Link de reserva',
  });
});

/* QR Code — SVG/PNG via API publica de QR. ?unitId= gera o QR de uma mesa
   especifica (book/{slug}/mesa/{unitId}) em vez do QR geral do restaurante --
   nao exige status='active' (operador pode querer imprimir antes de activar). */
router.get('/qrcode', async (req, res, next) => {
  try {
    const base = frontendBase();
    let bookingPath = `book/${req.operator.slug}`;

    if (req.query.unitId) {
      const { data: unit } = await supabaseAdmin
        .from('units')
        .select('id, unit_type, operator_id')
        .eq('id', req.query.unitId)
        .single();

      if (!unit || unit.operator_id !== req.operator.id ||
          unit.unit_type === 'menu_item' || unit.unit_type === 'tasting_menu') {
        return res.status(404).json({ error: 'Mesa não encontrada', code: 'NOT_FOUND' });
      }
      bookingPath += `/mesa/${unit.id}`;
    }

    const url = encodeURIComponent(`${base}/${bookingPath}?ref=qr`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${url}&format=png`;
    return res.redirect(qrUrl);
  } catch (err) { next(err); }
});

/* Widget embebivel */
router.get('/widget-code', (req, res) => {
  const base = frontendBase();
  const slug = req.operator.slug;
  const iframeId = `saldesk-widget-${slug}`;
  const html = `<!-- SalDesk Widget — ${req.operator.name} -->
<iframe
  id="${iframeId}"
  src="${base}/book/${slug}?widget=1"
  width="100%"
  height="500"
  frameborder="0"
  style="border:none;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.1)"
  title="Reservar em ${req.operator.name}"
></iframe>
<script>
(function () {
  var iframe = document.getElementById('${iframeId}');
  if (!iframe) return;
  window.addEventListener('message', function (event) {
    if (event.source === iframe.contentWindow && event.data && event.data.type === 'saldesk-widget-resize') {
      iframe.style.height = event.data.height + 'px';
    }
  });
})();
</script>`;
  return res.json({ data: { html, slug }, message: 'Widget code gerado' });
});

/* Guardar credenciais de pagamento por operador */
router.put('/payment-settings', async (req, res, next) => {
  try {
    const { paypal_client_id, paypal_client_secret, paypal_webhook_id, sisp_merchant_id, sisp_api_key } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (paypal_client_id)     updates.paypal_client_id_enc     = encrypt(paypal_client_id);
    if (paypal_client_secret) updates.paypal_client_secret_enc = encrypt(paypal_client_secret);
    if (paypal_webhook_id)    updates.paypal_webhook_id_enc    = encrypt(paypal_webhook_id);
    if (sisp_merchant_id)     updates.sisp_merchant_id_enc     = encrypt(sisp_merchant_id);
    if (sisp_api_key)         updates.sisp_api_key_enc         = encrypt(sisp_api_key);
    await supabaseAdmin.from('operators').update(updates).eq('id', req.operator.id);
    return res.json({ data: null, message: 'Credenciais de pagamento guardadas' });
  } catch (err) { next(err); }
});

/* Ler credenciais (mascaradas) */
router.get('/payment-settings', async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin
      .from('operators')
      .select('paypal_client_id_enc, paypal_webhook_id_enc, sisp_merchant_id_enc')
      .eq('id', req.operator.id)
      .single();
    const mask = (enc) => enc ? `${'*'.repeat(12)}${decrypt(enc).slice(-4)}` : null;
    return res.json({
      data: {
        paypal_client_id:   mask(data?.paypal_client_id_enc),
        paypal_webhook_id:  mask(data?.paypal_webhook_id_enc),
        sisp_merchant_id:   mask(data?.sisp_merchant_id_enc),
        has_paypal:         !!data?.paypal_client_id_enc,
        has_paypal_webhook: !!data?.paypal_webhook_id_enc,
        has_sisp:           !!data?.sisp_merchant_id_enc,
      },
      message: 'Configuracoes de pagamento',
    });
  } catch (err) { next(err); }
});

/* Registar lead do website */
router.post('/lead', async (req, res, next) => {
  try {
    const { email, name, operator_type, language = 'pt', source = 'website' } = req.body;
    if (!email) return res.status(400).json({ error: 'Email obrigatorio', code: 'MISSING_FIELDS' });
    const { data, error } = await supabaseAdmin
      .from('leads')
      .upsert({ email, name: name || null, operator_type: operator_type || null, language, source }, { onConflict: 'email' })
      .select().single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Lead registado' });
  } catch (err) { next(err); }
});

/* Alimenta a tab "Estatisticas" (frontend/src/pages/Marketing.jsx) -- a
   rota nunca existiu, a tab ficava sempre a mostrar 0 em silencio.
   profile_views/clicks vem da instrumentacao real de page_views (ver
   trackView em publicController.js); bookings_direct/sources ja existiam
   nas reservas, sem precisar de nenhuma instrumentacao nova. */
router.get('/stats', async (req, res, next) => {
  try {
    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: views }, { data: reservas }] = await Promise.all([
      supabaseAdmin.from('page_views').select('ref').eq('operator_id', req.operator.id).gte('created_at', desde),
      supabaseAdmin.from('reservations').select('source').eq('operator_id', req.operator.id).neq('status', 'cancelled').gte('created_at', desde),
    ]);

    const profileViews = (views || []).length;
    const clicks = (views || []).filter((v) => v.ref === 'qr' || v.ref === 'widget').length;
    const bookingsDirect = (reservas || []).filter((r) => ['direct', 'public', 'admin'].includes(r.source)).length;
    const conversionRate = clicks > 0 ? Math.round((bookingsDirect / clicks) * 1000) / 10 : 0;

    const sources = {};
    for (const r of reservas || []) {
      const key = r.source || 'manual';
      sources[key] = (sources[key] || 0) + 1;
    }

    return res.json({
      data: {
        profile_views: profileViews,
        clicks,
        bookings_direct: bookingsDirect,
        conversion_rate: conversionRate,
        sources,
      },
      message: 'Estatisticas de marketing',
    });
  } catch (err) { next(err); }
});

module.exports = router;
