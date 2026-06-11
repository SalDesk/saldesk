const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function enviarEmail({ to, subject, html, text }) {
  const finalHtml = html || `<p style="font-family:Arial,sans-serif;line-height:1.6">${(text || '').replace(/\n/g, '<br>')}</p>`;
  const finalText = text || (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');

  await sgMail.send({
    to,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'SalDesk' },
    subject,
    text: finalText,
    html: finalHtml
  });
}

module.exports = { enviarEmail };
