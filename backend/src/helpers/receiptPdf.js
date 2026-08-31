const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');

const LOGO_WHITE_PATH = path.join(__dirname, '../assets/logo-white.png');

/* Cambio fixo confirmado no backend (sispService.js's CVE_PER_EUR) --
   usado so para mostrar a linha "(+ CVE)" no recibo quando o operador nao
   fura em CVE, exigido pelo checklist de validacao de site da SISP
   ("valor discriminado (+CVE)"). */
const CVE_PER_EUR = 110.265;

const PAYMENT_LABEL_PT        = { pending: 'Pendente', paid: 'Pago', partial: 'Parcial', refunded: 'Reembolsado' };
const PAYMENT_METHOD_LABEL_PT = { paypal: 'PayPal', sisp: 'SISP Vinti4', cash: 'Dinheiro', transfer: 'Transferência bancária' };
const PAYMENT_STATUS_COLOR    = { paid: '#1A7A4A', pending: '#BE941C', partial: '#BE941C', refunded: '#6B7280' };

/* pdfkit so desenha JPEG/PNG -- logo_url em producao tem 2 formatos reais
   (confirmado ao vivo via Supabase): uploads recentes sao URL http para um
   ficheiro .webp (upload.js), mas operadores mais antigos tem o logo
   gravado directamente como data URI base64 -- um `axios.get` a um `data:`
   falharia sempre, por isso os dois casos tem de ser tratados aqui. Falha
   silenciosamente (devolve null) para nunca deixar um logo em falta ou
   inacessivel partir a geracao do recibo. */
async function fetchOperatorLogoPng(url) {
  if (!url) return null;
  try {
    let raw;
    if (url.startsWith('data:')) {
      const base64 = url.split(',')[1] || '';
      raw = Buffer.from(base64, 'base64');
    } else {
      const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 });
      raw = Buffer.from(resp.data);
    }
    return await sharp(raw).resize({ height: 120, withoutEnlargement: true }).png().toBuffer();
  } catch {
    return null;
  }
}

function fmtDatePt(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

function fmtMoneyPt(value, moeda) {
  return `${moeda} ${Number(value || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* Desenha o recibo num PDFDocument ja criado (nunca chama .end() -- quem
   chama decide o destino final: pipe(res) para download directo, ou
   acumular chunks num Buffer para anexar a um email, ver gerarReciboBuffer
   abaixo). `reserva` precisa de: id, check_in, check_out, guests,
   total_price, amount_paid, payment_status, payment_method, customer_name,
   customer_email, customer_phone, customer_country, units(name),
   operators(name, address, email, phone, currency, logo_url, slug).
   `bookingUrl` (obrigatorio pelo checklist da SISP -- "URL da loja") e a
   pagina publica de onde a reserva foi feita, nunca inventada. */
async function desenharRecibo(doc, reserva, bookingUrl) {
  const operatorLogoBuffer = await fetchOperatorLogoPng(reserva.operators?.logo_url);

  const OCEAN_800 = '#0A3F55';
  const OCEAN_700 = '#0D5470';
  const OCEAN_100 = '#D6EEF5';
  const N900 = '#1A2332';
  const N600 = '#4B5563';
  const N500 = '#6B7280';
  const N200 = '#E5E8EC';
  const N50  = '#F9FAFB';

  const moeda   = reserva.operators?.currency || 'EUR';
  const ref      = reserva.id.slice(0, 8).toUpperCase();
  const nights   = reserva.check_out && reserva.check_out !== reserva.check_in
    ? Math.round((new Date(reserva.check_out) - new Date(reserva.check_in)) / 86400000)
    : null;
  const total          = Number(reserva.total_price || 0);
  const pago           = Number(reserva.amount_paid || 0);
  const saldoPendente  = Math.max(total - pago, 0);
  const statusColor    = PAYMENT_STATUS_COLOR[reserva.payment_status] || N500;
  const statusLabel    = PAYMENT_LABEL_PT[reserva.payment_status] || reserva.payment_status || '—';
  const metodoLabel    = PAYMENT_METHOD_LABEL_PT[reserva.payment_method] || reserva.payment_method || '—';
  const totalCve       = moeda !== 'CVE' ? Math.round(total * CVE_PER_EUR) : null;

  const PAGE_W    = doc.page.width;
  const MARGIN    = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const COL_GAP   = 30;
  const COL_W     = (CONTENT_W - COL_GAP) / 2;
  const COL_L_X   = MARGIN;
  const COL_R_X   = MARGIN + COL_W + COL_GAP;

  /* Faixa de topo -- identidade SalDesk, nunca do operador (o recibo e
     emitido PELA plataforma em nome do operador, nao pelo operador). */
  doc.rect(0, 0, PAGE_W, 108).fill(OCEAN_800);
  doc.image(LOGO_WHITE_PATH, MARGIN, 24, { height: 60 });
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#FFFFFF')
    .text('RECIBO', MARGIN, 34, { width: CONTENT_W, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(OCEAN_100)
    .text(`Nº ${ref}  ·  Emitido em ${fmtDatePt(new Date())}`, MARGIN, 60, { width: CONTENT_W, align: 'right' });

  /* Faixa de estado -- pilula colorida consoante o estado do pagamento,
     primeira coisa que os olhos encontram abaixo do cabecalho. */
  const pillLabel = statusLabel.toUpperCase();
  const pillW = doc.font('Helvetica-Bold').fontSize(9).widthOfString(pillLabel) + 22;
  doc.roundedRect(PAGE_W - MARGIN - pillW, 78, pillW, 18, 9).fill(statusColor);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
    .text(pillLabel, PAGE_W - MARGIN - pillW, 83, { width: pillW, align: 'center' });

  let y = 140;

  /* Prestador do servico | Cliente -- duas colunas lado a lado. */
  doc.font('Helvetica-Bold').fontSize(9).fillColor(OCEAN_700).text('PRESTADOR DO SERVIÇO', COL_L_X, y);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(OCEAN_700).text('CLIENTE', COL_R_X, y);
  y += 16;

  const LOGO_BOX = 34;
  const opNameOffsetX = operatorLogoBuffer ? LOGO_BOX + 10 : 0;
  const opNameW = COL_W - opNameOffsetX;
  const opNameH = doc.font('Helvetica-Bold').fontSize(11).heightOfString(reserva.operators?.name || '—', { width: opNameW });
  const custNameH = doc.font('Helvetica-Bold').fontSize(11).heightOfString(reserva.customer_name || '—', { width: COL_W });

  if (operatorLogoBuffer) {
    doc.image(operatorLogoBuffer, COL_L_X, y, { fit: [LOGO_BOX, LOGO_BOX] });
  }
  doc.font('Helvetica-Bold').fontSize(11).fillColor(N900)
    .text(reserva.operators?.name || '—', COL_L_X + opNameOffsetX, operatorLogoBuffer ? y + Math.max(0, (LOGO_BOX - opNameH) / 2) : y, { width: opNameW });
  doc.font('Helvetica-Bold').fontSize(11).fillColor(N900).text(reserva.customer_name || '—', COL_R_X, y, { width: COL_W });
  y += Math.max(operatorLogoBuffer ? LOGO_BOX : opNameH, custNameH) + 4;

  const enderecoH = reserva.operators?.address
    ? doc.font('Helvetica').fontSize(9).heightOfString(reserva.operators.address, { width: COL_W })
    : 0;
  if (reserva.operators?.address) {
    doc.font('Helvetica').fontSize(9).fillColor(N600).text(reserva.operators.address, COL_L_X, y, { width: COL_W });
  }
  if (reserva.customer_country) {
    doc.font('Helvetica').fontSize(9).fillColor(N600).text(reserva.customer_country, COL_R_X, y, { width: COL_W });
  }
  y += Math.max(enderecoH, reserva.customer_country ? 12 : 0) + 4;

  if (reserva.operators?.email) doc.font('Helvetica').fontSize(9).fillColor(N600).text(reserva.operators.email, COL_L_X, y, { width: COL_W });
  if (reserva.customer_email)   doc.font('Helvetica').fontSize(9).fillColor(N600).text(reserva.customer_email, COL_R_X, y, { width: COL_W });
  y += 14;

  /* Telefone -- do operador (novo, exigido pelo checklist da SISP:
     "nome+telefone+email do comerciante") e do cliente, lado a lado na
     mesma linha quando algum dos dois existir. */
  if (reserva.operators?.phone) doc.font('Helvetica').fontSize(9).fillColor(N600).text(reserva.operators.phone, COL_L_X, y, { width: COL_W });
  if (reserva.customer_phone)   doc.font('Helvetica').fontSize(9).fillColor(N600).text(reserva.customer_phone, COL_R_X, y, { width: COL_W });
  if (reserva.operators?.phone || reserva.customer_phone) y += 14;

  y += 14;
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(N200).stroke();
  y += 22;

  /* Tabela de detalhes da reserva -- uma so linha (o recibo cobre sempre
     uma reserva), mas com a estrutura visual de uma factura a serio. */
  doc.font('Helvetica-Bold').fontSize(9).fillColor(OCEAN_700).text('DETALHES DA RESERVA', MARGIN, y);
  y += 18;

  const TBL_X = MARGIN;
  const TBL_W = CONTENT_W;
  const COL_SERVICO_X = TBL_X + 10;
  const COL_SERVICO_W = 195;
  const COL_DATAS_X   = TBL_X + 210;
  const COL_DATAS_W   = 140;
  const COL_PESSOAS_X = TBL_X + 355;
  const COL_PESSOAS_W = 50;
  const COL_TOTAL_X   = TBL_X + 410;
  const COL_TOTAL_W   = TBL_W - 420;

  const HEADER_H = 24;
  doc.rect(TBL_X, y, TBL_W, HEADER_H).fill(N50);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(N500);
  doc.text('SERVIÇO', COL_SERVICO_X, y + 8);
  doc.text('DATA', COL_DATAS_X, y + 8);
  doc.text('PESSOAS', COL_PESSOAS_X, y + 8);
  doc.text('TOTAL', COL_TOTAL_X, y + 8, { width: COL_TOTAL_W, align: 'right' });
  y += HEADER_H;

  const datasTexto = nights
    ? `${fmtDatePt(reserva.check_in)} – ${fmtDatePt(reserva.check_out)} (${nights} noite${nights > 1 ? 's' : ''})`
    : fmtDatePt(reserva.check_in);
  const servicoH = doc.font('Helvetica-Bold').fontSize(10).heightOfString(reserva.units?.name || '—', { width: COL_SERVICO_W });
  const ROW_H = Math.max(30, servicoH + 16);

  doc.rect(TBL_X, y, TBL_W, ROW_H).strokeColor(N200).stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor(N900).text(reserva.units?.name || '—', COL_SERVICO_X, y + 9, { width: COL_SERVICO_W });
  doc.font('Helvetica').fontSize(9).fillColor(N600).text(datasTexto, COL_DATAS_X, y + 10, { width: COL_DATAS_W });
  doc.font('Helvetica').fontSize(9).fillColor(N600).text(String(reserva.guests || 1), COL_PESSOAS_X, y + 10, { width: COL_PESSOAS_W });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(N900).text(fmtMoneyPt(total, moeda), COL_TOTAL_X, y + 9, { width: COL_TOTAL_W, align: 'right' });
  y += ROW_H + 24;

  /* Resumo de pagamento -- caixa alinhada a direita, mesmo padrao visual
     de uma factura real (total sempre a fila mais destacada). */
  const BOX_W = 240;
  const BOX_X = PAGE_W - MARGIN - BOX_W;
  let by = y;

  const resumoLinha = (label, value, opts = {}) => {
    doc.font('Helvetica').fontSize(9.5).fillColor(N600).text(label, BOX_X, by, { width: BOX_W - 90 });
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.bold ? 11 : 9.5)
      .fillColor(opts.color || N900).text(value, BOX_X + BOX_W - 90, by, { width: 90, align: 'right' });
    by += opts.bold ? 20 : 16;
  };

  resumoLinha('Total da reserva', fmtMoneyPt(total, moeda));
  if (totalCve) resumoLinha('Total (CVE)', `${totalCve.toLocaleString('pt-PT')} CVE`);
  resumoLinha('Valor pago', fmtMoneyPt(pago, moeda));
  if (saldoPendente > 0.005) resumoLinha('Saldo pendente', fmtMoneyPt(saldoPendente, moeda), { color: PAYMENT_STATUS_COLOR.pending });
  doc.moveTo(BOX_X, by + 2).lineTo(BOX_X + BOX_W, by + 2).strokeColor(N200).stroke();
  by += 10;
  resumoLinha('Método de pagamento', metodoLabel);

  y = by + 30;

  /* Rodape -- inclui a URL da loja (exigido pelo checklist da SISP). */
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(N200).stroke();
  y += 14;
  doc.font('Helvetica').fontSize(8).fillColor(N500)
    .text('Este documento é um recibo informativo da reserva, emitido pela plataforma SalDesk em nome do operador indicado. Não substitui factura fiscal quando esta seja legalmente exigida.', MARGIN, y, { width: CONTENT_W });
  y += 28;
  if (bookingUrl) {
    doc.font('Helvetica').fontSize(8).fillColor(N600).text(bookingUrl, MARGIN, y, { width: CONTENT_W });
    y += 16;
  }
  doc.font('Helvetica-Bold').fontSize(8).fillColor(OCEAN_700).text('SalDesk', MARGIN, y, { continued: true });
  doc.font('Helvetica').fontSize(8).fillColor(N500).text('  ·  saldesk.cv  ·  hello@saldesk.cv');
}

/* Gera o PDF completo como Buffer, para anexar a um email (ex. no momento
   real da confirmacao de pagamento) -- nunca escreve em disco nem depende
   de um objecto `res` do Express. */
function gerarReciboBuffer(reserva, bookingUrl) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    desenharRecibo(doc, reserva, bookingUrl)
      .then(() => doc.end())
      .catch(reject);
  });
}

const PLAN_LABEL_PT = { starter: 'Starter', business: 'Business', pro: 'Pro' };

/* Recibo da SUBSCRICAO SalDesk (operador paga a plataforma) -- papel
   invertido face a desenharRecibo: aqui a SalDesk e' o "Prestador do
   Servico" e o operador e' o "Cliente". Corpo bem mais simples (um so
   plano mensal, sem noites/pessoas), mas mesma identidade visual e mesmos
   campos exigidos pelo checklist da SISP (referencia unica, data, valor
   discriminado +CVE, dados completos de quem emite/quem paga). */
async function desenharReciboFacturacao(doc, payment, operator) {
  const OCEAN_800 = '#0A3F55';
  const OCEAN_700 = '#0D5470';
  const OCEAN_100 = '#D6EEF5';
  const N900 = '#1A2332';
  const N600 = '#4B5563';
  const N500 = '#6B7280';
  const N200 = '#E5E8EC';
  const N50  = '#F9FAFB';

  const ref = payment.id.slice(0, 8).toUpperCase();
  const amountEur = Number(payment.amount_eur || 0);
  const amountCve = Math.round(amountEur * CVE_PER_EUR);
  const planLabel = PLAN_LABEL_PT[payment.plan] || payment.plan;
  const metodoLabel = PAYMENT_METHOD_LABEL_PT[payment.gateway] || payment.gateway || '—';
  const dataEmissao = payment.completed_at || payment.created_at;

  const PAGE_W    = doc.page.width;
  const MARGIN    = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const COL_GAP   = 30;
  const COL_W     = (CONTENT_W - COL_GAP) / 2;
  const COL_L_X   = MARGIN;
  const COL_R_X   = MARGIN + COL_W + COL_GAP;

  doc.rect(0, 0, PAGE_W, 108).fill(OCEAN_800);
  doc.image(LOGO_WHITE_PATH, MARGIN, 24, { height: 60 });
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#FFFFFF')
    .text('RECIBO', MARGIN, 34, { width: CONTENT_W, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(OCEAN_100)
    .text(`Nº ${ref}  ·  Emitido em ${fmtDatePt(new Date())}`, MARGIN, 60, { width: CONTENT_W, align: 'right' });

  const pillLabel = 'PAGO';
  const pillW = doc.font('Helvetica-Bold').fontSize(9).widthOfString(pillLabel) + 22;
  doc.roundedRect(PAGE_W - MARGIN - pillW, 78, pillW, 18, 9).fill(PAYMENT_STATUS_COLOR.paid);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
    .text(pillLabel, PAGE_W - MARGIN - pillW, 83, { width: pillW, align: 'center' });

  let y = 140;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(OCEAN_700).text('PRESTADOR DO SERVIÇO', COL_L_X, y);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(OCEAN_700).text('CLIENTE', COL_R_X, y);
  y += 16;

  doc.font('Helvetica-Bold').fontSize(11).fillColor(N900).text('SalDesk', COL_L_X, y, { width: COL_W });
  doc.font('Helvetica-Bold').fontSize(11).fillColor(N900).text(operator?.name || '—', COL_R_X, y, { width: COL_W });
  y += 18;

  doc.font('Helvetica').fontSize(9).fillColor(N600).text('saldesk.cv', COL_L_X, y, { width: COL_W });
  if (operator?.address) doc.font('Helvetica').fontSize(9).fillColor(N600).text(operator.address, COL_R_X, y, { width: COL_W });
  y += 14;

  doc.font('Helvetica').fontSize(9).fillColor(N600).text('hello@saldesk.cv', COL_L_X, y, { width: COL_W });
  if (operator?.email) doc.font('Helvetica').fontSize(9).fillColor(N600).text(operator.email, COL_R_X, y, { width: COL_W });
  y += 14;

  if (operator?.phone) { doc.font('Helvetica').fontSize(9).fillColor(N600).text(operator.phone, COL_R_X, y, { width: COL_W }); y += 14; }

  y += 14;
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(N200).stroke();
  y += 22;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(OCEAN_700).text('DETALHES DA SUBSCRIÇÃO', MARGIN, y);
  y += 18;

  const TBL_X = MARGIN;
  const TBL_W = CONTENT_W;
  const COL_SERVICO_X = TBL_X + 10;
  const COL_SERVICO_W = 260;
  const COL_DATAS_X   = TBL_X + 280;
  const COL_DATAS_W   = 140;
  const COL_TOTAL_X   = TBL_X + 430;
  const COL_TOTAL_W   = TBL_W - 440;

  const HEADER_H = 24;
  doc.rect(TBL_X, y, TBL_W, HEADER_H).fill(N50);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(N500);
  doc.text('SERVIÇO', COL_SERVICO_X, y + 8);
  doc.text('DATA', COL_DATAS_X, y + 8);
  doc.text('TOTAL', COL_TOTAL_X, y + 8, { width: COL_TOTAL_W, align: 'right' });
  y += HEADER_H;

  const ROW_H = 30;
  doc.rect(TBL_X, y, TBL_W, ROW_H).strokeColor(N200).stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor(N900).text(`Subscrição SalDesk — Plano ${planLabel}`, COL_SERVICO_X, y + 9, { width: COL_SERVICO_W });
  doc.font('Helvetica').fontSize(9).fillColor(N600).text(fmtDatePt(dataEmissao) || '—', COL_DATAS_X, y + 10, { width: COL_DATAS_W });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(N900).text(fmtMoneyPt(amountEur, 'EUR'), COL_TOTAL_X, y + 9, { width: COL_TOTAL_W, align: 'right' });
  y += ROW_H + 24;

  const BOX_W = 240;
  const BOX_X = PAGE_W - MARGIN - BOX_W;
  let by = y;
  const resumoLinha = (label, value) => {
    doc.font('Helvetica').fontSize(9.5).fillColor(N600).text(label, BOX_X, by, { width: BOX_W - 90 });
    doc.font('Helvetica').fontSize(9.5).fillColor(N900).text(value, BOX_X + BOX_W - 90, by, { width: 90, align: 'right' });
    by += 16;
  };
  resumoLinha('Total', fmtMoneyPt(amountEur, 'EUR'));
  resumoLinha('Total (CVE)', `${amountCve.toLocaleString('pt-PT')} CVE`);
  doc.moveTo(BOX_X, by + 2).lineTo(BOX_X + BOX_W, by + 2).strokeColor(N200).stroke();
  by += 10;
  resumoLinha('Método de pagamento', metodoLabel);

  y = by + 30;
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(N200).stroke();
  y += 14;
  doc.font('Helvetica').fontSize(8).fillColor(N500)
    .text('Este documento é um recibo informativo da subscrição da plataforma SalDesk. Não substitui factura fiscal quando esta seja legalmente exigida.', MARGIN, y, { width: CONTENT_W });
  y += 28;
  doc.font('Helvetica').fontSize(8).fillColor(N600).text('https://app.saldesk.cv/definicoes?tab=facturacao', MARGIN, y, { width: CONTENT_W });
  y += 16;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(OCEAN_700).text('SalDesk', MARGIN, y, { continued: true });
  doc.font('Helvetica').fontSize(8).fillColor(N500).text('  ·  saldesk.cv  ·  hello@saldesk.cv');
}

function gerarReciboFacturacaoBuffer(payment, operator) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    desenharReciboFacturacao(doc, payment, operator)
      .then(() => doc.end())
      .catch(reject);
  });
}

module.exports = { desenharRecibo, gerarReciboBuffer, gerarReciboFacturacaoBuffer, fetchOperatorLogoPng };
