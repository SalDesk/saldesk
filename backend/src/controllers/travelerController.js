const { supabaseAdmin } = require('../config/supabase');

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

    const enriched = reservations.map(r => ({
      ...r,
      operator_name: operatorMap[r.operator_id]?.name || null,
      operator_slug: operatorMap[r.operator_id]?.slug || null,
      unit_name: unitMap[r.unit_id]?.name || null,
      unit_image: unitMap[r.unit_id]?.images?.[0] || null,
    }));

    return res.json({ data: enriched, message: 'Reservas listadas' });
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

module.exports = { getProfile, updateProfile, getBookings, getWishlist, addWishlist, removeWishlist };
