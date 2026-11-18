const { supabaseAdmin } = require('../config/supabase');

/* Texto por omissao (neutro: serve actividades, hoteis, rent-a-car e restaurantes) */
const { DEFAULT_TEMPLATE, estadoDoToken } = require('../helpers/pedidoAvaliacao');
const { detectarIdioma } = require('../helpers/languageHelper');
const { enviarPedido } = require('../services/pedidoAvaliacaoService');

async function obterTemplate(req, res, next) {
  try {
    const { data } = await supabaseAdmin
      .from('review_request_templates').select('*').eq('operator_id', req.operator.id).maybeSingle();
    if (data) return res.json({ data, message: 'Template de pedido de avaliacao' });
    return res.json({ data: { operator_id: req.operator.id, ...DEFAULT_TEMPLATE }, message: 'Template de pedido de avaliacao (default)' });
  } catch (err) { next(err); }
}

async function actualizarTemplate(req, res, next) {
  try {
    const { subject_pt, subject_en, body_pt, body_en } = req.body;
    const updates = { operator_id: req.operator.id, updated_at: new Date().toISOString() };
    if (subject_pt !== undefined) updates.subject_pt = subject_pt;
    if (subject_en !== undefined) updates.subject_en = subject_en;
    if (body_pt !== undefined) updates.body_pt = body_pt;
    if (body_en !== undefined) updates.body_en = body_en;

    const { data, error } = await supabaseAdmin
      .from('review_request_templates').upsert(updates, { onConflict: 'operator_id' }).select().single();
    if (error) throw error;
    return res.json({ data, message: 'Template actualizado' });
  } catch (err) { next(err); }
}

async function listar(req, res, next) {
  try {
    const { is_public, min_rating } = req.query;
    let q = supabaseAdmin
      .from('reviews')
      .select('*, reservations(check_in, check_out, units(name)), customers(name, country_code)')
      .eq('operator_id', req.operator.id)
      /* so avaliacoes dadas: os pedidos por responder (rating null) nao sao avaliacoes */
      .not('rating', 'is', null)
      .order('created_at', { ascending: false });
    if (is_public !== undefined) q = q.eq('is_public', is_public === 'true');
    if (min_rating) q = q.gte('rating', parseInt(min_rating));
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ data, message: 'Avaliacoes listadas' });
  } catch (err) { next(err); }
}

async function stats(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('reviews').select('rating').eq('operator_id', req.operator.id).not('rating', 'is', null);
    if (error) throw error;
    const ratings = data || [];
    const total   = ratings.length;
    const average = total ? ratings.reduce((s, r) => s + r.rating, 0) / total : 0;
    const distribution = [5,4,3,2,1].map((r) => ({
      rating: r, count: ratings.filter((x) => x.rating === r).length,
    }));
    return res.json({ data: { total, average: Math.round(average * 10) / 10, distribution }, message: 'Stats calculadas' });
  } catch (err) { next(err); }
}

async function requestReview(req, res, next) {
  try {
    const { reservation_id } = req.body;
    const { data: reserva } = await supabaseAdmin
      .from('reservations')
      .select('id, customer_name, customer_email, customer_id, customer_country, check_out, operator_id, units(name)')
      .eq('id', reservation_id).eq('operator_id', req.operator.id).single();
    if (!reserva) return res.status(404).json({ error: 'Reserva nao encontrada', code: 'NOT_FOUND' });

    /* mesmo codigo da tarefa diaria; nunca substitui uma avaliacao ja dada */
    const r = await enviarPedido(reserva, { operadorId: req.operator.id });
    if (!r.ok && r.code === 'NO_EMAIL') return res.status(400).json({ error: 'Cliente sem email', code: 'NO_EMAIL' });
    if (!r.ok && r.code === 'ALREADY_REVIEWED') return res.status(409).json({ error: 'Esta reserva ja foi avaliada', code: 'ALREADY_REVIEWED' });

    return res.json({ data: { token: r.token, link: r.link }, message: 'Pedido de avaliacao enviado' });
  } catch (err) { next(err); }
}

/* GET /reviews/token/:token (publico): o minimo para a pagina de avaliacao mostrar o que se
   avalia. Nunca devolve e-mail, telefone, precos nem ids internos. */
async function tokenInfo(req, res, next) {
  try {
    const token = String(req.params.token || '');
    if (!/^[a-f0-9]{40}$/.test(token)) return res.json({ data: { estado: 'invalido' } });

    const { data: review } = await supabaseAdmin
      .from('reviews').select('review_token, token_expires_at, operator_id, reservation_id')
      .eq('review_token', token).maybeSingle();
    const estado = estadoDoToken(review, new Date());
    if (estado === 'invalido') return res.json({ data: { estado } });

    const { data: op } = await supabaseAdmin
      .from('operators').select('name, slug, brand_color').eq('id', review.operator_id).maybeSingle();
    const operador = { name: op?.name || '', slug: op?.slug || '', brand_color: op?.brand_color || null };
    if (estado === 'expirado') return res.json({ data: { estado, operador } });

    const { data: reserva } = await supabaseAdmin
      .from('reservations').select('customer_name, customer_country, check_in, units(name)')
      .eq('id', review.reservation_id).maybeSingle();
    const primeiroNome = String(reserva?.customer_name || '').trim().split(/\s+/)[0] || null;
    return res.json({
      data: {
        estado,
        operador,
        unidade: reserva?.units?.name || null,
        data: reserva?.check_in ? String(reserva.check_in).slice(0, 10) : null,
        cliente: primeiroNome,
        lingua: detectarIdioma(reserva?.customer_country) === 'en' ? 'en' : 'pt',
      },
    });
  } catch (err) { next(err); }
}

/* GET/PUT /reviews/settings: o operador liga ou desliga o pedido automatico (ligado por omissao) */
async function obterDefinicoes(req, res, next) {
  try {
    const { data } = await supabaseAdmin
      .from('operators').select('review_auto_request').eq('id', req.operator.id).maybeSingle();
    return res.json({ data: { review_auto_request: data?.review_auto_request !== false } });
  } catch (err) { next(err); }
}

async function guardarDefinicoes(req, res, next) {
  try {
    const valor = req.body?.review_auto_request;
    if (typeof valor !== 'boolean') {
      return res.status(400).json({ error: 'review_auto_request tem de ser verdadeiro ou falso', code: 'INVALID_VALUE' });
    }
    const { error } = await supabaseAdmin
      .from('operators').update({ review_auto_request: valor }).eq('id', req.operator.id);
    if (error) throw error;
    return res.json({ data: { review_auto_request: valor }, message: 'Definicao guardada' });
  } catch (err) { next(err); }
}

async function submitReview(req, res, next) {
  try {
    /* staff_id nao vem do publico: quem tem o link so da a nota e o comentario */
    const { token, rating, comment } = req.body;
    if (!token || rating === undefined || rating === null || rating === '') {
      return res.status(400).json({ error: 'Token e rating obrigatorios', code: 'MISSING_FIELDS' });
    }
    const nota = Number(rating);
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
      return res.status(400).json({ error: 'A nota tem de ser de 1 a 5', code: 'INVALID_RATING' });
    }
    const texto = comment ? String(comment).trim() : '';
    if (texto.length > 1000) {
      return res.status(400).json({ error: 'Comentario demasiado longo (maximo 1000 caracteres)', code: 'COMMENT_TOO_LONG' });
    }

    const { data: review } = await supabaseAdmin
      .from('reviews').select('id, token_expires_at').eq('review_token', token).single();
    if (!review) return res.status(404).json({ error: 'Link invalido', code: 'NOT_FOUND' });
    if (new Date(review.token_expires_at) < new Date()) {
      return res.status(410).json({ error: 'Link expirado', code: 'EXPIRED' });
    }

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .update({ rating: nota, comment: texto || null, review_token: null, token_expires_at: null, is_public: true })
      .eq('id', review.id).select().single();
    if (error) throw error;

    supabaseAdmin.from('notifications').insert({
      operator_id:        data.operator_id,
      notification_type:  'new_review',
      content:             `Nova avaliacao de ${nota} estrelas recebida`,
      link:                '/avaliacoes',
    }).then(({ error: notifErr }) => {
      if (notifErr) console.error('[Notificacao] Erro ao criar notificacao:', notifErr.message);
    });

    if (data.staff_id) {
      const { data: staff } = await supabaseAdmin.from('staff').select('average_rating, total_jobs_completed').eq('id', data.staff_id).single();
      if (staff) {
        const n = staff.total_jobs_completed || 1;
        const newAvg = ((staff.average_rating || 0) * (n - 1) + nota) / n;
        await supabaseAdmin.from('staff').update({ average_rating: Math.round(newAvg * 100) / 100 }).eq('id', data.staff_id);
      }
    }

    return res.json({ data, message: 'Avaliacao submetida. Obrigado!' });
  } catch (err) { next(err); }
}

async function reply(req, res, next) {
  try {
    const { reply_text } = req.body;
    if (!reply_text) return res.status(400).json({ error: 'Texto de resposta obrigatorio', code: 'MISSING_FIELDS' });
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .update({ reply_text, replied_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('operator_id', req.operator.id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Avaliacao nao encontrada', code: 'NOT_FOUND' });
    return res.json({ data, message: 'Resposta publicada' });
  } catch (err) { next(err); }
}

async function publicReviews(req, res, next) {
  try {
    const { data: op } = await supabaseAdmin.from('operators').select('id').eq('slug', req.params.slug).single();
    if (!op) return res.status(404).json({ error: 'Operador nao encontrado', code: 'NOT_FOUND' });
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('rating, comment, reply_text, replied_at, created_at, customers(name, country_code)')
      .eq('operator_id', op.id).eq('is_public', true).not('rating', 'is', null).not('review_token', 'not.is', null)
      .order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return res.json({ data, message: 'Avaliacoes publicas' });
  } catch (err) { next(err); }
}

module.exports = { listar, stats, requestReview, submitReview, reply, publicReviews, obterTemplate, actualizarTemplate, tokenInfo, obterDefinicoes, guardarDefinicoes };
