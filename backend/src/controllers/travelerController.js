const { supabaseAdmin } = require('../config/supabase');
const { getDiscoverCatalog } = require('../services/discoverCatalogService');

async function getProfile(req, res) {
  return res.json({ data: req.traveler, message: 'Perfil do viajante' });
}

async function updateProfile(req, res, next) {
  try {
    const { name, phone, country, language } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone || null;
    if (country !== undefined) updates.country = country || null;
    if (language !== undefined) updates.language = language;

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

module.exports = { getProfile, updateProfile, getBookings, getWishlist, addWishlist, removeWishlist, submitReview, getRecommendations };
