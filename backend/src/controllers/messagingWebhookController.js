/* Webhook de entrada do OpenWA: POST /webhooks/whatsapp/openwa.

   Faz so tres coisas, por esta ordem: confirma que vem da rede interna, verifica a assinatura
   HMAC sobre o corpo em bruto e grava o evento. Responde 200 depressa; o processamento corre
   depois, no worker. Sem OpenWA configurado, a rota nao existe (404). */

const openwa = require('../messaging/providers/openwa');
const { ipInterno, guardarEvento } = require('../messaging/inbound');

async function openwaWebhook(req, res, next) {
  try {
    const cfg = openwa.configuracao(process.env);
    // Desligado, ou sem segredo configurado: como se a rota nao existisse.
    if (!cfg || !cfg.webhookSecret) return res.sendStatus(404);

    if (!ipInterno(req.ip)) {
      console.error(`[Messaging] Webhook OpenWA recusado: IP ${req.ip} nao e interno`);
      return res.sendStatus(403);
    }

    const provider = openwa.criarOpenWaProvider({ ...cfg });
    if (!req.rawBody || !provider.verifyWebhook(req.rawBody, req.headers, cfg.webhookSecret)) {
      console.error(`[Messaging] Webhook OpenWA recusado: assinatura invalida (ip=${req.ip})`);
      return res.sendStatus(401);
    }

    const corpo = req.body && typeof req.body === 'object' ? req.body : null;
    const eventId = req.headers['x-openwa-idempotency-key'] || corpo?.idempotencyKey || req.headers['x-openwa-delivery-id'] || corpo?.deliveryId;
    if (!corpo || !eventId) return res.sendStatus(400);

    await guardarEvento({
      provider: 'openwa',
      eventId,
      operatorId: process.env.WANDR_INTERNAL_OPERATOR_ID || null,
      payload: corpo,
    });
    return res.sendStatus(200);
  } catch (err) { next(err); }
}

module.exports = { openwaWebhook };
