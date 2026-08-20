const { supabaseAdmin } = require('../config/supabase');

/* Extraido de publicController.js (discoverUnits) para ser reutilizado
   tambem por getRecommendations (travelerController.js) -- mesma logica
   de disponibilidade/rating/popularidade, uma unica fonte de verdade.
   category_id e island_id foram acrescentados ao select/mapeamento (antes
   so as etiquetas category_label_pt/en e island_name/slug eram devolvidas)
   -- sao os campos que a correspondencia de recomendacoes por conteudo
   precisa, e ja existiam no schema (database/038_conect.sql), so nao
   estavam expostos aqui. */
async function getDiscoverCatalog({ type } = {}) {
  let q = supabaseAdmin
    .from('operators')
    .select('id, name, slug, operator_type, address, currency, island_id, islands(name, slug)')
    .eq('onboarding_complete', true);

  if (type && ['hotel', 'activity', 'rentacar', 'restaurant'].includes(type)) {
    q = q.eq('operator_type', type);
  }

  const { data: operators, error } = await q;
  if (error) throw error;
  if (!operators?.length) return [];

  const operatorMap = {};
  operators.forEach((o) => { operatorMap[o.id] = o; });
  const ids = operators.map((o) => o.id);

  const { data: allUnits, error: unitsErr } = await supabaseAdmin
    .from('units')
    .select('id, operator_id, unit_type, name, description, base_price, images, created_at, duration_minutes, languages_offered, lat, lng, category_id, experience_categories(label_pt, label_en)')
    .in('operator_id', ids)
    .eq('status', 'active')
    .eq('conect_status', 'published');
  if (unitsErr) throw unitsErr;
  if (!allUnits?.length) return [];

  /* Mesas de restaurante nunca sao "produtos" navegaveis no catalogo agregado
     -- sao inventario interno, reservadas via o formulario proprio na pagina
     do restaurante (/book/{slug}), nao um card individual no Conect. Pratos e
     menus de degustacao (unit_type 'menu_item'/'tasting_menu') SAO elegiveis
     -- ficam reservaveis a partir do proprio card, ligando de volta ao
     formulario de reserva do restaurante com o prato pre-seleccionado. */
  const units = allUnits.filter((u) => {
    const op = operatorMap[u.operator_id];
    return op.operator_type !== 'restaurant' || ['menu_item', 'tasting_menu'].includes(u.unit_type);
  });
  if (!units.length) return [];

  // Ratings agregadas por operador -- reviews nao sao por unidade
  const { data: ratings } = await supabaseAdmin
    .from('reviews')
    .select('operator_id, rating')
    .in('operator_id', ids)
    .eq('is_public', true)
    .not('rating', 'is', null);

  const ratingMap = {};
  (ratings || []).forEach((r) => {
    if (!ratingMap[r.operator_id]) ratingMap[r.operator_id] = [];
    ratingMap[r.operator_id].push(r.rating);
  });

  // Reservas recentes (ultimos 30 dias) por UNIDADE -- sinal de popularidade
  // mais preciso que por operador, ja que reservations tem unit_id.
  const unitIds = units.map((u) => u.id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentRes } = await supabaseAdmin
    .from('reservations')
    .select('unit_id')
    .in('unit_id', unitIds)
    .gte('created_at', thirtyDaysAgo)
    .in('status', ['confirmed', 'checked_in', 'checked_out']);

  const bookingMap = {};
  (recentRes || []).forEach((r) => {
    bookingMap[r.unit_id] = (bookingMap[r.unit_id] || 0) + 1;
  });

  /* Pratos/menus de degustacao nunca tem reservas contra o proprio unit_id
     (reservas de restaurante sao sempre contra uma MESA) -- reaproveitar
     cegamente o next_available por unidade daria sempre "hoje", o que e
     enganoso. Para estes, next_available reflecte a disponibilidade das
     mesas do proprio operador: um dia conta como livre para o prato se
     pelo menos uma mesa desse operador estiver livre nesse dia. */
  const restaurantOperatorIds = [...new Set(
    units.filter((u) => operatorMap[u.operator_id].operator_type === 'restaurant').map((u) => u.operator_id)
  )];
  let tableIdsByOperator = {};
  let tableIds = [];
  if (restaurantOperatorIds.length) {
    const { data: tables } = await supabaseAdmin
      .from('units')
      .select('id, operator_id, unit_type')
      .in('operator_id', restaurantOperatorIds)
      .eq('status', 'active')
      .not('unit_type', 'in', '(menu_item,tasting_menu)');
    (tables || []).forEach((t) => {
      if (!tableIdsByOperator[t.operator_id]) tableIdsByOperator[t.operator_id] = [];
      tableIdsByOperator[t.operator_id].push(t.id);
    });
    tableIds = (tables || []).map((t) => t.id);
  }

  // Proximo dia livre nos proximos 14 dias, em lote para todas as unidades --
  // mesma regra binaria de verificarDisponibilidade() (bookingHelpers.js): uma
  // reserva pending/confirmed/checked_in sobreposta OU um blocked_dates nesse
  // dia bloqueia. Nao considera units.capacity (nada no codigo considera).
  // Inclui tambem as mesas dos operadores de restaurante (tableIds) -- so
  // usadas para calcular next_available dos pratos desse operador, nunca
  // devolvidas como itens do catalogo.
  const fmtDate = (d) => d.toISOString().split('T')[0];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const AVAIL_WINDOW_DAYS = 14;
  const windowEnd = new Date(today.getTime() + AVAIL_WINDOW_DAYS * 86400000);
  const windowStartStr = fmtDate(today);
  const windowEndStr = fmtDate(windowEnd);
  const allUnitIds = [...new Set([...unitIds, ...tableIds])];

  const { data: upcomingRes } = await supabaseAdmin
    .from('reservations')
    .select('unit_id, check_in, check_out')
    .in('unit_id', allUnitIds)
    .in('status', ['pending', 'confirmed', 'checked_in'])
    .lt('check_in', windowEndStr)
    .gt('check_out', windowStartStr);

  const { data: blockedRows } = await supabaseAdmin
    .from('blocked_dates')
    .select('unit_id, date')
    .in('unit_id', allUnitIds)
    .gte('date', windowStartStr)
    .lte('date', windowEndStr);

  const blockedByUnit = {};
  const markBlocked = (unitId, dateStr) => {
    if (!blockedByUnit[unitId]) blockedByUnit[unitId] = new Set();
    blockedByUnit[unitId].add(dateStr);
  };
  (upcomingRes || []).forEach((r) => {
    let d = new Date(r.check_in) > today ? new Date(r.check_in) : today;
    const end = new Date(r.check_out) < windowEnd ? new Date(r.check_out) : windowEnd;
    while (d < end) {
      markBlocked(r.unit_id, fmtDate(d));
      d = new Date(d.getTime() + 86400000);
    }
  });
  (blockedRows || []).forEach((b) => markBlocked(b.unit_id, b.date));

  function nextAvailable(unitId) {
    const blocked = blockedByUnit[unitId];
    for (let i = 0; i < AVAIL_WINDOW_DAYS; i++) {
      const ds = fmtDate(new Date(today.getTime() + i * 86400000));
      if (!blocked || !blocked.has(ds)) return ds;
    }
    return null;
  }

  // Um dia conta como disponivel para um prato se PELO MENOS UMA mesa do
  // operador estiver livre nesse dia (OR entre mesas, nao AND).
  function nextAvailableForOperator(operatorId) {
    const tables = tableIdsByOperator[operatorId];
    if (!tables?.length) return null;
    for (let i = 0; i < AVAIL_WINDOW_DAYS; i++) {
      const ds = fmtDate(new Date(today.getTime() + i * 86400000));
      if (tables.some((tId) => !blockedByUnit[tId]?.has(ds))) return ds;
    }
    return null;
  }

  const enriched = units.map((u) => {
    const op = operatorMap[u.operator_id];
    const opRatings = ratingMap[u.operator_id] || [];
    return {
      unit_id:         u.id,
      operator_id:     op.id,
      operator_slug:   op.slug,
      operator_name:   op.name,
      operator_type:   op.operator_type,
      address:         op.address,
      currency:        op.currency,
      island_id:       op.island_id,
      island_name:     op.islands?.name || null,
      island_slug:     op.islands?.slug || null,
      unit_name:       u.name,
      description:     u.description,
      base_price:      u.base_price,
      images:          u.images,
      category_id:       u.category_id,
      category_label_pt: u.experience_categories?.label_pt || null,
      category_label_en: u.experience_categories?.label_en || null,
      duration_minutes:  u.duration_minutes,
      languages_offered: u.languages_offered || [],
      lat:                u.lat,
      lng:                u.lng,
      avg_rating:      opRatings.length
        ? parseFloat((opRatings.reduce((s, r) => s + r, 0) / opRatings.length).toFixed(1))
        : null,
      review_count:    opRatings.length || 0,
      recent_bookings: bookingMap[u.id] || 0,
      next_available:  op.operator_type === 'restaurant' ? nextAvailableForOperator(op.id) : nextAvailable(u.id),
      created_at:      u.created_at,
    };
  });

  enriched.sort((a, b) => b.recent_bookings - a.recent_bookings || new Date(b.created_at) - new Date(a.created_at));

  return enriched;
}

module.exports = { getDiscoverCatalog };
