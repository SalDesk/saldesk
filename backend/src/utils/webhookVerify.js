const crypto = require('crypto');

function verifyViatorSignature(req) {
  const secret = process.env.VIATOR_WEBHOOK_SECRET;
  if (!secret) return false;
  const signature = req.headers['x-viator-signature'] || req.headers['x-signature'] || '';
  const body = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function verifyGygSignature(req) {
  const secret = process.env.GYG_WEBHOOK_SECRET;
  if (!secret) return false;
  const signature = req.headers['x-gyg-signature'] || req.headers['x-signature'] || '';
  const body = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

module.exports = { verifyViatorSignature, verifyGygSignature };
