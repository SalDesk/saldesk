const { supabaseAdmin } = require('../config/supabase');
const { verificarDisponibilidade, calcularPreco, verificarDisponibilidadeMesa, listarMesasDisponiveis, DEFAULT_SEATING_MINUTES, parseUnitMeta, verificarDisponibilidadeSlot, listarSlotsComDisponibilidade } = require('../helpers/bookingHelpers');
const { obterOuCriarCliente } = require('../helpers/customerHelper');
const { enviarEmail } = require('../helpers/emailHelper');
const { detectarIdioma } = require('../helpers/languageHelper');
const { confirmacaoClienteEmail, notificacaoOperadorEmail } = require('../helpers/emailTemplates');
const { validarVoucher, registarUsoVoucher } = require('./vouchersController');
const { encontrarAfiliadoActivo } = require('./affiliatesController');
const { dispararSyncImediato } = require('../helpers/otaSyncHelper');
const { getDiscoverCatalog } = require('../services/discoverCatalogService');
const { notifyOperator } = require('../services/pushService');
const { emitToOperator } = require('../services/socketService');

async function getOperador(req, res, next) {
  try {
    const { data: operator, error } = await supabaseAdmin
      .from('operators')
      .select('id, name, slug, operator_type, email, phone, whatsapp, address, logo_url, cover_images, business_name, tagline, description, onboarding_complete, currency, page_config, island_id, islands(name, slug, airport_code)')
      .eq('slug', req.params.slug)
      .eq('onboarding_complete', true)
      .single();

    if (error || !operator) {
      return res.status(404).json({ error: 'Página não encontrada', code: 'NOT_FOUND' });
    }

    // custom_faqs é uma feature incompleta — coluna pode não existir ainda
    const { data: faqRow } = await supabaseAdmin
      .from('operators')
      .select('custom_faqs')
      .eq('id', operator.id)
      .single();
    if (faqRow?.custom_faqs) operator.custom_faqs = faqRow.custom_faqs;

    const { data: units } = await supabaseAdmin
      .from('units')
      .select('id, name, description, unit_type, base_price, capacity, images, created_at, pricing_rules(*)')
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

/* Alimenta "Visitas ao perfil"/"Cliques no link" na tab Estatisticas do
   Marketing (frontend/src/pages/Marketing.jsx) -- nao existia nenhuma
   instrumentacao de visitas em lado nenhum do codigo, a tab ficava sempre
   a 0 em silencio. ref distingue trafego do QR code / widget embebivel
   (ambos ja construidos) do trafego organico (sem ref). Nunca bloqueia nem
   falha visivelmente ao cliente -- e so telemetria. */
async function trackView(req, res) {
  try {
    const ref = typeof req.body?.ref === 'string' ? req.body.ref.slice(0, 20) : null;
    const { data: operator } = await supabaseAdmin
      .from('operators').select('id').eq('slug', req.params.slug).maybeSingle();
    if (operator) {
      supabaseAdmin.from('page_views').insert({ operator_id: operator.id, ref }).then(() => {});
    }
  } catch { /* telemetria -- nunca falha visivelmente */ }
  return res.status(204).end();
}

async function verificarDisponibilidadePublica(req, res, next) {
  try {
    const { unitId, checkIn, checkOut, date } = req.query;

    // Suporta data única (activities/restaurants) ou intervalo (hotel-style)
    const effectiveCheckIn  = checkIn  || date;
    const effectiveCheckOut = checkOut || date;

    if (!unitId || !effectiveCheckIn) {
      return res.status(400).json({ error: 'unitId e data são obrigatórios', code: 'MISSING_FIELDS' });
    }
    if (effectiveCheckOut && effectiveCheckOut < effectiveCheckIn) {
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

    const co = effectiveCheckOut || effectiveCheckIn;
    const disponivel = await verificarDisponibilidade(supabaseAdmin, unitId, effectiveCheckIn, co);

    /* Mesma convencao das restantes correcoes ao motor de precos: calcularPreco
       e por noite/dia (hotel, rent-a-car), reservas de um so dia (tours/
       actividades) ficariam sempre a 0. Isto e so uma pre-visualizacao sem
       numero de pessoas ainda escolhido (nenhum caller envia guests aqui),
       por isso mostra o preco base de 1 unidade -- consistente com o "A
       partir de €X" ja usado no resto do catalogo publico. */
    const { total, dias } = effectiveCheckIn === co
      ? { total: Math.round(Number(unit.base_price || 0) * 100) / 100, dias: 1 }
      : calcularPreco(unit, effectiveCheckIn, co);

    return res.json({
      data: { disponivel, total_price: total, dias: dias || 1 },
      message: disponivel ? 'Disponível' : 'Indisponível'
    });
  } catch (err) {
    next(err);
  }
}

/* ─── Disponibilidade por slot de hora (actividades/tours com horarios
   configurados, TourForm's TimeSlotsEditor) — devolve lugares restantes em
   cada slot, nunca so um booleano, para o selector desactivar slots ja
   esgotados sem inventar disponibilidade. Unidades sem time_slots definido
   continuam com o fluxo antigo (verificarDisponibilidadePublica). ─── */
async function getSlotAvailability(req, res, next) {
  try {
    const { unitId } = req.params;
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Data é obrigatória', code: 'MISSING_FIELDS' });
    }

    const { data: unit } = await supabaseAdmin
      .from('units')
      .select('id, description')
      .eq('id', unitId)
      .eq('status', 'active')
      .maybeSingle();
    if (!unit) {
      return res.status(404).json({ error: 'Unidade não encontrada', code: 'NOT_FOUND' });
    }

    const meta = parseUnitMeta(unit);
    const slots = Array.isArray(meta.time_slots) ? meta.time_slots : [];
    if (!slots.length) return res.json({ data: [] });

    const disponiveis = await listarSlotsComDisponibilidade(supabaseAdmin, unitId, date, slots);
    return res.json({ data: disponiveis });
  } catch (err) {
    next(err);
  }
}

/* ─── Disponibilidade de mesa (restaurante) — devolve a lista real de mesas
   livres (nome, zona, capacidade, fotos); o cliente escolhe a mesa exacta
   a partir daqui, validada de novo (contra corrida) em criarReserva ─── */
async function verificarDisponibilidadeRestaurantePublica(req, res, next) {
  try {
    const { date, time, party_size, zone } = req.query;
    if (!date || !time || !party_size) {
      return res.status(400).json({ error: 'Data, hora e número de pessoas são obrigatórios', code: 'MISSING_FIELDS' });
    }

    const { data: operator } = await supabaseAdmin
      .from('operators')
      .select('id, operator_type')
      .eq('slug', req.params.slug)
      .eq('onboarding_complete', true)
      .single();

    if (!operator) return res.status(404).json({ error: 'Operador não encontrado', code: 'NOT_FOUND' });
    if (operator.operator_type !== 'restaurant') {
      return res.status(400).json({ error: 'Operador não é um restaurante', code: 'INVALID_OPERATOR_TYPE' });
    }

    const tables = await listarMesasDisponiveis(supabaseAdmin, operator.id, {
      date, startTime: time, partySize: Number(party_size), zone: zone || null,
    });

    return res.json({
      data: { tables, date, time, party_size: Number(party_size) },
      message: tables.length ? 'Disponível' : 'Indisponível',
    });
  } catch (err) {
    next(err);
  }
}

/* Valida e monta os itens de um pedido de restaurante -- nunca confia no preco
   enviado pelo cliente, vai sempre buscar base_price real dos pratos/menus a
   BD no momento do pedido. Partilhado por createOrder (QR, mesa ja ocupada)
   e criarReserva (pre-pedido ligado a uma reserva futura). */
async function validarItensPedido(operatorId, items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return { error: { status: 400, body: { error: 'Pedido vazio ou inválido', code: 'INVALID_ITEMS' } } };
  }
  const cleanItems = items.map(i => ({
    unit_id: i.unit_id,
    quantity: Number.isInteger(i.quantity) ? i.quantity : 0,
    notes: typeof i.notes === 'string' ? i.notes.slice(0, 200) : null,
  }));
  if (cleanItems.some(i => !i.unit_id || i.quantity < 1 || i.quantity > 20)) {
    return { error: { status: 400, body: { error: 'Item de pedido inválido', code: 'INVALID_ITEM' } } };
  }

  const dishIds = [...new Set(cleanItems.map(i => i.unit_id))];
  const { data: dishes } = await supabaseAdmin
    .from('units')
    .select('id, name, base_price, unit_type, status, operator_id')
    .eq('operator_id', operatorId)
    .in('id', dishIds);
  const dishMap = new Map((dishes || []).map(d => [d.id, d]));
  const algumInvalido = dishIds.some(id => {
    const d = dishMap.get(id);
    return !d || d.status !== 'active' || !['menu_item', 'tasting_menu'].includes(d.unit_type);
  });
  if (algumInvalido) {
    return { error: { status: 400, body: { error: 'Um dos itens não está disponível', code: 'INVALID_ITEM' } } };
  }

  const totalPrice = cleanItems.reduce((sum, i) => sum + Number(dishMap.get(i.unit_id).base_price) * i.quantity, 0);
  return { cleanItems, dishMap, totalPrice };
}

async function criarReserva(req, res, next) {
  try {
    const { unit_id, customer_name, customer_email, customer_phone,
            customer_country, check_in, check_out, guests, notes,
            party_size, tour_time, reservation_time, zone_preference,
            voucher_code, ref_code, items, driver_included, booking_mode } = req.body;

    // check_out é opcional — activities/restaurants podem enviar só check_in (data do serviço)
    const effectiveCheckOut = check_out || check_in;

    const { data: operator } = await supabaseAdmin
      .from('operators')
      .select('id, name, slug, email, phone, currency, language, operator_type')
      .eq('slug', req.params.slug)
      .eq('onboarding_complete', true)
      .single();

    if (!operator) {
      return res.status(404).json({ error: 'Operador não encontrado', code: 'NOT_FOUND' });
    }

    const isRestaurant = operator.operator_type === 'restaurant';
    const isRentacar   = operator.operator_type === 'rentacar';

    /* Restaurante: cliente escolhe a mesa exacta (unit_id obrigatorio, tal
       como os restantes tipos ja exigem) a partir da lista devolvida por
       verificarDisponibilidadeRestaurantePublica. Pode incluir um pre-pedido
       opcional (items), validado e ligado a reservation_id depois de a
       reserva ser criada. */
    if (isRestaurant) {
      if (!unit_id || !customer_name || !customer_email || !check_in || !reservation_time) {
        return res.status(400).json({ error: 'Campos obrigatórios em falta', code: 'MISSING_FIELDS' });
      }
    } else if (!unit_id || !customer_name || !customer_email || !check_in) {
      return res.status(400).json({ error: 'Campos obrigatórios em falta', code: 'MISSING_FIELDS' });
    }
    /* Hotel/rent-a-car tem noites reais -- check_out omitido nao pode
       colapsar silenciosamente para check_in (reserva de 1 noite/dia sem o
       cliente ter pedido isso). Activity/restaurant continuam a aceitar so
       check_in (reserva de um so dia, por desenho). */
    if (['hotel', 'rentacar'].includes(operator.operator_type) && !check_out) {
      return res.status(400).json({ error: 'Data de check-out é obrigatória', code: 'MISSING_FIELDS' });
    }
    if (effectiveCheckOut < check_in) {
      return res.status(400).json({ error: 'Checkout deve ser posterior ao check-in', code: 'INVALID_DATES' });
    }

    let unit;
    let preOrderValidado = null;
    let activitySlotTime = null;
    let isGroupBooking = false;
    if (isRestaurant) {
      const { data: mesaRow } = await supabaseAdmin
        .from('units')
        .select('*, pricing_rules(*)')
        .eq('id', unit_id)
        .eq('operator_id', operator.id)
        .eq('status', 'active')
        .single();
      if (!mesaRow || mesaRow.unit_type === 'menu_item' || mesaRow.unit_type === 'tasting_menu') {
        return res.status(404).json({ error: 'Mesa não encontrada', code: 'TABLE_NOT_FOUND' });
      }

      const partySize = Number(party_size || guests || 1);
      const meta = parseUnitMeta(mesaRow);
      const capMin = meta.capacity_min ?? 1;
      const capMax = meta.capacity_max ?? mesaRow.capacity ?? 1;
      if (partySize < capMin || partySize > capMax) {
        return res.status(400).json({ error: 'Número de pessoas não cabe nesta mesa', code: 'PARTY_SIZE_MISMATCH' });
      }

      // Corrida: a lista de mesas foi buscada momentos antes -- confirmar de novo.
      const disponivel = await verificarDisponibilidadeMesa(supabaseAdmin, unit_id, check_in, reservation_time, DEFAULT_SEATING_MINUTES);
      if (!disponivel) {
        return res.status(409).json({ error: 'Mesa indisponível nesse horário', code: 'UNAVAILABLE' });
      }
      unit = mesaRow;

      // Valida o pre-pedido opcional ANTES de inserir a reserva -- falha cedo,
      // nunca deixa uma reserva confirmada com um pre-pedido a meio-invalido.
      if (Array.isArray(items) && items.length > 0) {
        const validado = await validarItensPedido(operator.id, items);
        if (validado.error) return res.status(validado.error.status).json(validado.error.body);
        preOrderValidado = validado;
      }
    } else {
      const { data: unitRow } = await supabaseAdmin
        .from('units')
        .select('*, pricing_rules(*)')
        .eq('id', unit_id)
        .eq('operator_id', operator.id)
        .eq('status', 'active')
        .single();

      if (!unitRow) {
        return res.status(404).json({ error: 'Unidade não encontrada', code: 'NOT_FOUND' });
      }
      unit = unitRow;

      /* Slots de hora com capacidade propria (TourForm's TimeSlotsEditor) --
         opcional, so activa quando a unidade tem meta.time_slots definido.
         Substitui por completo o bloqueio binario de verificarDisponibilidade
         (que bloqueia o unit_id inteiro nesse dia perante QUALQUER reserva
         existente, ignorando capacidade) -- com slots, varias reservas
         partilham o mesmo dia/hora ate ao limite configurado desse slot. */
      const unitMeta = parseUnitMeta(unitRow);
      const activitySlots = Array.isArray(unitMeta.time_slots) ? unitMeta.time_slots : [];

      /* Reserva de grupo/privada -- preco fixo (unitMeta.price_private, ate
         agora recolhido no TourForm mas nunca ligado a nada real), ocupa o
         slot/dia INTEIRO em exclusivo. So permitido se a unidade tiver
         mesmo um preco privado configurado -- nunca inventar um preco. */
      if (booking_mode === 'private') {
        if (!unitMeta.price_private) {
          return res.status(400).json({ error: 'Esta actividade não tem reserva privada disponível', code: 'INVALID_BOOKING_MODE' });
        }
        isGroupBooking = true;
      }

      if (activitySlots.length > 0) {
        const slotEscolhido = activitySlots.find((s) => String(s.time).slice(0, 5) === String(tour_time || '').slice(0, 5));
        if (!slotEscolhido) {
          return res.status(400).json({ error: 'Horário inválido para esta actividade', code: 'INVALID_TIME_SLOT' });
        }
        activitySlotTime = slotEscolhido.time;
        const cabe = await verificarDisponibilidadeSlot(supabaseAdmin, unit_id, check_in, slotEscolhido.time, Number(party_size || guests || 1), Number(slotEscolhido.capacity) || 0, null, isGroupBooking);
        if (!cabe) {
          return res.status(409).json({ error: 'Sem vagas neste horário', code: 'UNAVAILABLE' });
        }
      } else {
        const disponivel = await verificarDisponibilidade(supabaseAdmin, unit_id, check_in, effectiveCheckOut);
        if (!disponivel) {
          return res.status(409).json({ error: 'Unidade indisponível nas datas seleccionadas', code: 'UNAVAILABLE' });
        }
      }
    }

    // calcularPreco e por noite/dia (hotel, rent-a-car) — reservas de um so dia
    // (tours/actividades, cobrados por pessoa) ficariam sempre a 0 nesse calculo,
    // por isso usam antes base_price * numero de pessoas. Mesas de restaurante
    // sao sempre criadas com base_price:0 (RestaurantTableForm) -- a propria
    // reserva de mesa nao tem preco fixo, so o pre-pedido (se existir) tem.
    const numPessoas = party_size || guests || 1;
    let dias = 0;
    let total;
    if (isRestaurant) {
      total = preOrderValidado?.totalPrice || 0;
    } else if (isGroupBooking) {
      // Preco fixo por grupo -- ja validado acima que unitMeta.price_private existe.
      total = Number(parseUnitMeta(unit).price_private);
    } else if (effectiveCheckOut === check_in) {
      total = Math.round(Number(unit.base_price || 0) * numPessoas * 100) / 100;
    } else {
      const calc = calcularPreco(unit, check_in, effectiveCheckOut);
      total = calc.total;
      dias = calc.dias;
    }

    /* Motorista incluido -- extra real de rent-a-car "Executivo" (ao
       contrario dos extras cosmeticos de CAR_EXTRAS, que so caem em notes).
       chauffeur_daily_rate vem da propria viatura (meta), nunca inventado;
       sem esse campo preenchido, driver_included e ignorado. */
    let chauffeurPrice = 0;
    if (isRentacar && driver_included && dias > 0) {
      const vehicleMeta = parseUnitMeta(unit);
      if (vehicleMeta.chauffeur_daily_rate) {
        chauffeurPrice = Math.round(Number(vehicleMeta.chauffeur_daily_rate) * dias * 100) / 100;
        total = Math.round((total + chauffeurPrice) * 100) / 100;
      }
    }

    let finalTotal = total;
    let voucherId = null;
    if (voucher_code) {
      const resultado = await validarVoucher(operator.id, voucher_code, unit.id, total);
      if (resultado.valid) {
        finalTotal = Math.max(0, total - resultado.discount);
        voucherId = resultado.voucherId;
      } else {
        return res.status(400).json({ error: resultado.error || 'Codigo invalido', code: 'INVALID_VOUCHER' });
      }
    }

    let affiliateId = null;
    if (ref_code) {
      const { data: affConfig } = await supabaseAdmin
        .from('affiliate_config').select('active, min_booking_value').eq('operator_id', operator.id).maybeSingle();
      if (affConfig?.active && finalTotal >= Number(affConfig.min_booking_value || 0)) {
        const afiliado = await encontrarAfiliadoActivo(operator.id, ref_code);
        if (afiliado) affiliateId = afiliado.id;
      }
    }

    const customer = await obterOuCriarCliente(operator.id, {
      name: customer_name,
      email: customer_email,
      phone: customer_phone,
      country_code: customer_country
    });

    // Compor notes: hora do tour/reserva e/ou ocasião especial junto com as notas do cliente
    const notesLines = [];
    if (tour_time) notesLines.push(`Hora: ${tour_time}`);
    if (isRestaurant && reservation_time) notesLines.push(`Hora: ${reservation_time}`);
    if (isRestaurant && zone_preference) notesLines.push(`Zona preferida: ${zone_preference}`);
    if (party_size) notesLines.push(`Pessoas: ${party_size}`);
    if (notes) notesLines.push(notes);
    const finalNotes = notesLines.join(' | ') || null;

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .insert({
        operator_id: operator.id,
        unit_id: unit.id,
        customer_id: customer.id,
        customer_name,
        customer_email,
        customer_phone: customer_phone || null,
        customer_country: customer_country || null,
        check_in,
        check_out: effectiveCheckOut,
        guests: party_size || guests || 1,
        total_price: finalTotal,
        status: 'pending',
        source: 'public',
        notes: finalNotes,
        affiliate_id: affiliateId,
        start_time: isRestaurant ? reservation_time : activitySlotTime,
        /* duration_minutes fica sempre null para actividades, mesmo com
           slot escolhido -- reservations_no_overlap_time (048) so se aplica
           quando AMBOS start_time e duration_minutes estao preenchidos, e
           essa constraint é exclusiva (uma so reserva por intervalo), o que
           está certo para uma mesa mas errado para um slot de tour com
           capacidade partilhada. A verificacao de capacidade do slot ja foi
           feita acima (verificarDisponibilidadeSlot); nao ha protecao extra
           ao nivel da BD para actividades, mesmo perfil de risco de corrida
           que ja existia antes disto (verificarDisponibilidade tambem nunca
           teve rede de seguranca na BD). */
        duration_minutes: isRestaurant ? DEFAULT_SEATING_MINUTES : null,
        driver_included: isRentacar ? !!driver_included && chauffeurPrice > 0 : false,
        chauffeur_price: chauffeurPrice,
        is_group_booking: isGroupBooking,
      })
      .select()
      .single();

    if (error) {
      /* reservations_no_overlap (040) e reservations_no_overlap_time (048) --
         ganham a corrida a uma segunda reserva concorrente para a mesma
         unidade/datas/horario, mesmo que ambas tenham passado pela
         verificacao de disponibilidade acima. */
      if (error.code === '23P01') {
        return res.status(409).json({ error: isRestaurant ? 'Sem mesas disponíveis para esta data/hora' : 'Unidade indisponível nas datas seleccionadas', code: 'UNAVAILABLE' });
      }
      throw error;
    }

    if (voucherId) {
      registarUsoVoucher(voucherId).catch(err => console.error('[Voucher] Erro ao registar uso:', err.message));
    }

    /* Pre-pedido ligado a esta reserva -- ja validado (precos/quantidades)
       antes do insert acima. Se falhar aqui (raro, ex. corrida rara), a
       reserva mantem-se confirmada; a resposta sinaliza o pre-pedido
       falhado em vez de fingir sucesso ou perder o pedido silenciosamente. */
    let preOrder = null;
    if (isRestaurant && preOrderValidado) {
      const { cleanItems, dishMap, totalPrice } = preOrderValidado;
      try {
        const { data: order, error: orderErr } = await supabaseAdmin
          .from('orders')
          .insert({
            operator_id: operator.id,
            unit_id: unit.id,
            reservation_id: data.id,
            source: 'reservation',
            total_price: totalPrice,
          })
          .select('*')
          .single();
        if (orderErr) throw orderErr;

        const { error: itemsErr } = await supabaseAdmin
          .from('order_items')
          .insert(cleanItems.map(i => {
            const d = dishMap.get(i.unit_id);
            return { order_id: order.id, unit_id: d.id, unit_name: d.name, unit_price: d.base_price, quantity: i.quantity, notes: i.notes };
          }));
        if (itemsErr) throw itemsErr;

        preOrder = { created: true, order_id: order.id };
      } catch (preOrderErr) {
        console.error('[Reserva] Reserva confirmada mas pré-pedido falhou:', preOrderErr.message);
        preOrder = { created: false };
      }
    }

    supabaseAdmin.from('notifications').insert({
      operator_id:       operator.id,
      notification_type: 'new_booking',
      content:            data.driver_included
        ? `Nova reserva EXECUTIVO com motorista de ${customer_name} — ${unit.name} (atribuir condutor)`
        : `Nova reserva de ${customer_name} — ${unit.name}`,
      link:               `/reservas/${data.id}`,
    }).then(({ error: notifErr }) => {
      if (notifErr) console.error('[Notificacao] Erro ao criar notificacao:', notifErr.message);
    });

    dispararSyncImediato(operator.id);

    const idioma = detectarIdioma(customer_country);
    const currency = operator.currency || 'EUR';

    /* O cliente agora escolhe a mesa exacta explicitamente (deixou de ser um
       detalhe interno escondido) -- o email de confirmacao mostra o nome real
       da mesa/unidade, tal como ja acontecia para os restantes tipos. */
    const clienteEmail = confirmacaoClienteEmail({
      idioma,
      customerName: customer_name,
      tourName: unit.name,
      checkIn: check_in,
      checkOut: effectiveCheckOut,
      guests: party_size || guests || 1,
      total: finalTotal,
      currency,
      operator,
      status: data.status,
    });
    enviarEmail({
      to: customer_email,
      subject: clienteEmail.subject,
      html: clienteEmail.html,
      text: clienteEmail.text
    }).catch((err) => console.error('[Email] Erro ao enviar recepção:', err.message));

    if (operator.email) {
      const operadorEmail = notificacaoOperadorEmail({
        operatorName: operator.name,
        tourName: unit.name,
        checkIn: check_in,
        checkOut: effectiveCheckOut,
        guests: party_size || guests || 1,
        total,
        currency,
        customer: {
          name: customer_name,
          email: customer_email,
          phone: customer_phone,
          country: customer_country
        },
        notes: finalNotes
      });
      enviarEmail({
        to: operator.email,
        subject: operadorEmail.subject,
        html: operadorEmail.html,
        text: operadorEmail.text
      }).catch((err) => console.error('[Email] Erro ao enviar notificação ao operador:', err.message));
    }

    return res.status(201).json({
      data,
      pre_order: preOrder,
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
      .select('id, name, slug, operator_type, description, address, phone, logo_url, cover_images, business_name, tagline, currency, created_at')
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
    /* limit aplicado no fim, depois do filtro de "tem servicos reservaveis"
       -- aplicado aqui na query directamente cortava a lista ANTES desse
       filtro (por ordem alfabetica), podendo devolver menos operadores
       (ou nenhum) do que os que realmente sao reservaveis. */

    const { data: operators, error } = await q;
    if (error) throw error;
    if (!operators?.length) return res.json({ data: [] });

    const ids = operators.map((o) => o.id);

    // Ratings agregadas
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

    // Unidades activas por operador -- tambem usado para excluir do directorio
    // publico operadores sem nenhum servico configurado (o botao "Reservar"
    // abriria vazio, sem nada para o visitante reservar).
    const { data: activeUnits } = await supabaseAdmin
      .from('units')
      .select('operator_id, base_price')
      .in('operator_id', ids)
      .eq('status', 'active');

    const opsWithServices = new Set((activeUnits || []).map((u) => u.operator_id));
    const bookableOperators = operators.filter((o) => opsWithServices.has(o.id));
    if (!bookableOperators.length) return res.json({ data: [] });

    const priceMap = {};
    (activeUnits || []).forEach((p) => {
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

    const enriched = bookableOperators.map((op) => {
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

    const limited = limit ? enriched.slice(0, Math.min(parseInt(limit) || 9, 50)) : enriched;
    return res.json({ data: limited, message: 'Operadores listados' });
  } catch (err) {
    next(err);
  }
}

/* ─── Discover — lista achatada de servicos/unidades (nao operadores) ───
   Formato pensado para consumo directo em JS vanilla no website/discover/
   (uma entrada por servico, dados do operador ja denormalizados). Logica
   real vive em discoverCatalogService.js (partilhada com
   getRecommendations em travelerController.js). */
async function discoverUnits(req, res, next) {
  try {
    const { type, limit } = req.query;
    let enriched = await getDiscoverCatalog({ type });

    if (limit) {
      enriched = enriched.slice(0, Math.min(parseInt(limit) || 9, 50));
    }

    return res.json({ data: enriched, message: 'Servicos listados' });
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
    // cms_events representa epocas/eventos recorrentes por mes (month_start/
    // month_end, 1-12), nao datas especificas — nao ha "event_date" na tabela.
    const { data, error } = await supabaseAdmin
      .from('cms_events')
      .select('id, name_pt, name_en, description_pt, description_en, month_start, month_end, event_type')
      .eq('is_active', true)
      .order('month_start')
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
      .not('rating', 'is', null)
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
            /* "nationality" nunca existiu em customers (so country_code) --
               o select falhava por inteiro, so `data` era lido (nunca
               `error`), por isso author_name caia sempre no fallback
               generico "Visitante" em vez do nome real do cliente. */
            .select('id, first_name, country_code')
            .in('id', custIds)
        : Promise.resolve({ data: [] }),
    ]);

    const opMap  = Object.fromEntries((operators  || []).map((o) => [o.id, o]));
    const custMap = Object.fromEntries((customers || []).map((c) => [c.id, c]));

    const enriched = reviews.map((r) => ({
      id:           r.id,
      rating:       r.rating,
      comment:      r.comment,
      created_at:   r.created_at,
      operator:     opMap[r.operator_id] || null,
      author_name:  custMap[r.customer_id]?.first_name || 'Visitante',
      country_code: custMap[r.customer_id]?.country_code || null,
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
        .select('id, first_name, country_code')
        .in('id', custIds);
      (customers || []).forEach(c => { custMap[c.id] = c; });
    }

    const reviews = (data || []).map(r => ({
      id:           r.id,
      rating:       r.rating,
      comment:      r.comment,
      reply_text:   r.reply_text,
      replied_at:   r.replied_at,
      created_at:   r.created_at,
      author_name:  custMap[r.customer_id]?.first_name || 'Cliente',
      country_code: custMap[r.customer_id]?.country_code || null,
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

    const { data: operator } = await supabaseAdmin
      .from('operators').select('name, email').eq('slug', req.params.slug).eq('onboarding_complete', true).maybeSingle();
    if (!operator) return res.status(404).json({ error: 'Operador não encontrado', code: 'NOT_FOUND' });

    await supabaseAdmin
      .from('leads')
      .upsert({
        email:         email.trim().toLowerCase(),
        source:        'operator_page',
        language:      'pt',
        operator_type: 'other',
      }, { onConflict: 'email', ignoreDuplicates: false });

    /* A propria mensagem (nome/telefone/conteudo) nunca chegava ao operador
       -- so ficava um registo generico de "lead" (so email), sem o
       conteudo real do que o visitante queria dizer. O operador nunca via
       nada. Envia agora um email real, mesmo helper ja usado para as
       notificacoes de reserva. */
    if (operator.email) {
      enviarEmail({
        to: operator.email,
        subject: `Nova mensagem de ${name || email} — via a sua página SalDesk`,
        text: `Nome: ${name || 'Não indicado'}\nEmail: ${email}\nTelefone: ${phone || 'Não indicado'}\n\nMensagem:\n${message}`,
      }).catch((err) => console.error('[Contacto] Erro ao enviar email ao operador:', err.message));
    }

    return res.json({ message: 'Mensagem recebida com sucesso' });
  } catch (err) { next(err); }
}

/* ─── Chat publico a serio (widget da pagina do operador) ───
   Ao contrario de slugContact (formulario de contacto de uma via, so gera
   um lead/email), isto e uma conversa real guardada em messages, com o
   mesmo mecanismo ja usado por staff/gestor -- entrega imediata via
   emitToOperator para quem ja estiver com o painel de Mensagens aberto,
   e visivel no historico completo mesmo sem essa entrega em directo
   (o widget publico faz polling do historico, nao tem socket autenticado). */
async function sendGuestChatMessage(req, res, next) {
  try {
    const { slug } = req.params;
    const { customer_id, name, email, phone, content } = req.body;
    const trimmedContent = String(content || '').trim();
    if (!trimmedContent) return res.status(400).json({ error: 'Mensagem obrigatoria', code: 'MISSING_FIELDS' });
    if (trimmedContent.length > 4000) return res.status(400).json({ error: 'Mensagem demasiado longa', code: 'TOO_LONG' });

    const { data: operator } = await supabaseAdmin
      .from('operators')
      .select('id, name, business_name, push_subscription')
      .eq('slug', slug)
      .eq('onboarding_complete', true)
      .maybeSingle();
    if (!operator) return res.status(404).json({ error: 'Operador não encontrado', code: 'NOT_FOUND' });

    let customer;
    if (customer_id) {
      const { data: existente } = await supabaseAdmin
        .from('customers').select('*').eq('id', customer_id).eq('operator_id', operator.id).maybeSingle();
      if (!existente) return res.status(404).json({ error: 'Conversa não encontrada', code: 'NOT_FOUND' });
      customer = existente;
    } else {
      if (!email || !String(email).trim()) {
        return res.status(400).json({ error: 'Email obrigatorio', code: 'MISSING_FIELDS' });
      }
      customer = await obterOuCriarCliente(operator.id, {
        name: (name || '').trim() || email.trim(),
        email: email.trim(),
        phone: phone || null,
      });
    }

    const { data: msg, error } = await supabaseAdmin
      .from('messages')
      .insert({
        operator_id:    operator.id,
        sender_id:      customer.id,
        sender_type:    'guest',
        recipient_id:   operator.id,
        recipient_type: 'manager',
        content:        trimmedContent,
        message_type:   'direct',
        channel:        'internal',
      })
      .select('id, sender_type, content, channel, delivery_status, created_at')
      .single();
    if (error) throw error;

    emitToOperator(operator.id, 'message:new', { ...msg, sender_id: customer.id, recipient_id: operator.id, recipient_type: 'manager', operator_id: operator.id });

    /* Deduplicacao simples (mesmo padrao de callWaiter) -- evita uma
       notificacao/push por cada mensagem numa rajada da mesma conversa. */
    const { data: recent } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('operator_id', operator.id)
      .eq('notification_type', 'new_message')
      .eq('link', '/mensagens')
      .gte('created_at', new Date(Date.now() - 60_000).toISOString())
      .limit(1);
    if (!recent?.length) {
      await supabaseAdmin.from('notifications').insert({
        operator_id: operator.id,
        notification_type: 'new_message',
        content: `${customer.name} enviou uma mensagem pelo chat do site`,
        link: '/mensagens',
      });
      if (operator.push_subscription) {
        notifyOperator(operator, {
          title: 'Nova mensagem',
          body: `${customer.name}: ${trimmedContent.slice(0, 80)}`,
          tag: 'guest-chat',
          url: '/mensagens',
        }).catch(() => {});
      }
    }

    return res.status(201).json({ data: { message: msg, customer_id: customer.id }, message: 'Mensagem enviada' });
  } catch (err) { next(err); }
}

async function getGuestChatHistory(req, res, next) {
  try {
    const { slug } = req.params;
    const { customer_id } = req.query;
    if (!customer_id) return res.json({ data: [] });

    const { data: operator } = await supabaseAdmin
      .from('operators').select('id').eq('slug', slug).eq('onboarding_complete', true).maybeSingle();
    if (!operator) return res.status(404).json({ error: 'Operador não encontrado', code: 'NOT_FOUND' });

    const { data: customer } = await supabaseAdmin
      .from('customers').select('id').eq('id', customer_id).eq('operator_id', operator.id).maybeSingle();
    if (!customer) return res.json({ data: [] });

    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('id, sender_type, content, channel, delivery_status, created_at')
      .eq('operator_id', operator.id)
      .or(`sender_id.eq.${customer_id},recipient_id.eq.${customer_id}`)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw error;

    return res.json({ data: data || [] });
  } catch (err) { next(err); }
}

/* ─── Unidade específica por slug + unitId ─── */
async function getUnit(req, res, next) {
  try {
    const { slug, unitId } = req.params;

    const { data: operator } = await supabaseAdmin
      .from('operators')
      .select('id, name, slug, operator_type, email, phone, whatsapp, address, logo_url, cover_images, business_name, tagline, currency, description, page_config, island_id, islands(name, slug, airport_code)')
      .eq('slug', slug)
      .eq('onboarding_complete', true)
      .single();

    if (!operator) return res.status(404).json({ error: 'Operador não encontrado', code: 'NOT_FOUND' });

    const { data: unit, error: unitErr } = await supabaseAdmin
      .from('units')
      .select('*, pricing_rules(*)')
      .eq('id', unitId)
      .eq('operator_id', operator.id)
      .eq('status', 'active')
      .single();

    if (unitErr || !unit) return res.status(404).json({ error: 'Serviço não encontrado', code: 'NOT_FOUND' });

    /* Mesas de restaurante nunca sao individualmente consultaveis pela API
       publica -- sao inventario interno, so acessiveis via o fluxo de
       reserva em criarReserva (a lista de mesas disponiveis vem de
       verificarDisponibilidadeRestaurantePublica, nunca desta rota), nunca
       como "produto" navegavel/indexavel. Pratos/menus de degustacao SAO
       consultaveis -- ganham ficha propria em ServiceDetail.jsx, com o
       widget de reserva completo embutido (pre-pedido ligado a essa mesma
       pagina). */
    const isRestaurantOperator = operator.operator_type === 'restaurant';
    if (isRestaurantOperator && !['menu_item', 'tasting_menu'].includes(unit.unit_type)) {
      return res.status(404).json({ error: 'Serviço não encontrado', code: 'NOT_FOUND' });
    }

    let relatedQuery = supabaseAdmin
      .from('units')
      .select('id, name, description, unit_type, base_price, capacity, images')
      .eq('operator_id', operator.id)
      .eq('status', 'active')
      .neq('id', unitId)
      .limit(3);
    if (isRestaurantOperator) {
      // Nunca sugerir uma mesa como "servico semelhante" -- daria 404 ao clicar.
      relatedQuery = relatedQuery.in('unit_type', ['menu_item', 'tasting_menu']);
    }
    const { data: related } = await relatedQuery;

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

/* ─── Chamar empregado (cliente já sentado à mesa, sem autenticação) ─── */
async function callWaiter(req, res, next) {
  try {
    const { slug, unitId } = req.params;

    const { data: operator } = await supabaseAdmin
      .from('operators')
      .select('id, name, operator_type, onboarding_complete, push_subscription')
      .eq('slug', slug)
      .eq('onboarding_complete', true)
      .single();
    if (!operator) return res.status(404).json({ error: 'Operador não encontrado', code: 'NOT_FOUND' });
    if (operator.operator_type !== 'restaurant') {
      return res.status(400).json({ error: 'Operador não é um restaurante', code: 'INVALID_OPERATOR_TYPE' });
    }

    const { data: unit } = await supabaseAdmin
      .from('units')
      .select('id, name, unit_type, status, operator_id')
      .eq('id', unitId)
      .eq('operator_id', operator.id)
      .single();
    if (!unit || unit.status !== 'active' ||
        unit.unit_type === 'menu_item' || unit.unit_type === 'tasting_menu') {
      return res.status(404).json({ error: 'Mesa não encontrada', code: 'TABLE_NOT_FOUND' });
    }

    const link = `/unidades?mesa=${unit.id}`;

    /* Deduplicacao simples -- evita duplo-toque acidental a repetir a
       notificacao/push, sem precisar de tabela/coluna nova. */
    const { data: recent } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('operator_id', operator.id)
      .eq('notification_type', 'call_waiter')
      .eq('link', link)
      .gte('created_at', new Date(Date.now() - 90_000).toISOString())
      .limit(1);
    if (recent?.length) {
      return res.json({ data: { alreadyNotified: true }, message: 'Equipa já notificada' });
    }

    await supabaseAdmin.from('notifications').insert({
      operator_id: operator.id,
      notification_type: 'call_waiter',
      content: `${unit.name} pediu apoio`,
      link,
    });

    if (operator.push_subscription) {
      await notifyOperator(operator, {
        title: 'Mesa a chamar',
        body: `${unit.name} precisa de apoio`,
        tag: 'call-waiter',
        url: '/unidades',
      });
    }

    return res.status(201).json({ data: { alreadyNotified: false }, message: 'Equipa notificada' });
  } catch (err) { next(err); }
}

/* ─── Criar pedido (cliente sentado à mesa, sem autenticação) ─── */
async function createOrder(req, res, next) {
  try {
    const { slug, unitId } = req.params;
    const { items, notes } = req.body;

    const { data: operator } = await supabaseAdmin
      .from('operators')
      .select('id, name, operator_type, onboarding_complete, push_subscription')
      .eq('slug', slug)
      .eq('onboarding_complete', true)
      .single();
    if (!operator) return res.status(404).json({ error: 'Operador não encontrado', code: 'NOT_FOUND' });
    if (operator.operator_type !== 'restaurant') {
      return res.status(400).json({ error: 'Operador não é um restaurante', code: 'INVALID_OPERATOR_TYPE' });
    }

    const { data: table } = await supabaseAdmin
      .from('units')
      .select('id, name, unit_type, status, operator_id')
      .eq('id', unitId)
      .eq('operator_id', operator.id)
      .single();
    if (!table || table.status !== 'active' ||
        table.unit_type === 'menu_item' || table.unit_type === 'tasting_menu') {
      return res.status(404).json({ error: 'Mesa não encontrada', code: 'TABLE_NOT_FOUND' });
    }

    const validado = await validarItensPedido(operator.id, items);
    if (validado.error) return res.status(validado.error.status).json(validado.error.body);
    const { cleanItems, dishMap, totalPrice } = validado;

    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({
        operator_id: operator.id,
        unit_id: table.id,
        source: 'qr',
        notes: typeof notes === 'string' ? notes.slice(0, 500) : null,
        total_price: totalPrice,
      })
      .select('*')
      .single();
    if (orderErr) throw orderErr;

    const { data: orderItems, error: itemsErr } = await supabaseAdmin
      .from('order_items')
      .insert(cleanItems.map(i => {
        const d = dishMap.get(i.unit_id);
        return { order_id: order.id, unit_id: d.id, unit_name: d.name, unit_price: d.base_price, quantity: i.quantity, notes: i.notes };
      }))
      .select('*');
    if (itemsErr) throw itemsErr;

    await supabaseAdmin.from('notifications').insert({
      operator_id: operator.id,
      notification_type: 'new_order',
      content: `${table.name} fez um novo pedido (${cleanItems.length} ${cleanItems.length === 1 ? 'item' : 'itens'})`,
      link: '/pedidos',
    });

    if (operator.push_subscription) {
      await notifyOperator(operator, {
        title: 'Novo pedido',
        body: `${table.name} fez um novo pedido`,
        tag: 'new-order',
        url: '/pedidos',
      });
    }

    return res.status(201).json({ data: { order, items: orderItems }, message: 'Pedido enviado' });
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
        .select('id, rating, comment, reply_text, created_at, customer_id, helpful_count')
        .in('reservation_id', resIds)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(20);
      reviews = unitReviews || [];
    }

    if (reviews.length === 0) {
      const { data: opReviews } = await supabaseAdmin
        .from('reviews')
        .select('id, rating, comment, reply_text, created_at, customer_id, helpful_count')
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
        .select('id, first_name, country_code')
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
      country_code: custMap[r.customer_id]?.country_code || null,
      helpful_count: r.helpful_count || 0,
    }));

    return res.json({ data: enriched });
  } catch (err) { next(err); }
}

/* ─── Marcar avaliacao como util (visitante anonimo) ───
   Sem conta necessaria -- o frontend impede votos repetidos no mesmo
   browser via localStorage (mesmo padrao ja usado pela wishlist anonima
   do Conect). Aqui so confirmamos que a avaliacao pertence mesmo ao
   operador/unidade do slug antes de incrementar, nunca um id solto. */
async function marcarReviewUtil(req, res, next) {
  try {
    const { slug, unitId, reviewId } = req.params;

    const { data: operator } = await supabaseAdmin
      .from('operators')
      .select('id')
      .eq('slug', slug)
      .eq('onboarding_complete', true)
      .single();
    if (!operator) return res.status(404).json({ error: 'Operador não encontrado', code: 'NOT_FOUND' });

    const { data: review } = await supabaseAdmin
      .from('reviews')
      .select('id, helpful_count, reservation_id, operator_id')
      .eq('id', reviewId)
      .eq('operator_id', operator.id)
      .eq('is_public', true)
      .maybeSingle();
    if (!review) return res.status(404).json({ error: 'Avaliação não encontrada', code: 'NOT_FOUND' });

    const { data: updated, error } = await supabaseAdmin
      .from('reviews')
      .update({ helpful_count: (review.helpful_count || 0) + 1 })
      .eq('id', reviewId)
      .select('helpful_count')
      .single();
    if (error) throw error;

    return res.json({ data: { helpful_count: updated.helpful_count } });
  } catch (err) { next(err); }
}

/* ─── Estado do site publico (modo manutencao) ───
   O toggle "Modo manutencao" (Sistema -> Definicoes, chave coming_soon_mode)
   so gravava em cms_settings -- nada no site estatico alguma vez lia isto,
   por isso liga-lo nao mostrava pagina nenhuma aos visitantes. website/index.html
   consulta este endpoint (sem auth, tem de responder rapido e nunca bloquear
   o site se falhar). */
async function getSiteStatus(req, res, next) {
  try {
    const { data } = await supabaseAdmin
      .from('cms_settings')
      .select('key, value')
      .in('key', ['coming_soon_mode', 'maintenance_message', 'invite_only']);
    const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
    return res.json({
      data: {
        maintenance_mode:    map.coming_soon_mode === 'true',
        maintenance_message: map.maintenance_message || '',
        invite_only:         map.invite_only === 'true',
      },
    });
  } catch (err) { next(err); }
}

/* ─── Relatório de impacto público (sem auth) ─── */
async function getImpact(req, res, next) {
  try {
    /* Operadores de demonstracao (dados fabricados para visitantes experimentarem)
       nunca podem entrar nestas estatisticas -- partilhadas publicamente, incluindo
       com o Ministerio do Turismo. */
    const { data: demoOps } = await supabaseAdmin.from('operators').select('id').eq('is_demo', true);
    const demoIds = (demoOps || []).map((o) => o.id);
    const excludeDemo = (query) => (demoIds.length ? query.not('operator_id', 'in', `(${demoIds.join(',')})`) : query);

    const { count: operatorsTotal } = await supabaseAdmin
      .from('operators')
      .select('*', { count: 'exact', head: true })
      .eq('onboarding_complete', true)
      .eq('is_demo', false);

    const { data: opTypes } = await supabaseAdmin
      .from('operators')
      .select('operator_type')
      .eq('onboarding_complete', true)
      .eq('is_demo', false);

    const { data: opIslands } = await supabaseAdmin
      .from('operators')
      .select('island_id')
      .eq('onboarding_complete', true)
      .eq('is_demo', false)
      .not('island_id', 'is', null);
    const islandsCount = new Set((opIslands || []).map((o) => o.island_id)).size || 1;

    const typeMap = {};
    (opTypes || []).forEach((o) => {
      typeMap[o.operator_type] = (typeMap[o.operator_type] || 0) + 1;
    });

    const { count: reservationsTotal } = await excludeDemo(
      supabaseAdmin
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .in('status', ['confirmed', 'checked_in', 'checked_out', 'cancelled'])
    );

    const { count: clientsTotal } = await excludeDemo(
      supabaseAdmin
        .from('customers')
        .select('*', { count: 'exact', head: true })
    );

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoff = sixMonthsAgo.toISOString();

    const { data: opMonthly } = await supabaseAdmin
      .from('operators')
      .select('created_at')
      .eq('onboarding_complete', true)
      .eq('is_demo', false)
      .gte('created_at', cutoff);

    const { data: resMonthly } = await excludeDemo(
      supabaseAdmin
        .from('reservations')
        .select('created_at, operator_id')
        .gte('created_at', cutoff)
        .in('status', ['confirmed', 'checked_in', 'checked_out'])
    );

    function aggregateByMonth(rows) {
      const map = {};
      (rows || []).forEach((r) => {
        const m = r.created_at.substring(0, 7);
        map[m] = (map[m] || 0) + 1;
      });
      const result = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const key = d.toISOString().substring(0, 7);
        result.push({ month: key, count: map[key] || 0 });
      }
      return result;
    }

    return res.json({
      data: {
        operators_total:      operatorsTotal  || 0,
        reservations_total:   reservationsTotal || 0,
        clients_total:        clientsTotal    || 0,
        islands_count:        islandsCount,
        operator_types:       typeMap,
        monthly_operators:    aggregateByMonth(opMonthly),
        monthly_reservations: aggregateByMonth(resMonthly),
      }
    });
  } catch (err) {
    next(err);
  }
}

/* ─── Submissão de candidatura de operador (website) ─── */
async function submitLead(req, res, next) {
  try {
    const {
      nome, email, telefone, whatsapp, funcao,
      nome_negocio, tipo_negocio, localizacao, anos_operacao, clientes_mes,
      tem_site, url_site, como_gere_reservas, desafios, num_funcionarios, otas, volume_mensal,
      plano_interesse, quando_comecar, como_soube, disponivel_demo, horario_contacto,
      comentarios, aceita_termos, aceita_comunicacoes, ref,
    } = req.body;

    if (!nome || !email || !email.includes('@')) {
      return res.status(400).json({ error: 'Nome e email são obrigatórios', code: 'MISSING_FIELDS' });
    }
    if (!aceita_termos) {
      return res.status(400).json({ error: 'Deve aceitar os termos e condições', code: 'TERMS_REQUIRED' });
    }

    /* Programa de referencia entre operadores -- "ref" e o slug do operador
       que partilhou o link (saldesk.cv/operadores.html?ref={slug}), nunca
       o proprio slug de quem se candidata (nao faz sentido um operador
       "indicar-se a si proprio"). Falha silenciosa se o slug nao existir --
       nunca bloquear a candidatura por causa de um link de indicacao
       invalido/copiado errado. */
    let referredByOperatorId = null;
    if (ref && typeof ref === 'string') {
      const { data: referrer } = await supabaseAdmin
        .from('operators')
        .select('id')
        .eq('slug', ref.trim().toLowerCase())
        .maybeSingle();
      if (referrer) referredByOperatorId = referrer.id;
    }

    /* operator_leads, nao leads -- e a tabela que TODO o painel de pipeline
       do fundador (AdminPipeline.jsx/adminController.js) realmente le e
       escreve. Gravar em "leads" (tabela diferente, nunca lida pelo painel)
       deixava candidaturas reais de operadores completamente invisiveis ao
       fundador -- confirmado ao vivo: operator_leads parada desde 2026-07-02,
       leads a receber candidaturas reais ate hoje, sem ninguem dar por isso. */
    const { error } = await supabaseAdmin
      .from('operator_leads')
      .insert({
        email:               email.trim().toLowerCase(),
        nome:                nome,
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
        referred_by_operator_id: referredByOperatorId,
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
    enviarEmail({
      to: email,
      subject: 'Recebemos a sua candidatura — SalDesk',
      html: `<div style="font-family:sans-serif;max-width:600px">
  <h2 style="color:#0D5470">Olá ${nome},</h2>
  <p>Recebemos a sua candidatura para aderir à SalDesk.</p>
  <p>A nossa equipa irá entrar em contacto consigo em até 24 horas.</p>
  <p>Enquanto isso, pode explorar a plataforma em <a href="https://saldesk.cv" style="color:#0D5470">saldesk.cv</a>.</p>
  <br/><p style="color:#6B7280;font-size:13px">Equipa SalDesk · hello@saldesk.cv</p>
</div>`,
      text: `Olá ${nome}, recebemos a sua candidatura. Entraremos em contacto em até 24 horas. Equipa SalDesk.`,
    }).catch(err => console.error('[Email] Erro ao enviar confirmacao ao candidato:', err.message));

    return res.json({ message: 'Candidatura recebida com sucesso' });
  } catch (err) { next(err); }
}

/* Conect: lista de categorias para filtros do catalogo publico e para o
   Select de categoria no UnitForm do operador (ambos consomem a mesma
   tabela em vez de listas hardcoded duplicadas). */
async function getExperienceCategories(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('experience_categories')
      .select('id, slug, label_pt, label_en, parent_id')
      .order('label_pt');
    if (error) throw error;
    return res.json({ data: data || [], message: 'Categorias listadas' });
  } catch (err) { next(err); }
}

/* Lista de ilhas de Cabo Verde -- usada no picker do onboarding, na
   previsao meteorologica por operador e na lista de recolha do rent-a-car. */
async function listIslands(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('islands')
      .select('id, name, slug, lat, lng, airport_code')
      .order('name');
    if (error) throw error;
    return res.json({ data: data || [] });
  } catch (err) { next(err); }
}

module.exports = {
  getOperador,
  listIslands,
  trackView,
  verificarDisponibilidadePublica,
  getSlotAvailability,
  verificarDisponibilidadeRestaurantePublica,
  criarReserva,
  discover,
  discoverUnits,
  cmsExperiences,
  cmsEvents,
  cmsBanners,
  publicReviews,
  publicContact,
  slugReviews,
  slugContact,
  sendGuestChatMessage,
  getGuestChatHistory,
  getUnit,
  callWaiter,
  createOrder,
  getUnitReviews,
  marcarReviewUtil,
  submitLead,
  getImpact,
  getSiteStatus,
  getExperienceCategories,
};

/* ─── CMS público para o website ─────────────────────────────── */
async function getCmsPublic(req, res) {
  try {
    const [pricing, testimonials, faqs, hero] = await Promise.all([
      supabaseAdmin.from('cms_pricing').select('*').order('price_eur'),
      supabaseAdmin.from('cms_testimonials').select('*').order('order_index'),
      supabaseAdmin.from('cms_faqs').select('*').order('order_index'),
      supabaseAdmin.from('cms_settings').select('*').in('key', [
        'hero_title_pt','hero_title_en','hero_subtitle_pt','hero_subtitle_en',
        'site_launch_date','site_operators_count','site_revenue_saved'
      ]),
    ]);

    const heroMap = {};
    (hero.data || []).forEach(r => { heroMap[r.key] = r.value; });

    return res.json({
      data: {
        pricing:      pricing.data || [],
        testimonials: testimonials.data || [],
        faqs:         faqs.data || [],
        hero:         heroMap,
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno' });
  }
}

module.exports = Object.assign(module.exports, { getCmsPublic });
