const express = require('express');
const router  = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { encrypt, decrypt } = require('../utils/encrypt');
const auth  = require('../middleware/auth');
const reqOp = require('../middleware/requireOperator');

router.use(auth);
router.use(reqOp);

/* Link de reserva */
router.get('/booking-link', (req, res) => {
  const base = process.env.FRONTEND_URL || 'https://app.saldesk.cv';
  return res.json({
    data: { url: `${base}/book/${req.operator.slug}` },
    message: 'Link de reserva',
  });
});

/* QR Code — SVG/PNG via API publica de QR */
router.get('/qrcode', (req, res) => {
  const base = process.env.FRONTEND_URL || 'https://app.saldesk.cv';
  const url  = encodeURIComponent(`${base}/book/${req.operator.slug}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${url}&format=png`;
  return res.redirect(qrUrl);
});

/* Widget embebivel */
router.get('/widget-code', (req, res) => {
  const base = process.env.FRONTEND_URL || 'https://app.saldesk.cv';
  const slug = req.operator.slug;
  const html = `<!-- SalDesk Widget — ${req.operator.name} -->
<iframe
  src="${base}/book/${slug}?widget=1"
  width="100%"
  height="600"
  frameborder="0"
  style="border:none;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.1)"
  title="Reservar em ${req.operator.name}"
></iframe>`;
  return res.json({ data: { html, slug }, message: 'Widget code gerado' });
});

/* Guardar credenciais de pagamento por operador */
router.put('/payment-settings', async (req, res, next) => {
  try {
    const { paypal_client_id, paypal_client_secret, sisp_merchant_id, sisp_api_key } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (paypal_client_id)     updates.paypal_client_id_enc     = encrypt(paypal_client_id);
    if (paypal_client_secret) updates.paypal_client_secret_enc = encrypt(paypal_client_secret);
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
      .select('paypal_client_id_enc, sisp_merchant_id_enc')
      .eq('id', req.operator.id)
      .single();
    const mask = (enc) => enc ? `${'*'.repeat(12)}${decrypt(enc).slice(-4)}` : null;
    return res.json({
      data: {
        paypal_client_id:  mask(data?.paypal_client_id_enc),
        sisp_merchant_id:  mask(data?.sisp_merchant_id_enc),
        has_paypal: !!data?.paypal_client_id_enc,
        has_sisp:   !!data?.sisp_merchant_id_enc,
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

module.exports = router;
