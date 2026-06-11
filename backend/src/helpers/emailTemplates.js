/**
 * SalDesk — Email Templates
 * Templates HTML profissionais para emails transaccionais.
 * Paleta: ocean-700 (#0D5470) + sand-500 (#D4A82A). Sem emojis.
 */

const OCEAN  = '#0D5470';
const SAND   = '#D4A82A';
const INK    = '#1A2332';
const MUTED  = '#6B7280';
const BORDER = '#E5E8EC';
const BG     = '#F9FAFB';

const FONT = "Arial, Helvetica, sans-serif";

function formatMoney(value, currency = 'EUR') {
  const n = Number(value || 0);
  return `${n.toFixed(2)} ${currency}`;
}

function formatDate(dateStr, idioma = 'pt') {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const locale = idioma === 'en' ? 'en-GB' : 'pt-PT';
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ── Building blocks ── */

function logoBlock() {
  return `
    <tr>
      <td style="padding:24px 32px 0;background:#FFFFFF;text-align:center;">
        <div style="text-align:center; margin-bottom:24px;">
          <span style="font-family:Arial,sans-serif; font-size:28px; font-weight:900; color:${OCEAN}; letter-spacing:-1px;">SAL</span><span style="font-family:Arial,sans-serif; font-size:28px; font-weight:900; color:${SAND}; letter-spacing:-1px;">DESK</span>
        </div>
      </td>
    </tr>`;
}

function ctaButton(url, label) {
  if (!url || !label) return '';
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px;">
      <tr>
        <td style="border-radius:4px;background:${OCEAN};">
          <a href="${url}" target="_blank"
             style="display:inline-block;padding:12px 28px;font-family:${FONT};font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:4px;letter-spacing:0.3px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

function detailRow(label, value) {
  if (value === null || value === undefined || value === '') return '';
  return `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid ${BORDER};font-family:${FONT};font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:${MUTED};width:42%;">${label}</td>
      <td style="padding:9px 0;border-bottom:1px solid ${BORDER};font-family:${FONT};font-size:14px;color:${INK};text-align:right;">${value}</td>
    </tr>`;
}

function detailsTable(rowsHtml) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 4px;">${rowsHtml}</table>`;
}

function sectionLabel(text) {
  return `<p style="margin:24px 0 4px;font-family:${FONT};font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:${OCEAN};">${text}</p>`;
}

function paragraph(text) {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:14px;line-height:1.6;color:${INK};">${text}</p>`;
}

/* ── Layout ── */

function wrapEmail({ title, introHtml, bodyHtml, ctaUrl, ctaLabel }) {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:${FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:8px;overflow:hidden;border:1px solid ${BORDER};">
          ${logoBlock()}
          <tr>
            <td style="padding:32px 28px;">
              <h1 style="margin:0 0 12px;font-family:${FONT};font-size:20px;font-weight:bold;color:${INK};">${title}</h1>
              ${introHtml || ''}
              ${bodyHtml || ''}
              ${ctaButton(ctaUrl, ctaLabel)}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:${BG};border-top:1px solid ${BORDER};text-align:center;">
              <p style="margin:0;font-family:${FONT};font-size:11px;color:${MUTED};letter-spacing:0.3px;">
                Powered by SalDesk &middot; saldesk.cv
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ── a) Confirmacao ao cliente ── */

function confirmacaoClienteEmail({
  idioma = 'pt',
  customerName,
  tourName,
  checkIn,
  checkOut,
  guests,
  total,
  currency = 'EUR',
  operator,
}) {
  const en = idioma === 'en';
  const subject = en ? `Booking received — ${tourName}` : `Reserva recebida — ${tourName}`;

  const dateLabel = (checkOut && checkOut !== checkIn)
    ? `${formatDate(checkIn, idioma)} → ${formatDate(checkOut, idioma)}`
    : formatDate(checkIn, idioma);

  const intro = en
    ? `<p style="margin:0 0 20px;font-family:${FONT};font-size:14px;line-height:1.6;color:${MUTED};">Hello ${customerName}, we received your reservation request. Here is a summary — our team will confirm availability shortly.</p>`
    : `<p style="margin:0 0 20px;font-family:${FONT};font-size:14px;line-height:1.6;color:${MUTED};">Olá ${customerName}, recebemos o seu pedido de reserva. Aqui fica um resumo — a nossa equipa vai confirmar a disponibilidade em breve.</p>`;

  const details = detailsTable([
    detailRow(en ? 'Service'  : 'Serviço',  tourName),
    detailRow(en ? 'Date'     : 'Data',     dateLabel),
    detailRow(en ? 'Guests'   : 'Pessoas',  guests),
    detailRow(en ? 'Total'    : 'Total',    formatMoney(total, currency)),
  ].join(''));

  const operatorName = operator?.name || (en ? 'the operator' : 'o operador');
  const contactBits = [];
  if (operator?.email) contactBits.push(`<a href="mailto:${operator.email}" style="color:${OCEAN};">${operator.email}</a>`);
  if (operator?.phone) contactBits.push(operator.phone);
  const contact = contactBits.length ? ` (${contactBits.join(' · ')})` : '';

  const nextSteps = en
    ? paragraph(`<strong>Next steps:</strong> our team will review your request and confirm by email. For any questions, contact ${operatorName}${contact}.`)
    : paragraph(`<strong>Próximos passos:</strong> a nossa equipa vai analisar o seu pedido e confirmar por email. Para qualquer questão, contacte ${operatorName}${contact}.`);

  const html = wrapEmail({
    title: en ? 'Booking received' : 'Reserva recebida',
    introHtml: intro,
    bodyHtml: details + nextSteps,
    ctaUrl: operator?.slug ? `https://saldesk.cv/book/${operator.slug}` : undefined,
    ctaLabel: en ? 'View booking details' : 'Ver detalhes da reserva',
  });

  const textLines = en
    ? [
        `Hello ${customerName},`,
        '',
        'We received your reservation request. Summary:',
        `- Service: ${tourName}`,
        `- Date: ${dateLabel}`,
        `- Guests: ${guests}`,
        `- Total: ${formatMoney(total, currency)}`,
        '',
        `Our team will confirm availability shortly. Questions? Contact ${operatorName}${operator?.email ? ` (${operator.email})` : ''}.`,
      ]
    : [
        `Olá ${customerName},`,
        '',
        'Recebemos o seu pedido de reserva. Resumo:',
        `- Serviço: ${tourName}`,
        `- Data: ${dateLabel}`,
        `- Pessoas: ${guests}`,
        `- Total: ${formatMoney(total, currency)}`,
        '',
        `A nossa equipa vai confirmar a disponibilidade em breve. Duvidas? Contacte ${operatorName}${operator?.email ? ` (${operator.email})` : ''}.`,
      ];

  return { subject, html, text: textLines.join('\n') };
}

/* ── b) Notificacao ao operador ── */

function notificacaoOperadorEmail({
  operatorName,
  tourName,
  checkIn,
  checkOut,
  guests,
  total,
  currency = 'EUR',
  customer = {},
  notes,
}) {
  const subject = `Nova reserva — ${tourName} | ${formatDateShort(checkIn)}`;

  const dateLabel = (checkOut && checkOut !== checkIn)
    ? `${formatDate(checkIn, 'pt')} → ${formatDate(checkOut, 'pt')}`
    : formatDate(checkIn, 'pt');

  const intro = `<p style="margin:0 0 20px;font-family:${FONT};font-size:14px;line-height:1.6;color:${MUTED};">Olá ${operatorName}, recebeu uma nova reserva através da SalDesk.</p>`;

  const reservaDetails = detailsTable([
    detailRow('Serviço',  tourName),
    detailRow('Data',     dateLabel),
    detailRow('Pessoas',  guests),
    detailRow('Total',    formatMoney(total, currency)),
  ].join(''));

  const clienteDetails = detailsTable([
    detailRow('Nome',     customer.name),
    detailRow('Email',    customer.email),
    detailRow('Telefone', customer.phone),
    detailRow('País',     customer.country),
  ].join(''));

  const notesBlock = notes
    ? sectionLabel('Notas especiais') + paragraph(notes)
    : '';

  const html = wrapEmail({
    title: 'Nova reserva recebida',
    introHtml: intro,
    bodyHtml: sectionLabel('Detalhes da reserva') + reservaDetails
      + sectionLabel('Cliente') + clienteDetails
      + notesBlock,
    ctaUrl: 'https://app.saldesk.cv/reservas',
    ctaLabel: 'Ver no dashboard',
  });

  const textLines = [
    `Olá ${operatorName},`,
    '',
    'Recebeu uma nova reserva através da SalDesk.',
    '',
    'Detalhes da reserva:',
    `- Serviço: ${tourName}`,
    `- Data: ${dateLabel}`,
    `- Pessoas: ${guests}`,
    `- Total: ${formatMoney(total, currency)}`,
    '',
    'Cliente:',
    `- Nome: ${customer.name || ''}`,
    `- Email: ${customer.email || ''}`,
    `- Telefone: ${customer.phone || ''}`,
    `- País: ${customer.country || ''}`,
  ];
  if (notes) textLines.push('', `Notas especiais: ${notes}`);
  textLines.push('', 'Ver no dashboard: https://app.saldesk.cv/reservas');

  return { subject, html, text: textLines.join('\n') };
}

module.exports = {
  confirmacaoClienteEmail,
  notificacaoOperadorEmail,
};
