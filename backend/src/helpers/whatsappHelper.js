/* Migrado da Twilio para a API directa da Meta (Cloud API) -- a conta
   Twilio ficou presa em "Trial" com falha de verificacao de identidade no
   upgrade para paga, sem numero WhatsApp Business aprovado (so o Sandbox
   partilhado, que exige opt-in manual de cada destinatario). A Meta Cloud
   API fala directamente com o WhatsApp, sem intermediario, usando o token
   + phone_number_id gerados na App Meta (ver META_WHATSAPP_TOKEN/
   META_WHATSAPP_PHONE_NUMBER_ID no .env). Mantem a mesma assinatura
   enviarWhatsApp({to, body}) -- messageController.js/cronService.js nao
   precisam de mudar nada. */
const GRAPH_API_VERSION = 'v21.0';

/* Meta recomenda incluir o "+" e o codigo do pais no "to" (evita ambiguidade
   de para que pais o numero pertence) -- normaliza o que ja vem gravado em
   customers.phone/reservations.customer_phone (formatos livres, com
   espacos/tracos/parenteses conforme o cliente escreveu). */
function normalizarNumero(to) {
  const limpo = to.replace(/^whatsapp:/, '').replace(/[^\d+]/g, '');
  return limpo.startsWith('+') ? limpo : `+${limpo}`;
}

async function enviarWhatsApp({ to, body }) {
  if (!to) throw new Error('Número de telefone não disponível');

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${process.env.META_WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.META_WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizarNumero(to),
        type: 'text',
        text: { body },
      }),
    }
  );

  if (!res.ok) {
    const erro = await res.text();
    throw new Error(`Meta WhatsApp API error ${res.status}: ${erro}`);
  }
}

module.exports = { enviarWhatsApp };
