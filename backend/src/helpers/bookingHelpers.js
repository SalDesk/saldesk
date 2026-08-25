function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
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
    query = query.neq('id', excluirReservaId);
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
    const diaSemana = cur.getDay();
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
    cur.setDate(cur.getDate() + 1);
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
  if (excluirReservaId) query = query.neq('id', excluirReservaId);

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

// Soma os `guests` de reservas activas que ja ocupam um slot especifico
// (unidade+dia+hora) -- ao contrario de verificarDisponibilidadeMesa (uma
// mesa e exclusiva, so uma reserva de cada vez), um slot de tour tem
// capacidade partilhada: varias reservas podem coexistir ate ao limite do
// slot. Nunca usa a exclusion constraint reservations_no_overlap_time (essa
// fica reservada a mesas de restaurante) -- ver comentario em
// publicController.criarReserva sobre nao gravar duration_minutes para
// actividades, precisamente para essa constraint nunca se aplicar aqui.
async function ocupacaoDoSlot(supabase, unitId, date, time, excluirReservaId = null) {
  let query = supabase
    .from('reservations')
    .select('id, start_time, guests')
    .eq('unit_id', unitId)
    .eq('check_in', date)
    .in('status', ['pending', 'confirmed', 'checked_in']);
  if (excluirReservaId) query = query.neq('id', excluirReservaId);

  const { data } = await query;
  return (data || [])
    .filter((r) => normalizarHora(r.start_time) === normalizarHora(time))
    .reduce((soma, r) => soma + (r.guests || 0), 0);
}

// Confirma se `partySize` pessoas ainda cabem num slot (hora) de uma
// actividade nesse dia, dada a capacidade configurada desse slot.
async function verificarDisponibilidadeSlot(supabase, unitId, date, time, partySize, capacidade, excluirReservaId = null) {
  const ocupados = await ocupacaoDoSlot(supabase, unitId, date, time, excluirReservaId);
  return ocupados + partySize <= capacidade;
}

// Lugares restantes em cada slot configurado de uma unidade, para um dia --
// uma so consulta a BD (nao uma por slot), usada pelo selector de hora no
// booking publico para desactivar slots ja esgotados sem inventar/assumir
// disponibilidade.
async function listarSlotsComDisponibilidade(supabase, unitId, date, slots) {
  let query = supabase
    .from('reservations')
    .select('start_time, guests')
    .eq('unit_id', unitId)
    .eq('check_in', date)
    .in('status', ['pending', 'confirmed', 'checked_in']);

  const { data } = await query;
  const ocupadosPorHora = {};
  (data || []).forEach((r) => {
    const h = normalizarHora(r.start_time);
    if (h) ocupadosPorHora[h] = (ocupadosPorHora[h] || 0) + (r.guests || 0);
  });

  return (slots || []).map((s) => {
    const capacidade = Number(s.capacity) || 0;
    const ocupados = ocupadosPorHora[normalizarHora(s.time)] || 0;
    return { time: s.time, capacity: capacidade, remaining: Math.max(0, capacidade - ocupados) };
  });
}

module.exports = {
  verificarDisponibilidade, calcularPreco,
  verificarDisponibilidadeMesa, listarMesasDisponiveis, DEFAULT_SEATING_MINUTES, parseUnitMeta,
  verificarDisponibilidadeSlot, listarSlotsComDisponibilidade,
};
