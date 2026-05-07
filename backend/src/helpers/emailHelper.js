const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function enviarEmail({ to, subject, text }) {
  const html = `<p style="font-family:Arial,sans-serif;line-height:1.6">${text.replace(/\n/g, '<br>')}</p>`;

  await sgMail.send({
    to,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'SalDesk' },
    subject,
    text,
    html
  });
}

module.exports = { enviarEmail };
