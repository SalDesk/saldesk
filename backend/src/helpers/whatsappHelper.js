const twilio = require('twilio');

let client;

function getClient() {
  if (!client) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

async function enviarWhatsApp({ to, body }) {
  if (!to) throw new Error('Número de telefone não disponível');

  const numero = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  await getClient().messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: numero,
    body
  });
}

module.exports = { enviarWhatsApp };
