const crypto = require('crypto');

const ALGO = 'aes-256-cbc';
const KEY_HEX = process.env.ENCRYPTION_KEY || '0'.repeat(64);

function getKey() {
  return Buffer.from(KEY_HEX.slice(0, 64), 'hex');
}

function encrypt(text) {
  const iv  = crypto.randomBytes(16);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(stored) {
  if (!stored || !stored.includes(':')) return stored;
  const [ivHex, encHex] = stored.split(':');
  const key     = getKey();
  const iv      = Buffer.from(ivHex, 'hex');
  const enc     = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
