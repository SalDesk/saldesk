const { supabaseAdmin } = require('../config/supabase');
const { enviarEmail } = require('../helpers/emailHelper');
const crypto = require('crypto');

async function listar(req, res, next) {
  try {
    const { is_public, min_rating } = req.query;
    let q = supabaseAdmin
      .from('reviews')
      .select('*, reservations(check_in, check_out, units(name)), customers(first_name, last_name, country_code)')
      .eq('operator_id', req.operator.id)
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
      .from('reviews').select('rating').eq('operator_id', req.operator.id);
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
      .select('id, customer_name, customer_email, customer_id, check_out, operator_id')
      .eq('id', reservation_id).eq('operator_id', req.operator.id).single();
    if (!reserva) return res.status(404).json({ error: 'Reserva nao encontrada', code: 'NOT_FOUND' });
    if (!reserva.customer_email) return res.status(400).json({ error: 'Cliente sem email', code: 'NO_EMAIL' });

    const token = crypto.randomBytes(20).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: upsertErr } = await supabaseAdmin.from('reviews').upsert({
      operator_id: req.operator.id, reservation_id, customer_id: reserva.customer_id || null,
      review_token: token, token_expires_at: expires, rating: 5,
    }, { onConflict: 'reservation_id' });
    if (upsertErr) throw upsertErr;

    const publicUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${publicUrl}/review/${token}`;

    await enviarEmail({
      to: reserva.customer_email,
      subject: `Como foi a sua experiencia com ${req.operator.name}?`,
      text: `Ola ${reserva.customer_name},\n\nObrigado pela sua visita! Gostavamos que partilhasse a sua opiniao.\n\nAvaliar agora: ${link}\n\nObrigado!`,
    }).catch(() => {});

    return res.json({ data: { token, link }, message: 'Pedido de avaliacao enviado' });
  } catch (err) { next(err); }
}

async function submitReview(req, res, next) {
  try {
    const { token, rating, comment, staff_id } = req.body;
    if (!token || !rating) return res.status(400).json({ error: 'Token e rating obrigatorios', code: 'MISSING_FIELDS' });

    const { data: review } = await supabaseAdmin
      .from('reviews').select('id, token_expires_at').eq('review_token', token).single();
    if (!review) return res.status(404).json({ error: 'Link invalido', code: 'NOT_FOUND' });
    if (new Date(review.token_expires_at) < new Date()) {
      return res.status(410).json({ error: 'Link expirado', code: 'EXPIRED' });
    }

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .update({ rating: parseInt(rating), comment: comment || null, staff_id: staff_id || null, review_token: null, token_expires_at: null })
      .eq('id', review.id).select().single();
    if (error) throw error;

    if (data.staff_id) {
      const { data: staff } = await supabaseAdmin.from('staff').select('average_rating, total_jobs_completed').eq('id', data.staff_id).single();
      if (staff) {
        const n = staff.total_jobs_completed || 1;
        const newAvg = ((staff.average_rating || 0) * (n - 1) + parseInt(rating)) / n;
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
      .select('rating, comment, reply_text, replied_at, created_at, customers(first_name, country_code)')
      .eq('operator_id', op.id).eq('is_public', true).not('rating', 'is', null).not('review_token', 'not.is', null)
      .order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return res.json({ data, message: 'Avaliacoes publicas' });
  } catch (err) { next(err); }
}

module.exports = { listar, stats, requestReview, submitReview, reply, publicReviews };
