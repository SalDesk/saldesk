const sgMail = require('@sendgrid/mail');
const { supabaseAdmin } = require('../config/supabase');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/* attachments: [{ filename, content: Buffer, contentType }] -- callers
   passam sempre um Buffer real (nunca base64 pre-codificado), a conversao
   para o formato que o SendGrid exige fica so aqui, num sitio unico. */
async function enviarEmail({ to, subject, html, text, attachments }) {
  const finalHtml = html || `<p style="font-family:Arial,sans-serif;line-height:1.6">${(text || '').replace(/\n/g, '<br>')}</p>`;
  const finalText = text || (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');

  try {
    await sgMail.send({
      to,
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'SalDesk' },
      subject,
      text: finalText,
      html: finalHtml,
      ...(Array.isArray(attachments) && attachments.length ? {
        attachments: attachments.map((a) => ({
          filename: a.filename,
          type: a.contentType || 'application/octet-stream',
          content: a.content.toString('base64'),
          disposition: 'attachment',
        })),
      } : {}),
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

    /* Registo interno da falha -- ate agora isto so existia em
       console.error, invisivel ao founder ate ele ir aos logs do servidor.
       Ponto unico (todos os ~20 callers deste helper ganham isto de
       graca). Nunca deixa uma falha a registar a falha derrubar o
       comportamento existente do caller. */
    supabaseAdmin.from('email_failures').insert({
      context: subject || null,
      to_email: to || null,
      error_message: err.message,
    }).then(({ error: logErr }) => {
      if (logErr) console.error('[EmailFailureLog] Erro ao registar falha de email:', logErr.message);
    });

    throw err;
  }
}

module.exports = { enviarEmail };
