const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const { supabaseAdmin } = require('../config/supabase');
const { getDiscoverCatalog } = require('../services/discoverCatalogService');
const PDFDocument = require('pdfkit');

const LOGO_WHITE_PATH = path.join(__dirname, '../assets/logo-white.png');

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

async function getProfile(req, res) {
  return res.json({ data: req.traveler, message: 'Perfil do viajante' });
}

async function updateProfile(req, res, next) {
  try {
    const { name, phone, country, language, avatar_url } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone || null;
    if (country !== undefined) updates.country = country || null;
    if (language !== undefined) updates.language = language;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url || null;

    const { data, error } = await supabaseAdmin
      .from('travelers')
      .update(updates)
      .eq('id', req.traveler.id)
      .select()
      .single();

    if (error) throw error;
    return res.json({ data, message: 'Perfil actualizado' });
  } catch (err) {
    next(err);
  }
}

/* Reservas do viajante entre TODOS os operadores -- reservations.customer_email
   ja e denormalizado por linha, sem depender de customers (que e so CRM por
   operador). Case-insensitive porque o email e escrito livremente em cada
   formulario de reserva, sem normalizacao garantida. */
async function getBookings(req, res, next) {
  try {
    const email = req.traveler.email.trim().toLowerCase();

    const { data: reservations, error } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .ilike('customer_email', email)
      .order('check_in', { ascending: false });

    if (error) throw error;
    if (!reservations?.length) return res.json({ data: [] });

    const operatorIds = [...new Set(reservations.map(r => r.operator_id))];
    const unitIds = [...new Set(reservations.map(r => r.unit_id))];

    const [{ data: operators }, { data: units }] = await Promise.all([
      supabaseAdmin.from('operators').select('id, name, slug').in('id', operatorIds),
      supabaseAdmin.from('units').select('id, name, images').in('id', unitIds),
    ]);

    const operatorMap = Object.fromEntries((operators || []).map(o => [o.id, o]));
    const unitMap = Object.fromEntries((units || []).map(u => [u.id, u]));

    const reservationIds = reservations.map(r => r.id);
    const { data: reviews } = await supabaseAdmin
      .from('reviews')
      .select('reservation_id, rating, comment')
      .in('reservation_id', reservationIds)
      .not('rating', 'is', null);
    const reviewMap = Object.fromEntries((reviews || []).map(rv => [rv.reservation_id, rv]));

    const enriched = reservations.map(r => ({
      ...r,
      operator_name: operatorMap[r.operator_id]?.name || null,
      operator_slug: operatorMap[r.operator_id]?.slug || null,
      unit_name: unitMap[r.unit_id]?.name || null,
      unit_image: unitMap[r.unit_id]?.images?.[0] || null,
      review: reviewMap[r.id] || null,
      can_review: r.status === 'checked_out' && !reviewMap[r.id],
    }));

    return res.json({ data: enriched, message: 'Reservas listadas' });
  } catch (err) {
    next(err);
  }
}

/* So permite avaliar reservas ja concluidas (checked_out) e que pertencam
   mesmo ao viajante autenticado (por customer_email, mesma verificacao de
   getBookings) -- nunca confia no reservation_id vindo do cliente sem
   validar a posse. Reaproveita a mesma tabela reviews e o mesmo efeito
   (is_public=true ao submeter, sem fila de moderacao) do fluxo existente
   por token em reviewController.js, mas dispensa o token porque o viajante
   ja esta autenticado. */
async function submitReview(req, res, next) {
  try {
    const { reservationId } = req.params;
    const { rating, comment } = req.body;
    const email = req.traveler.email.trim().toLowerCase();

    const { data: reservation } = await supabaseAdmin
      .from('reservations')
      .select('id, operator_id, customer_email, status')
      .eq('id', reservationId)
      .maybeSingle();

    if (!reservation || reservation.customer_email.trim().toLowerCase() !== email) {
      return res.status(404).json({ error: 'Reserva não encontrada', code: 'NOT_FOUND' });
    }
    if (reservation.status !== 'checked_out') {
      return res.status(400).json({ error: 'So pode avaliar reservas ja concluidas', code: 'INVALID_STATUS' });
    }

    const { data: existing } = await supabaseAdmin
      .from('reviews')
      .select('id, rating')
      .eq('reservation_id', reservationId)
      .maybeSingle();

    if (existing?.rating) {
      return res.status(409).json({ error: 'Ja avaliou esta reserva', code: 'ALREADY_REVIEWED' });
    }

    const payload = { rating, comment: comment || null, is_public: true, review_token: null, token_expires_at: null };
    const { data, error } = existing
      ? await supabaseAdmin.from('reviews').update(payload).eq('id', existing.id).select().single()
      : await supabaseAdmin.from('reviews').insert({ operator_id: reservation.operator_id, reservation_id: reservationId, ...payload }).select().single();

    if (error) throw error;
    return res.status(201).json({ data, message: 'Avaliacao enviada, obrigado!' });
  } catch (err) {
    next(err);
  }
}

async function getWishlist(req, res, next) {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('traveler_wishlist')
      .select('*')
      .eq('traveler_id', req.traveler.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!rows?.length) return res.json({ data: [] });

    const unitIds = [...new Set(rows.map(r => r.unit_id))];
    const { data: units } = await supabaseAdmin
      .from('units')
      .select('id, name, images, base_price, unit_type, status, conect_status, operator_id')
      .in('id', unitIds);

    const operatorIds = [...new Set((units || []).map(u => u.operator_id))];
    const { data: operators } = await supabaseAdmin
      .from('operators').select('id, name, slug').in('id', operatorIds);

    const unitMap = Object.fromEntries((units || []).map(u => [u.id, u]));
    const operatorMap = Object.fromEntries((operators || []).map(o => [o.id, o]));

    const enriched = rows.map(r => {
      const unit = unitMap[r.unit_id];
      const operator = unit ? operatorMap[unit.operator_id] : null;
      return {
        unit_id: r.unit_id,
        saved_at: r.created_at,
        unit_name: unit?.name || null,
        images: unit?.images || [],
        base_price: unit?.base_price ?? null,
        unit_type: unit?.unit_type || null,
        still_published: unit?.conect_status === 'published' && unit?.status === 'active',
        operator_name: operator?.name || null,
        operator_slug: operator?.slug || null,
      };
    });

    return res.json({ data: enriched, message: 'Wishlist listada' });
  } catch (err) {
    next(err);
  }
}

async function addWishlist(req, res, next) {
  try {
    const { unit_id } = req.body;

    const { data, error } = await supabaseAdmin
      .from('traveler_wishlist')
      .insert({ traveler_id: req.traveler.id, unit_id })
      .select()
      .single();

    if (error) {
      /* unique(traveler_id, unit_id) -- ja guardado, devolve idempotentemente */
      if (error.code === '23505') {
        const { data: existing } = await supabaseAdmin
          .from('traveler_wishlist')
          .select('*')
          .eq('traveler_id', req.traveler.id)
          .eq('unit_id', unit_id)
          .single();
        return res.json({ data: existing, message: 'Ja estava na wishlist' });
      }
      throw error;
    }

    return res.status(201).json({ data, message: 'Adicionado a wishlist' });
  } catch (err) {
    next(err);
  }
}

async function removeWishlist(req, res, next) {
  try {
    const { error } = await supabaseAdmin
      .from('traveler_wishlist')
      .delete()
      .eq('traveler_id', req.traveler.id)
      .eq('unit_id', req.params.unitId);

    if (error) throw error;
    return res.json({ data: null, message: 'Removido da wishlist' });
  } catch (err) {
    next(err);
  }
}

/* Recomendacoes reais, baseadas em conteudo -- nunca ML, nunca fabricadas.
   Junta o historico do viajante (wishlist + reservas), deriva as
   categorias/ilhas que isso representa, e pontua o resto do catalogo por
   correspondencia (categoria pesa mais que ilha). Sem historico, ou sem
   nenhuma correspondencia (ex: category_id ainda nao preenchido em nenhuma
   unidade -- estado real da BD nesta data), cai honestamente no catalogo
   ja ordenado por popularidade que getDiscoverCatalog devolve -- o campo
   "personalized" na resposta e o que impede o frontend de alegar
   personalizacao que nao aconteceu. */
async function getRecommendations(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 6, 20);
    const email = req.traveler.email.trim().toLowerCase();

    const [{ data: wishRows }, { data: bookingRows }, catalog] = await Promise.all([
      supabaseAdmin.from('traveler_wishlist').select('unit_id').eq('traveler_id', req.traveler.id),
      supabaseAdmin.from('reservations').select('unit_id').ilike('customer_email', email),
      getDiscoverCatalog(),
    ]);

    const historyIds = new Set([
      ...(wishRows || []).map(r => r.unit_id),
      ...(bookingRows || []).map(r => r.unit_id),
    ]);
    const historyItems = catalog.filter(c => historyIds.has(c.unit_id));
    const categorySet = new Set(historyItems.map(i => i.category_id).filter(Boolean));
    const islandSet    = new Set(historyItems.map(i => i.island_id).filter(Boolean));
    const candidates   = catalog.filter(c => !historyIds.has(c.unit_id));

    let personalized = false;
    let ranked;

    if (categorySet.size === 0 && islandSet.size === 0) {
      ranked = candidates; // ja vem ordenado por recent_bookings desc, depois created_at desc
    } else {
      const scored = candidates.map(c => ({
        item: c,
        score: (categorySet.has(c.category_id) ? 2 : 0) + (islandSet.has(c.island_id) ? 1 : 0),
      }));
      const matched = scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score || (b.item.avg_rating || 0) - (a.item.avg_rating || 0) || b.item.recent_bookings - a.item.recent_bookings);

      if (matched.length) {
        personalized = true;
        ranked = [...matched.map(s => s.item), ...scored.filter(s => s.score === 0).map(s => s.item)];
      } else {
        ranked = candidates;
      }
    }

    return res.json({
      data: ranked.slice(0, limit),
      personalized,
      message: personalized ? 'Recomendacoes personalizadas' : 'Populares agora',
    });
  } catch (err) {
    next(err);
  }
}

/* Notificacoes reais (traveler_notifications) + um lembrete sintetico de
   "reserva por avaliar", calculado em tempo real a partir do mesmo sinal
   ja usado em getBookings (can_review) -- nunca guardado em duplicado.
   O lembrete sintetico usa id "review-reminder" e nao e marcavel via
   markNotificationRead (so as linhas reais da tabela sao). */
async function getNotifications(req, res, next) {
  try {
    const email = req.traveler.email.trim().toLowerCase();

    const [{ data: rows, error }, { data: reservas }] = await Promise.all([
      supabaseAdmin
        .from('traveler_notifications')
        .select('*')
        .eq('traveler_id', req.traveler.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('reservations')
        .select('id')
        .ilike('customer_email', email)
        .eq('status', 'checked_out'),
    ]);
    if (error) throw error;

    let pendingReview = 0;
    if (reservas?.length) {
      const ids = reservas.map(r => r.id);
      const { data: reviewed } = await supabaseAdmin
        .from('reviews')
        .select('reservation_id')
        .in('reservation_id', ids)
        .not('rating', 'is', null);
      const reviewedIds = new Set((reviewed || []).map(r => r.reservation_id));
      pendingReview = ids.filter(id => !reviewedIds.has(id)).length;
    }

    const notificacoes = [...(rows || [])];
    if (pendingReview > 0) {
      notificacoes.unshift({
        id: 'review-reminder',
        type: 'review_reminder',
        content: `Tem ${pendingReview} reserva${pendingReview > 1 ? 's' : ''} por avaliar.`,
        link: null,
        is_read: false,
        created_at: new Date().toISOString(),
        synthetic: true,
      });
    }

    const unread_count = notificacoes.filter(n => !n.is_read).length;

    return res.json({ data: notificacoes, unread_count, message: 'Notificacoes listadas' });
  } catch (err) {
    next(err);
  }
}

async function markNotificationRead(req, res, next) {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('traveler_notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('traveler_id', req.traveler.id);
    if (error) throw error;
    return res.json({ data: null, message: 'Notificacao marcada como lida' });
  } catch (err) {
    next(err);
  }
}

/* Recibo real por reserva -- a tab "Facturas" do portal (TravelerPortal.jsx)
   so mostrava a lista de reservas reaproveitada, sem nenhum documento
   descarregavel. Mesmo padrao visual/pdfkit ja usado no export financeiro
   do operador (financeiroController.js). ilike('customer_email', email) --
   mesmo filtro ja usado em getBookings, para nunca deixar um viajante
   descarregar o recibo de uma reserva que nao e dele. */
const PAYMENT_LABEL_PT        = { pending: 'Pendente', paid: 'Pago', partial: 'Parcial', refunded: 'Reembolsado' };
const PAYMENT_METHOD_LABEL_PT = { paypal: 'PayPal', sisp: 'SISP Vinti4', cash: 'Dinheiro', transfer: 'Transferência bancária' };
const PAYMENT_STATUS_COLOR    = { paid: '#1A7A4A', pending: '#BE941C', partial: '#BE941C', refunded: '#6B7280' };

/* timeZone:'UTC' e deliberado -- check_in/check_out sao colunas `date` puras
   (sem hora), e sem forcar UTC o fuso horario do servidor desloca a data
   exibida um dia para tras quando o servidor corre a oeste de UTC. */
function fmtDatePt(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

function fmtMoneyPt(value, moeda) {
  return `${moeda} ${Number(value || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function getBookingInvoice(req, res, next) {
  try {
    const email = req.traveler.email.trim().toLowerCase();
    const { data: reserva, error } = await supabaseAdmin
      .from('reservations')
      .select('*, units(name), operators(name, address, email, currency, logo_url)')
      .eq('id', req.params.id)
      .ilike('customer_email', email)
      .maybeSingle();
    if (error) throw error;
    if (!reserva) return res.status(404).json({ error: 'Reserva não encontrada', code: 'NOT_FOUND' });

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

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="recibo-${ref}.pdf"`);

    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    doc.pipe(res);

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

    if (reserva.customer_phone) {
      doc.font('Helvetica').fontSize(9).fillColor(N600).text(reserva.customer_phone, COL_R_X, y, { width: COL_W });
      y += 14;
    }

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
    resumoLinha('Valor pago', fmtMoneyPt(pago, moeda));
    if (saldoPendente > 0.005) resumoLinha('Saldo pendente', fmtMoneyPt(saldoPendente, moeda), { color: PAYMENT_STATUS_COLOR.pending });
    doc.moveTo(BOX_X, by + 2).lineTo(BOX_X + BOX_W, by + 2).strokeColor(N200).stroke();
    by += 10;
    resumoLinha('Método de pagamento', metodoLabel);

    y = by + 30;

    /* Rodape */
    doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(N200).stroke();
    y += 14;
    doc.font('Helvetica').fontSize(8).fillColor(N500)
      .text('Este documento é um recibo informativo da reserva, emitido pela plataforma SalDesk em nome do operador indicado. Não substitui factura fiscal quando esta seja legalmente exigida.', MARGIN, y, { width: CONTENT_W });
    y += 28;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(OCEAN_700).text('SalDesk', MARGIN, y, { continued: true });
    doc.font('Helvetica').fontSize(8).fillColor(N500).text('  ·  saldesk.cv  ·  hello@saldesk.cv');

    doc.end();
  } catch (err) { next(err); }
}

module.exports = {
  getProfile, updateProfile, getBookings, getBookingInvoice, getWishlist, addWishlist, removeWishlist, submitReview,
  getRecommendations, getNotifications, markNotificationRead,
};
