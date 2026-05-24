const { supabaseAdmin } = require('../config/supabase');
const { verificarDisponibilidade, calcularPreco } = require('../helpers/bookingHelpers');
const { obterOuCriarCliente } = require('../helpers/customerHelper');
const { enviarEmail } = require('../helpers/emailHelper');
const { detectarIdioma } = require('../helpers/languageHelper');

async function getOperador(req, res, next) {
  try {
    const { data: operator, error } = await supabaseAdmin
      .from('operators')
      .select('id, name, slug, operator_type, email, phone, address, logo_url')
      .eq('slug', req.params.slug)
      .eq('onboarding_complete', true)
      .single();

    if (error || !operator) {
      return res.status(404).json({ error: 'Página não encontrada', code: 'NOT_FOUND' });
    }

    const { data: units } = await supabaseAdmin
      .from('units')
      .select('id, name, description, unit_type, base_price, capacity, images, pricing_rules(*)')
      .eq('operator_id', operator.id)
      .eq('status', 'active')
      .order('name');

    return res.json({
      data: { operator, units: units || [] },
      message: 'Operador encontrado'
    });
  } catch (err) {
    next(err);
  }
}

async function verificarDisponibilidadePublica(req, res, next) {
  try {
    const { unitId, checkIn, checkOut } = req.query;

    if (!unitId || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'unitId, checkIn e checkOut são obrigatórios', code: 'MISSING_FIELDS' });
    }
    if (checkOut <= checkIn) {
      return res.status(400).json({ error: 'Checkout deve ser posterior ao check-in', code: 'INVALID_DATES' });
    }

    const { data: unit } = await supabaseAdmin
      .from('units')
      .select('*, pricing_rules(*)')
      .eq('id', unitId)
      .eq('status', 'active')
      .single();

    if (!unit) {
      return res.status(404).json({ error: 'Unidade não encontrada', code: 'NOT_FOUND' });
    }

    const disponivel = await verificarDisponibilidade(supabaseAdmin, unitId, checkIn, checkOut);
    const { total, dias } = calcularPreco(unit, checkIn, checkOut);

    return res.json({
      data: { disponivel, total_price: total, dias },
      message: disponivel ? 'Disponível' : 'Indisponível'
    });
  } catch (err) {
    next(err);
  }
}

async function criarReserva(req, res, next) {
  try {
    const { unit_id, customer_name, customer_email, customer_phone,
            customer_country, check_in, check_out, guests, notes } = req.body;

    if (!unit_id || !customer_name || !customer_email || !check_in || !check_out) {
      return res.status(400).json({ error: 'Campos obrigatórios em falta', code: 'MISSING_FIELDS' });
    }
    if (check_out <= check_in) {
      return res.status(400).json({ error: 'Checkout deve ser posterior ao check-in', code: 'INVALID_DATES' });
    }

    const { data: operator } = await supabaseAdmin
      .from('operators')
      .select('id')
      .eq('slug', req.params.slug)
      .eq('onboarding_complete', true)
      .single();

    if (!operator) {
      return res.status(404).json({ error: 'Operador não encontrado', code: 'NOT_FOUND' });
    }

    const { data: unit } = await supabaseAdmin
      .from('units')
      .select('*, pricing_rules(*)')
      .eq('id', unit_id)
      .eq('operator_id', operator.id)
      .eq('status', 'active')
      .single();

    if (!unit) {
      return res.status(404).json({ error: 'Unidade não encontrada', code: 'NOT_FOUND' });
    }

    const disponivel = await verificarDisponibilidade(supabaseAdmin, unit_id, check_in, check_out);
    if (!disponivel) {
      return res.status(409).json({ error: 'Unidade indisponível nas datas seleccionadas', code: 'UNAVAILABLE' });
    }

    const { total } = calcularPreco(unit, check_in, check_out);

    const customer = await obterOuCriarCliente(operator.id, {
      name: customer_name,
      email: customer_email,
      phone: customer_phone,
      country_code: customer_country
    });

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .insert({
        operator_id: operator.id,
        unit_id,
        customer_id: customer.id,
        customer_name,
        customer_email,
        customer_phone: customer_phone || null,
        customer_country: customer_country || null,
        check_in,
        check_out,
        guests: guests || 1,
        total_price: total,
        status: 'pending',
        source: 'public',
        notes: notes || null
      })
      .select()
      .single();

    if (error) throw error;

    const idioma = detectarIdioma(customer_country);
    enviarEmail({
      to: customer_email,
      subject: idioma === 'en' ? 'Reservation request received' : 'Pedido de reserva recebido',
      text: idioma === 'en'
        ? `Hello ${customer_name},\n\nWe received your reservation request for ${unit.name} (${check_in} → ${check_out}).\n\nWe will confirm your booking shortly.\n\nThank you!`
        : `Olá ${customer_name},\n\nRecebemos o seu pedido de reserva para ${unit.name} (${check_in} → ${check_out}).\n\nIremos confirmar a sua reserva em breve.\n\nObrigado!`
    }).catch((err) => console.error('[Email] Erro ao enviar recepção:', err.message));

    return res.status(201).json({
      data,
      message: 'Reserva submetida com sucesso. Aguarde confirmação.'
    });
  } catch (err) {
    next(err);
  }
}

/* ─── Discover — listagem pública de operadores ─── */
async function discover(req, res, next) {
  try {
    const { type, search, featured, limit } = req.query;

    let q = supabaseAdmin
      .from('operators')
      .select('id, name, slug, operator_type, description, address, phone, logo_url, currency, created_at')
      .eq('onboarding_complete', true)
      .order('name');

    if (type && ['hotel', 'activity', 'rentacar', 'restaurant'].includes(type)) {
      q = q.eq('operator_type', type);
    }
    if (search) {
      q = q.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (featured === 'true') {
      const { data: featuredLinks } = await supabaseAdmin
        .from('cms_featured')
        .select('operator_id')
        .eq('is_active', true)
        .order('position');
      if (featuredLinks?.length > 0) {
        q = q.in('id', featuredLinks.map((f) => f.operator_id));
      }
    }
    if (limit) {
      q = q.limit(Math.min(parseInt(limit) || 9, 50));
    }

    const { data: operators, error } = await q;
    if (error) throw error;
    if (!operators?.length) return res.json({ data: [] });

    const ids = operators.map((o) => o.id);

    // Ratings agregadas
    const { data: ratings } = await supabaseAdmin
      .from('reviews')
      .select('operator_id, rating')
      .in('operator_id', ids)
      .eq('is_public', true);

    const ratingMap = {};
    (ratings || []).forEach((r) => {
      if (!ratingMap[r.operator_id]) ratingMap[r.operator_id] = [];
      ratingMap[r.operator_id].push(r.rating);
    });

    // Preco base minimo por operador
    const { data: prices } = await supabaseAdmin
      .from('units')
      .select('operator_id, base_price')
      .in('operator_id', ids)
      .eq('status', 'active')
      .not('base_price', 'is', null);

    const priceMap = {};
    (prices || []).forEach((p) => {
      if (p.base_price && (!priceMap[p.operator_id] || p.base_price < priceMap[p.operator_id])) {
        priceMap[p.operator_id] = p.base_price;
      }
    });

    // Reservas recentes (últimos 30 dias) por operador
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentRes } = await supabaseAdmin
      .from('reservations')
      .select('operator_id')
      .in('operator_id', ids)
      .gte('created_at', thirtyDaysAgo)
      .in('status', ['confirmed', 'checked_in', 'checked_out']);

    const bookingMap = {};
    (recentRes || []).forEach((r) => {
      bookingMap[r.operator_id] = (bookingMap[r.operator_id] || 0) + 1;
    });

    const enriched = operators.map((op) => {
      const opRatings = ratingMap[op.id] || [];
      return {
        ...op,
        avg_rating: opRatings.length
          ? parseFloat((opRatings.reduce((s, r) => s + r, 0) / opRatings.length).toFixed(1))
          : null,
        review_count: opRatings.length || 0,
        base_price: priceMap[op.id] || null,
        recent_bookings: bookingMap[op.id] || 0,
      };
    });

    return res.json({ data: enriched, message: 'Operadores listados' });
  } catch (err) {
    next(err);
  }
}

/* ─── CMS público — experiências ─── */
async function cmsExperiences(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('cms_experiences')
      .select('id, title_pt, title_en, description_pt, description_en, includes_pt, includes_en, price_from, duration_days, theme')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return res.json({ data: data || [] });
  } catch (err) {
    next(err);
  }
}

/* ─── CMS público — eventos ─── */
async function cmsEvents(req, res, next) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabaseAdmin
      .from('cms_events')
      .select('id, name_pt, name_en, description_pt, description_en, event_date, event_type')
      .eq('is_active', true)
      .gte('event_date', today)
      .order('event_date')
      .limit(12);
    if (error) throw error;
    return res.json({ data: data || [] });
  } catch (err) {
    next(err);
  }
}

/* ─── CMS público — banners ─── */
async function cmsBanners(req, res, next) {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('cms_banners')
      .select('id, title, image_url, link_url, position')
      .eq('is_active', true)
      .lte('starts_at', now)
      .gte('ends_at', now)
      .order('position');
    if (error) throw error;
    return res.json({ data: data || [] });
  } catch (err) {
    next(err);
  }
}

/* ─── Avaliações públicas recentes ─── */
async function publicReviews(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 6, 20);

    const { data: reviews, error } = await supabaseAdmin
      .from('reviews')
      .select('id, rating, comment, created_at, operator_id, customer_id')
      .eq('is_public', true)
      .not('comment', 'is', null)
      .neq('comment', '')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    if (!reviews?.length) return res.json({ data: [] });

    const opIds = [...new Set(reviews.map((r) => r.operator_id))];
    const custIds = [...new Set(reviews.map((r) => r.customer_id).filter(Boolean))];

    const [{ data: operators }, { data: customers }] = await Promise.all([
      supabaseAdmin
        .from('operators')
        .select('id, name, operator_type, slug')
        .in('id', opIds),
      custIds.length
        ? supabaseAdmin
            .from('customers')
            .select('id, first_name, nationality')
            .in('id', custIds)
        : Promise.resolve({ data: [] }),
    ]);

    const opMap  = Object.fromEntries((operators  || []).map((o) => [o.id, o]));
    const custMap = Object.fromEntries((customers || []).map((c) => [c.id, c]));

    const enriched = reviews.map((r) => ({
      id:          r.id,
      rating:      r.rating,
      comment:     r.comment,
      created_at:  r.created_at,
      operator:    opMap[r.operator_id] || null,
      author_name: custMap[r.customer_id]?.first_name || 'Visitante',
      nationality: custMap[r.customer_id]?.nationality || null,
    }));

    return res.json({ data: enriched });
  } catch (err) {
    next(err);
  }
}

/* ─── Formulário de contacto / newsletter público ─── */
async function publicContact(req, res, next) {
  try {
    const { email, operator_type, language, source } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Email inválido', code: 'INVALID_EMAIL' });
    }

    await supabaseAdmin
      .from('leads')
      .upsert(
        {
          email:         email.trim().toLowerCase(),
          operator_type: operator_type || 'other',
          language:      language || 'pt',
          source:        source || 'website',
        },
        { onConflict: 'email', ignoreDuplicates: false }
      );

    return res.json({ message: 'Contacto recebido' });
  } catch (err) {
    next(err);
  }
}

/* ─── Avaliações públicas por operador (slug) ─── */
async function slugReviews(req, res, next) {
  try {
    const { data: operator, error: opErr } = await supabaseAdmin
      .from('operators')
      .select('id')
      .eq('slug', req.params.slug)
      .eq('onboarding_complete', true)
      .single();
    if (opErr || !operator) return res.status(404).json({ error: 'Operador não encontrado', code: 'NOT_FOUND' });

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('id, rating, comment, reply_text, replied_at, is_public, created_at, customer_id')
      .eq('operator_id', operator.id)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;

    const custIds = [...new Set((data || []).map(r => r.customer_id).filter(Boolean))];
    let custMap = {};
    if (custIds.length) {
      const { data: customers } = await supabaseAdmin
        .from('customers')
        .select('id, first_name, nationality')
        .in('id', custIds);
      (customers || []).forEach(c => { custMap[c.id] = c; });
    }

    const reviews = (data || []).map(r => ({
      id:          r.id,
      rating:      r.rating,
      comment:     r.comment,
      reply_text:  r.reply_text,
      replied_at:  r.replied_at,
      created_at:  r.created_at,
      author_name: custMap[r.customer_id]?.first_name || 'Cliente',
      nationality: custMap[r.customer_id]?.nationality || null,
    }));

    return res.json({ data: reviews });
  } catch (err) { next(err); }
}

/* ─── Contacto directo ao operador ─── */
async function slugContact(req, res, next) {
  try {
    const { name, email, phone, message } = req.body;
    if (!email || !message) {
      return res.status(400).json({ error: 'Email e mensagem são obrigatórios', code: 'MISSING_FIELDS' });
    }
    await supabaseAdmin
      .from('leads')
      .upsert({
        email:         email.trim().toLowerCase(),
        source:        'operator_page',
        language:      'pt',
        operator_type: 'other',
      }, { onConflict: 'email', ignoreDuplicates: false });

    return res.json({ message: 'Mensagem recebida com sucesso' });
  } catch (err) { next(err); }
}

/* ─── Unidade específica por slug + unitId ─── */
async function getUnit(req, res, next) {
  try {
    const { slug, unitId } = req.params;

    const { data: operator } = await supabaseAdmin
      .from('operators')
      .select('id, name, slug, operator_type, email, phone, whatsapp, address, logo_url, currency, description')
      .eq('slug', slug)
      .eq('onboarding_complete', true)
      .single();

    if (!operator) return res.status(404).json({ error: 'Operador não encontrado', code: 'NOT_FOUND' });

    const { data: unit, error: unitErr } = await supabaseAdmin
      .from('units')
      .select('*, pricing_rules(*)')
      .eq('id', unitId)
      .eq('operator_id', operator.id)
      .eq('is_active', true)
      .single();

    if (unitErr || !unit) return res.status(404).json({ error: 'Serviço não encontrado', code: 'NOT_FOUND' });

    const { data: related } = await supabaseAdmin
      .from('units')
      .select('id, name, description, unit_type, base_price, price_unit, capacity, images')
      .eq('operator_id', operator.id)
      .eq('is_active', true)
      .neq('id', unitId)
      .limit(3);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentBookings } = await supabaseAdmin
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('unit_id', unitId)
      .gte('created_at', thirtyDaysAgo)
      .in('status', ['confirmed', 'checked_in', 'checked_out']);

    return res.json({
      data: { operator, unit, related: related || [], recent_bookings: recentBookings || 0 },
      message: 'Serviço encontrado',
    });
  } catch (err) { next(err); }
}

/* ─── Avaliações de uma unidade específica ─── */
async function getUnitReviews(req, res, next) {
  try {
    const { slug, unitId } = req.params;

    const { data: operator } = await supabaseAdmin
      .from('operators')
      .select('id')
      .eq('slug', slug)
      .eq('onboarding_complete', true)
      .single();

    if (!operator) return res.status(404).json({ error: 'Operador não encontrado', code: 'NOT_FOUND' });

    const { data: reservationIds } = await supabaseAdmin
      .from('reservations')
      .select('id')
      .eq('unit_id', unitId)
      .eq('operator_id', operator.id);

    const resIds = (reservationIds || []).map(r => r.id);
    let reviews = [];

    if (resIds.length > 0) {
      const { data: unitReviews } = await supabaseAdmin
        .from('reviews')
        .select('id, rating, comment, reply_text, created_at, customer_id')
        .in('reservation_id', resIds)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(20);
      reviews = unitReviews || [];
    }

    if (reviews.length === 0) {
      const { data: opReviews } = await supabaseAdmin
        .from('reviews')
        .select('id, rating, comment, reply_text, created_at, customer_id')
        .eq('operator_id', operator.id)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(20);
      reviews = opReviews || [];
    }

    const custIds = [...new Set(reviews.map(r => r.customer_id).filter(Boolean))];
    let custMap = {};
    if (custIds.length) {
      const { data: customers } = await supabaseAdmin
        .from('customers')
        .select('id, first_name, nationality')
        .in('id', custIds);
      (customers || []).forEach(c => { custMap[c.id] = c; });
    }

    const enriched = reviews.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      reply_text: r.reply_text,
      created_at: r.created_at,
      author_name: custMap[r.customer_id]?.first_name || 'Cliente',
      nationality: custMap[r.customer_id]?.nationality || null,
    }));

    return res.json({ data: enriched });
  } catch (err) { next(err); }
}

/* ─── Submissão de candidatura de operador (website) ─── */
async function submitLead(req, res, next) {
  try {
    const {
      nome, email, telefone, whatsapp, funcao,
      nome_negocio, tipo_negocio, localizacao, anos_operacao, clientes_mes,
      tem_site, url_site, como_gere_reservas, desafios, num_funcionarios, otas, volume_mensal,
      plano_interesse, quando_comecar, como_soube, disponivel_demo, horario_contacto,
      comentarios, aceita_termos, aceita_comunicacoes,
    } = req.body;

    if (!nome || !email || !email.includes('@')) {
      return res.status(400).json({ error: 'Nome e email são obrigatórios', code: 'MISSING_FIELDS' });
    }
    if (!aceita_termos) {
      return res.status(400).json({ error: 'Deve aceitar os termos e condições', code: 'TERMS_REQUIRED' });
    }

    const { error } = await supabaseAdmin
      .from('leads')
      .insert({
        email:               email.trim().toLowerCase(),
        name:                nome,
        operator_type:       tipo_negocio || 'other',
        language:            'pt',
        source:              'operadores_form',
        telefone,
        whatsapp:            whatsapp || null,
        funcao:              funcao || null,
        nome_negocio:        nome_negocio || null,
        tipo_negocio:        tipo_negocio || null,
        localizacao:         localizacao || null,
        anos_operacao:       anos_operacao || null,
        clientes_mes:        clientes_mes || null,
        tem_site:            !!tem_site,
        url_site:            url_site || null,
        como_gere_reservas:  Array.isArray(como_gere_reservas) ? como_gere_reservas : [],
        desafios:            Array.isArray(desafios) ? desafios : [],
        num_funcionarios:    num_funcionarios || null,
        otas:                Array.isArray(otas) ? otas : [],
        volume_mensal:       volume_mensal || null,
        plano_interesse:     plano_interesse || null,
        quando_comecar:      quando_comecar || null,
        como_soube:          como_soube || null,
        disponivel_demo:     !!disponivel_demo,
        horario_contacto:    horario_contacto || null,
        comentarios:         comentarios || null,
        aceita_termos:       !!aceita_termos,
        aceita_comunicacoes: !!aceita_comunicacoes,
        status:              'novo',
      });

    if (error) throw error;

    const linha = (l, v) => v ? `<tr><td style="padding:4px 12px 4px 0;color:#6B7280;font-size:13px">${l}</td><td style="padding:4px 0;font-size:13px;font-weight:500">${Array.isArray(v) ? v.join(', ') : v}</td></tr>` : '';
    const html = `
<div style="font-family:sans-serif;max-width:600px">
  <h2 style="color:#0D5470">Nova candidatura — SalDesk</h2>
  <table>
    ${linha('Nome', nome)}
    ${linha('Email', email)}
    ${linha('Telefone', telefone)}
    ${linha('Função', funcao)}
    ${linha('Negócio', nome_negocio)}
    ${linha('Tipo', tipo_negocio)}
    ${linha('Localização', localizacao)}
    ${linha('Há quanto tempo', anos_operacao)}
    ${linha('Clientes/mês', clientes_mes)}
    ${linha('Site', url_site || (tem_site ? 'Sim' : 'Não'))}
    ${linha('Gere reservas via', Array.isArray(como_gere_reservas) ? como_gere_reservas : [])}
    ${linha('Desafios', Array.isArray(desafios) ? desafios : [])}
    ${linha('Funcionários', num_funcionarios)}
    ${linha('OTAs', Array.isArray(otas) ? otas : [])}
    ${linha('Volume mensal', volume_mensal)}
    ${linha('Plano de interesse', plano_interesse)}
    ${linha('Quando começar', quando_comecar)}
    ${linha('Como soube', como_soube)}
    ${linha('Demo disponível', disponivel_demo ? 'Sim' : 'Não')}
    ${linha('Horário preferido', horario_contacto)}
    ${linha('Comentários', comentarios)}
  </table>
</div>`;

    enviarEmail({
      to: process.env.CONTACT_EMAIL || 'contacto@saldesk.cv',
      subject: `[Candidatura] ${nome_negocio || nome} — ${tipo_negocio || 'Novo operador'}`,
      html,
      text: `Nova candidatura de ${nome} (${email}) — ${nome_negocio || ''} [${tipo_negocio || ''}]`,
    }).catch(err => console.error('[Email] Erro ao enviar notificação de lead:', err.message));

    return res.json({ message: 'Candidatura recebida com sucesso' });
  } catch (err) { next(err); }
}

module.exports = {
  getOperador,
  verificarDisponibilidadePublica,
  criarReserva,
  discover,
  cmsExperiences,
  cmsEvents,
  cmsBanners,
  publicReviews,
  publicContact,
  slugReviews,
  slugContact,
  getUnit,
  getUnitReviews,
  submitLead,
};
