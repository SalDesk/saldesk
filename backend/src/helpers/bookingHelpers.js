const { opcoesDaActividade, opcaoEscolhida, limitarVeiculos, idiomaEfectivo, suplementoIdioma } = require('./opcoesActividade');

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

// Exclui uma ou varias reservas (id ou lista de ids) de uma consulta de ocupacao.
// Lista vazia ou null nao acrescenta filtro.
function aplicarExclusao(query, excluirReservaId) {
  if (Array.isArray(excluirReservaId)) {
    return excluirReservaId.length ? query.not('id', 'in', `(${excluirReservaId.join(',')})`) : query;
  }
  return excluirReservaId ? query.neq('id', excluirReservaId) : query;
}

// Verifica se uma unidade está disponível num período. Tours/actividades sao
// reservas de um so dia (check_in === check_out) -- um intervalo exclusivo
// [d, d) fica vazio e nunca colide consigo mesmo, por isso a comparacao SQL
// directa (check_in < checkOut AND check_out > checkIn) deixava passar duas
// reservas no mesmo dia para a mesma unidade sem detectar conflito nenhum.
// Normaliza para "dia seguinte" so para efeitos de comparacao (o que fica
// gravado na BD continua check_in === check_out, sem alteracao).
async function verificarDisponibilidade(supabase, unitId, checkIn, checkOut, excluirReservaId = null) {
  const effectiveCheckOut = checkOut > checkIn ? checkOut : addDays(checkIn, 1);

  let query = supabase
    .from('reservations')
    .select('id, check_in, check_out')
    .eq('unit_id', unitId)
    .in('status', ['pending', 'confirmed', 'checked_in'])
    .lt('check_in', effectiveCheckOut);

  if (excluirReservaId) {
    query = aplicarExclusao(query, excluirReservaId);
  }

  const { data: candidatos } = await query;
  const conflito = (candidatos || []).some((r) => {
    const rEffectiveCheckOut = r.check_out > r.check_in ? r.check_out : addDays(r.check_in, 1);
    return rEffectiveCheckOut > checkIn;
  });
  if (conflito) return false;

  const { data: bloqueadas } = await supabase
    .from('blocked_dates')
    .select('id')
    .eq('unit_id', unitId)
    .gte('date', checkIn)
    .lt('date', effectiveCheckOut);

  return !(bloqueadas?.length > 0);
}

// Calcula o preço total dia a dia aplicando pricing_rules activas
function calcularPreco(unit, checkIn, checkOut) {
  const dtIn = new Date(checkIn);
  const dtOut = new Date(checkOut);
  const regras = (unit.pricing_rules || []).filter((r) => r.active);

  let total = 0;
  const cur = new Date(dtIn);

  while (cur < dtOut) {
    let precoDia = Number(unit.base_price);
    const diaSemana = cur.getUTCDay(); // as datas sao UTC: getDay() (hora local) deslocava o dia no fuso do servidor
    const dataStr = cur.toISOString().split('T')[0];

    for (const r of regras) {
      const dentroPeriodo =
        (!r.start_date || dataStr >= r.start_date) &&
        (!r.end_date || dataStr <= r.end_date);
      const diaValido = !r.days_of_week || r.days_of_week.includes(diaSemana);

      if (dentroPeriodo && diaValido) {
        if (r.modifier_type === 'percentage') {
          precoDia = precoDia * (1 + Number(r.price_modifier) / 100);
        } else {
          precoDia = precoDia + Number(r.price_modifier);
        }
      }
    }

    total += Math.max(0, precoDia);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const dias = Math.ceil((dtOut - dtIn) / (1000 * 60 * 60 * 24));
  return { total: Math.round(total * 100) / 100, dias };
}

const DEFAULT_SEATING_MINUTES = 120;

function parseUnitMeta(unit) {
  const raw = unit?.description;
  if (typeof raw !== 'string' || !raw.startsWith('{')) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

/* Preco de tour privado/grupo -- ate agora so existia um valor fixo unico
   (price_private), independente do numero de pessoas. Pedido real de um
   operador (Logan Tours): precos em escaloes por numero de pessoas (1-2
   PAX, 3-4 PAX, etc.), nao um valor unico nem preco linear por pessoa.
   price_tiers (se configurado) tem prioridade; cai para price_private
   (comportamento antigo, continua a funcionar sem alteracao) quando nao
   ha nenhum escalao a cobrir o numero de pessoas da reserva. Partilhada
   entre publicController.js e reservationsController.js para os dois
   caminhos de reserva nunca poderem divergir no preco cobrado. */
function calcularPrecoPrivado(unitMeta, numPessoas) {
  const tiers = Array.isArray(unitMeta.price_tiers) ? unitMeta.price_tiers : [];
  const tier = tiers.find((t) => numPessoas >= Number(t.pax_min) && numPessoas <= Number(t.pax_max));
  if (tier) return Number(tier.price) || 0;
  return Number(unitMeta.price_private) || 0;
}

function temPrecoPrivadoConfigurado(unitMeta) {
  return !!unitMeta.price_private || (Array.isArray(unitMeta.price_tiers) && unitMeta.price_tiers.length > 0);
}

/* Preco de actividade -- fonte unica do valor mostrado e do valor cobrado.
   per_person: adultos * base_price + criancas * (meta.price_child se definido,
   senao base_price). private: calcularPrecoPrivado para o grupo todo.
   Recusas: grupo acima da lotacao (CAPACITY_EXCEEDED, o total calculado e
   devolvido na mesma) e privado sem escalao nem price_private a cobrir o grupo
   (NO_PRICE_FOR_GROUP, total 0). lines usa descricoes em portugues; o frontend
   re-etiqueta por type.
   Com meta.options (validas) a tabela e o argumento mode sao ignorados: o preco e o
   modo vem da opcao escolhida (per_group = 'private'), opcao em falta ou desconhecida
   da OPTION_REQUIRED (total 0) e os veiculos sao corrigidos para [ceil(pessoas/lugares),
   pessoas]. O suplemento do idioma do guia (com ou sem opcoes) e uma linha 'language'
   antes da verificacao de lotacao. Ofertas e vouchers nao entram aqui.
   semSuplemento: reservas do operador (painel, venda de praia) -- nunca ha suplemento de
   idioma nem lingua por defeito, o operador escolhe o idioma a mao. */
function precoActividade(unit, meta, { adults, children, mode, optionId, vehicles, guideLanguage, semSuplemento = false } = {}) {
  meta = meta || {};
  const nAdults = Math.max(0, Math.floor(Number(adults) || 0));
  const nChildren = Math.max(0, Math.floor(Number(children) || 0));
  const party = nAdults + nChildren;
  const arred = (n) => Math.round(n * 100) / 100;
  const lines = [];
  let total = 0;
  let error = null;

  const temOpcoes = opcoesDaActividade(meta).length > 0;
  const opcao = temOpcoes ? opcaoEscolhida(meta, optionId) : null;
  const idioma = semSuplemento ? null : idiomaEfectivo(meta, guideLanguage);
  const modo = temOpcoes
    ? (opcao && opcao.type === 'per_group' ? 'private' : 'per_person')
    : (mode === 'private' ? 'private' : 'per_person');
  let nVeiculos = null;
  const escolha = () => ({ mode: modo, vehicles: nVeiculos, option: opcao, guideLanguage: idioma });

  /* Pelo menos 1 adulto (orcamento e reserva). Os chamadores sem divisao (paginas antigas,
     operador) passam todas as pessoas como adultos, por isso nunca caem aqui. */
  if (nAdults < 1) {
    return {
      total: 0,
      lines: [],
      error: { code: 'MIN_ADULTS', message_pt: 'É preciso pelo menos 1 adulto', message_en: 'At least 1 adult is required' },
      ...escolha(),
    };
  }

  if (temOpcoes && !opcao) {
    return {
      total: 0,
      lines: [],
      error: { code: 'OPTION_REQUIRED', message_pt: 'Escolha uma opção', message_en: 'Choose an option' },
      ...escolha(),
    };
  }

  if (opcao && opcao.type === 'per_person') {
    const childPrice = opcao.price_child !== undefined ? opcao.price_child : opcao.price;
    const totalAdults = arred(opcao.price * nAdults);
    const totalChildren = arred(childPrice * nChildren);
    total = arred(totalAdults + totalChildren);
    lines.push({ type: 'option', description: opcao.name_pt, quantity: nAdults, total: totalAdults });
    if (nChildren > 0) lines.push({ type: 'children', description: 'Crianças', quantity: nChildren, total: totalChildren });
  } else if (opcao && opcao.type === 'per_group') {
    total = arred(opcao.price);
    lines.push({ type: 'option', description: opcao.name_pt, quantity: party, total });
  } else if (opcao) {
    nVeiculos = limitarVeiculos(opcao.seats, party, vehicles);
    total = arred(opcao.price * nVeiculos);
    lines.push({ type: 'vehicles', description: opcao.name_pt, quantity: nVeiculos, total });
  } else if (mode === 'private') {
    total = arred(calcularPrecoPrivado(meta, party));
    lines.push({ type: 'tour', description: 'Tour privado', quantity: party, total });
  } else {
    const base = Number(unit?.base_price) || 0;
    const childPrice = meta.price_child !== undefined && meta.price_child !== null && meta.price_child !== ''
      ? Number(meta.price_child) || 0
      : base;
    const totalAdults = arred(base * nAdults);
    const totalChildren = arred(childPrice * nChildren);
    total = arred(totalAdults + totalChildren);
    lines.push({ type: 'tour', description: 'Adultos', quantity: nAdults, total: totalAdults });
    if (nChildren > 0) lines.push({ type: 'children', description: 'Crianças', quantity: nChildren, total: totalChildren });
  }

  const suplemento = suplementoIdioma(meta, idioma);
  if (suplemento > 0) {
    lines.push({ type: 'language', description: `Suplemento de idioma (${idioma})`, quantity: 1, total: suplemento });
    total = arred(total + suplemento);
  }

  const capacity = Number(unit?.capacity) || 0;
  if (capacity > 0 && party > capacity) {
    error = {
      code: 'CAPACITY_EXCEEDED',
      message_pt: 'Este grupo excede a lotação desta actividade',
      message_en: "This group exceeds this activity's capacity",
    };
  } else if (!temOpcoes && mode === 'private') {
    const tiers = Array.isArray(meta.price_tiers) ? meta.price_tiers : [];
    const coberto = tiers.some((t) => party >= Number(t.pax_min) && party <= Number(t.pax_max)) || Number(meta.price_private) > 0;
    if (!coberto) {
      total = 0;
      lines.forEach((l) => { l.total = 0; });
      error = {
        code: 'NO_PRICE_FOR_GROUP',
        message_pt: 'Para este número de pessoas, contacte o operador',
        message_en: 'For this group size, please contact the operator',
      };
    }
  }

  return { total, lines, error, ...escolha() };
}

// Verifica conflito de horario para UMA mesa candidata, num dia especifico --
// reservations_no_overlap_time (048) é a rede de segurança ao nível da BD;
// esta função decide qual mesa oferecer antes de tentar o insert.
async function verificarDisponibilidadeMesa(supabase, unitId, date, startTime, durationMinutes, excluirReservaId = null) {
  let query = supabase
    .from('reservations')
    .select('id, start_time, duration_minutes')
    .eq('unit_id', unitId)
    .eq('check_in', date)
    .in('status', ['pending', 'confirmed', 'checked_in'])
    .not('start_time', 'is', null);
  query = aplicarExclusao(query, excluirReservaId);

  const { data: existentes } = await query;

  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const novoInicio = toMin(startTime);
  const novoFim = novoInicio + durationMinutes;

  const conflito = (existentes || []).some((r) => {
    const oInicio = toMin(r.start_time);
    const oFim = oInicio + (r.duration_minutes || DEFAULT_SEATING_MINUTES);
    return oInicio < novoFim && oFim > novoInicio;
  });
  if (conflito) return false;

  const { data: bloqueadas } = await supabase
    .from('blocked_dates')
    .select('id')
    .eq('unit_id', unitId)
    .eq('date', date);

  return !(bloqueadas?.length > 0);
}

// Lista as mesas livres para operator_id/date/time/partySize(+zona preferida).
// O cliente escolhe a mesa exacta a partir desta lista -- nunca inventa nem
// esconde nenhuma candidata, so filtra por capacidade e ordena por zona.
// Combinação de mesas (units.description.combinable) fica fora desta fase.
async function listarMesasDisponiveis(supabase, operatorId, { date, startTime, durationMinutes = DEFAULT_SEATING_MINUTES, partySize, zone = null, excluirReservaId = null }) {
  const { data: mesas } = await supabase
    .from('units')
    .select('*')
    .eq('operator_id', operatorId)
    .eq('status', 'active');

  /* O Menu Digital (MenuDigital.jsx) tambem grava pratos/menus de degustacao
     como "units" do mesmo operador (unit_type 'menu_item'/'tasting_menu'),
     com capacity=1 -- sem este filtro, um prato podia aparecer como mesa
     a um cliente que reservasse para 1 pessoa. Mesmo filtro ja usado em
     Reservations.jsx para o dropdown de mesas do staff. */
  const candidatas = (mesas || [])
    .filter((unit) => unit.unit_type !== 'menu_item' && unit.unit_type !== 'tasting_menu')
    .map((unit) => ({ unit, meta: parseUnitMeta(unit) }))
    .filter(({ unit, meta }) => {
      const min = meta.capacity_min ?? 1;
      const max = meta.capacity_max ?? unit.capacity ?? 1;
      return partySize >= min && partySize <= max;
    })
    .sort((a, b) => {
      if (zone) {
        const az = a.meta.zone === zone ? 0 : 1;
        const bz = b.meta.zone === zone ? 0 : 1;
        if (az !== bz) return az - bz;
      }
      const maxA = a.meta.capacity_max ?? a.unit.capacity ?? 1;
      const maxB = b.meta.capacity_max ?? b.unit.capacity ?? 1;
      return maxA - maxB;
    });

  const disponiveis = [];
  for (const { unit, meta } of candidatas) {
    if (await verificarDisponibilidadeMesa(supabase, unit.id, date, startTime, durationMinutes, excluirReservaId)) {
      disponiveis.push({
        id: unit.id,
        name: unit.name,
        zone: meta.zone || null,
        capacity_min: meta.capacity_min ?? 1,
        capacity_max: meta.capacity_max ?? unit.capacity ?? 1,
        images: unit.images || [],
      });
    }
  }
  return disponiveis;
}

// Normaliza "HH:MM" ou "HH:MM:SS" (formato devolvido pela coluna `time` do
// Postgres) para "HH:MM", para comparar de forma fiavel um horario guardado
// em reservations.start_time com um horario definido em units.description.
function normalizarHora(t) {
  return typeof t === 'string' ? t.slice(0, 5) : t;
}

// Data e hora actuais em Cabo Verde (Atlantic/Cape_Verde, UTC-1, sem DST),
// independentes do fuso do servidor. Devolve { hoje: 'YYYY-MM-DD', hora: 'HH:MM' }.
function hojeEHoraCaboVerde(agora = new Date()) {
  const partes = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Atlantic/Cape_Verde', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(agora).forEach((p) => { partes[p.type] = p.value; });
  return { hoje: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` };
}

// Um slot ja comecou quando o dia ja passou, ou e hoje (em Cabo Verde) e a
// hora de inicio ja chegou. Nao se reserva um horario que ja arrancou.
function slotJaComecou(date, time, agora = new Date()) {
  const { hoje, hora } = hojeEHoraCaboVerde(agora);
  if (date < hoje) return true;
  return date === hoje && normalizarHora(time) <= hora;
}

// Soma os `guests` de reservas activas que ja ocupam um slot especifico
// (unidade+dia+hora) -- ao contrario de verificarDisponibilidadeMesa (uma
// mesa e exclusiva, so uma reserva de cada vez), um slot de tour tem
// capacidade partilhada: varias reservas podem coexistir ate ao limite do
// slot. Nunca usa a exclusion constraint reservations_no_overlap_time (essa
// fica reservada a mesas de restaurante) -- ver comentario em
// publicController.criarReserva sobre nao gravar duration_minutes para
// actividades, precisamente para essa constraint nunca se aplicar aqui.
// Devolve Infinity quando ha uma reserva de GRUPO nesse slot -- uma reserva
// de grupo ocupa o slot inteiro em exclusivo (preco fixo, tour privado),
// nunca partilha capacidade com outras reservas, individuais ou de grupo.
// Math.max(0, capacidade - Infinity) da sempre 0, por isso o resto do
// codigo (listarSlotsComDisponibilidade, etc.) nao precisa de tratamento
// especial para este caso.
async function ocupacaoDoSlot(supabase, unitId, date, time, excluirReservaId = null) {
  let query = supabase
    .from('reservations')
    .select('id, start_time, guests, is_group_booking')
    .eq('unit_id', unitId)
    .eq('check_in', date)
    .in('status', ['pending', 'confirmed', 'checked_in']);
  query = aplicarExclusao(query, excluirReservaId);

  const { data } = await query;
  const doSlot = (data || []).filter((r) => normalizarHora(r.start_time) === normalizarHora(time));
  if (doSlot.some((r) => r.is_group_booking)) return Infinity;
  return doSlot.reduce((soma, r) => soma + (r.guests || 0), 0);
}

// Um dia bloqueado pelo operador (ferias, manutencao, etc. -- blocked_dates)
// zera TODOS os slots desse dia, independentemente de quantas reservas ja
// existem -- ao contrario da ocupacao por reserva, isto e um UNICO dia, nao
// um intervalo, por isso uma consulta pequena e directa.
async function diaBloqueado(supabase, unitId, date) {
  const { data } = await supabase
    .from('blocked_dates')
    .select('id')
    .eq('unit_id', unitId)
    .eq('date', date)
    .limit(1);
  return (data?.length || 0) > 0;
}

// Confirma se `partySize` pessoas ainda cabem num slot (hora) de uma
// actividade nesse dia, dada a capacidade configurada desse slot.
// isGroupBooking=true ignora partySize/capacidade -- uma reserva de grupo
// (preco fixo, tour privado) so cabe se o slot estiver COMPLETAMENTE livre
// (0 ocupados), independentemente do numero de pessoas do grupo.
async function verificarDisponibilidadeSlot(supabase, unitId, date, time, partySize, capacidade, excluirReservaId = null, isGroupBooking = false) {
  if (await diaBloqueado(supabase, unitId, date)) return false;
  const ocupados = await ocupacaoDoSlot(supabase, unitId, date, time, excluirReservaId);
  if (isGroupBooking) return ocupados === 0;
  return ocupados + partySize <= capacidade;
}

// Lugares restantes em cada slot configurado de uma unidade, para um dia --
// uma so consulta a BD (nao uma por slot), usada pelo selector de hora no
// booking publico para desactivar slots ja esgotados sem inventar/assumir
// disponibilidade. `privateAvailable` indica se o slot esta completamente
// livre (necessario para oferecer a opcao de reserva privada/grupo).
async function listarSlotsComDisponibilidade(supabase, unitId, date, slots) {
  if (await diaBloqueado(supabase, unitId, date)) {
    return (slots || []).map((s) => ({ time: s.time, capacity: Number(s.capacity) || 0, remaining: 0, privateAvailable: false }));
  }

  let query = supabase
    .from('reservations')
    .select('start_time, guests, is_group_booking')
    .eq('unit_id', unitId)
    .eq('check_in', date)
    .in('status', ['pending', 'confirmed', 'checked_in']);

  const { data } = await query;
  const ocupadosPorHora = {};
  (data || []).forEach((r) => {
    const h = normalizarHora(r.start_time);
    if (!h) return;
    if (r.is_group_booking) { ocupadosPorHora[h] = Infinity; return; }
    if (ocupadosPorHora[h] !== Infinity) ocupadosPorHora[h] = (ocupadosPorHora[h] || 0) + (r.guests || 0);
  });

  return (slots || []).map((s) => {
    const capacidade = Number(s.capacity) || 0;
    const ocupados = ocupadosPorHora[normalizarHora(s.time)] || 0;
    return {
      time: s.time, capacity: capacidade,
      remaining: Math.max(0, capacidade - ocupados),
      privateAvailable: ocupados === 0,
    };
  });
}

// Ocupacao de cada slot de uma unidade, para um INTERVALO de dias -- uma so
// consulta a BD para o intervalo inteiro (nao uma por dia), reduzida em JS.
// Usado pela GetYourGuide (queryAvailability), que pede disponibilidade de
// varios dias de uma vez -- mesmo principio de diasIndisponiveisEmLote
// (gygIntegratorController.js), so que por slot em vez de por dia inteiro.
// Devolve { "YYYY-MM-DD": { "HH:MM": ocupados, ... }, ... }.
async function ocupacaoSlotsEmLote(supabase, unitId, dataInicio, dataFimExclusiva) {
  /* Inclui tambem HOLDS activos (ota_reservation_holds, status='held', ainda
     nao expirados) -- so reservations confirmadas deixava a disponibilidade
     desactualizada logo a seguir a um reserve() da GYG (o hold ainda nao
     virou reservation, so acontece em book()), mostrando um slot como livre
     quando ja tinha um hold pendente a ocupa-lo. Bug real encontrado a
     testar reserve() seguido de get-availabilities directamente (2026-08-25).
     Mesmo principio ja usado em ocupacaoSlotComHolds (gygIntegratorController.js),
     agora tambem na versao em lote/intervalo. */
  const agora = new Date().toISOString();
  const [resReservas, resHolds] = await Promise.all([
    supabase.from('reservations').select('check_in, start_time, guests, is_group_booking')
      .eq('unit_id', unitId).in('status', ['pending', 'confirmed', 'checked_in'])
      .gte('check_in', dataInicio).lt('check_in', dataFimExclusiva)
      .not('start_time', 'is', null),
    supabase.from('ota_reservation_holds').select('check_in, start_time, participants, is_group_booking')
      .eq('unit_id', unitId).eq('status', 'held').gt('expires_at', agora)
      .gte('check_in', dataInicio).lt('check_in', dataFimExclusiva)
      .not('start_time', 'is', null),
  ]);

  const mapa = {};
  const acumula = (r, guests) => {
    const hora = normalizarHora(r.start_time);
    if (!hora) return;
    if (!mapa[r.check_in]) mapa[r.check_in] = {};
    if (r.is_group_booking) { mapa[r.check_in][hora] = Infinity; return; }
    if (mapa[r.check_in][hora] !== Infinity) {
      mapa[r.check_in][hora] = (mapa[r.check_in][hora] || 0) + (guests || 0);
    }
  };
  (resReservas.data || []).forEach((r) => acumula(r, r.guests));
  (resHolds.data || []).forEach((h) => acumula(h, h.participants));
  return mapa;
}

// Dias bloqueados (blocked_dates) de uma unidade, para um INTERVALO -- uma
// so consulta para o intervalo inteiro, devolve um Set de strings
// "YYYY-MM-DD". Usado pela GYG (queryAvailability/notifyAvailabilityChanged)
// para zerar TODOS os slots de um dia bloqueado, mesmo intervalo que
// ocupacaoSlotsEmLote ja cobre para reservas.
async function diasBloqueadosEmLote(supabase, unitId, dataInicio, dataFimExclusiva) {
  const { data } = await supabase
    .from('blocked_dates')
    .select('date')
    .eq('unit_id', unitId)
    .gte('date', dataInicio)
    .lt('date', dataFimExclusiva);
  return new Set((data || []).map((b) => b.date));
}

// Dias livres de um mes para o calendario de reserva -- UMA consulta ao mes
// inteiro (ocupacaoSlotsEmLote + diasBloqueadosEmLote), nunca uma por dia.
// Com time_slots: o dia esta livre se algum slot ainda nao comecou e tem
// lugar (per_person: capacidade - ocupados >= pax; private: 0 ocupados, e
// Infinity -- reserva privada -- conta como ocupado). Sem time_slots:
// regra de uma reserva por dia (pending/confirmed/checked_in no check_in).
// Dias passados e bloqueados nunca estao livres. Devolve { month, days }
// com so os dias livres presentes ({ 'YYYY-MM-DD': true }).
async function diasLivresDoMes(supabase, unit, meta, { month, pax = 1, mode = 'per_person', agora = new Date() } = {}) {
  const [ano, mes] = month.split('-').map(Number);
  const nDias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dataInicio = `${month}-01`;
  const proximo = new Date(Date.UTC(ano, mes, 1));
  const dataFimExclusiva = `${proximo.getUTCFullYear()}-${String(proximo.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const slots = Array.isArray(meta && meta.time_slots) ? meta.time_slots : [];
  const { hoje } = hojeEHoraCaboVerde(agora);

  let ocupacao = {};
  let reservadosPorDia = new Set();
  const bloqueadosPromise = diasBloqueadosEmLote(supabase, unit.id, dataInicio, dataFimExclusiva);
  if (slots.length) {
    ocupacao = await ocupacaoSlotsEmLote(supabase, unit.id, dataInicio, dataFimExclusiva);
  } else {
    const { data } = await supabase.from('reservations').select('check_in')
      .eq('unit_id', unit.id).in('status', ['pending', 'confirmed', 'checked_in'])
      .gte('check_in', dataInicio).lt('check_in', dataFimExclusiva);
    reservadosPorDia = new Set((data || []).map((r) => r.check_in));
  }
  const bloqueados = await bloqueadosPromise;

  const days = {};
  for (let d = 1; d <= nDias; d++) {
    const dia = `${month}-${String(d).padStart(2, '0')}`;
    if (dia < hoje || bloqueados.has(dia)) continue;
    if (!slots.length) {
      if (!reservadosPorDia.has(dia)) days[dia] = true;
      continue;
    }
    const doDia = ocupacao[dia] || {};
    const livre = slots.some((s) => {
      if (slotJaComecou(dia, s.time, agora)) return false;
      const ocupados = doDia[normalizarHora(s.time)] || 0;
      if (mode === 'private') return ocupados === 0;
      return (Number(s.capacity) || 0) - ocupados >= pax;
    });
    if (livre) days[dia] = true;
  }
  return { month, days };
}

module.exports = {
  verificarDisponibilidade, calcularPreco,
  verificarDisponibilidadeMesa, listarMesasDisponiveis, DEFAULT_SEATING_MINUTES, parseUnitMeta,
  verificarDisponibilidadeSlot, listarSlotsComDisponibilidade,
  normalizarHora, hojeEHoraCaboVerde, slotJaComecou, ocupacaoSlotsEmLote, diasBloqueadosEmLote, diasLivresDoMes,
  calcularPrecoPrivado, temPrecoPrivadoConfigurado, precoActividade,
};
