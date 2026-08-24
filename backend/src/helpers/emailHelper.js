const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function enviarEmail({ to, subject, html, text }) {
  const finalHtml = html || `<p style="font-family:Arial,sans-serif;line-height:1.6">${(text || '').replace(/\n/g, '<br>')}</p>`;
  const finalText = text || (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');

  try {
    await sgMail.send({
      to,
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'SalDesk' },
      subject,
      text: finalText,
      html: finalHtml
    });
  } catch (err) {
    /* err.message do @sendgrid/mail e so o texto generico do status HTTP
       (ex. "Unauthorized" para um 401) -- o motivo real (ex. "Maximum
       credits exceeded") so vem em err.response.body.errors, que nenhum
       caller deste helper alguma vez logava. Reconstroi a mensagem para
       que todo o "console.error(..., err.message)" ja existente no resto
       do codigo passe a mostrar o motivo real sem precisar de tocar em
       cada callsite. */
    const detalhe = err.response?.body?.errors?.map((e) => e.message).join('; ');
    if (detalhe) err.message = `${err.message}: ${detalhe}`;
    throw err;
  }
}

module.exports = { enviarEmail };
