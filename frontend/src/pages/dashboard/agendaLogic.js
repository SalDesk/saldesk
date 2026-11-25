/* Logica pura da agenda do dia do Dashboard (e das metricas da moldura nova).
   Sem React e sem imports de servicos: recebe dados ja carregados e devolve valores. */

export const DURACAO_POR_OMISSAO_MIN = 60;
const FIM_DO_DIA_MIN = 24 * 60;
const ESTADOS_ATIVOS = ['pending', 'confirmed', 'checked_in'];

/* "14:00" ou "14:00:00" -> minutos desde as 00:00; qualquer outra coisa -> null */
export function paraMinutos(hora) {
  if (typeof hora !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hora.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/* minutos -> "HH:MM" */
export function paraHora(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* Meta JSON guardada na descricao do tour (start_time, duration em horas, meeting_point, time_slots) */
export function metaDoTour(tour) {
  const d = tour?.description;
  if (typeof d !== 'string' || !d.startsWith('{')) return {};
  try {
    const meta = JSON.parse(d);
    return meta && typeof meta === 'object' ? meta : {};
  } catch {
    return {};
  }
}

export function positivo(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* Capacidade do horario (time_slots da ficha) se existir, senao a do tour, senao null */
export function capacidadeDe(tour, meta, horario) {
  if (horario !== null && Array.isArray(meta.time_slots)) {
    const slot = meta.time_slots.find((s) => s && paraMinutos(String(s.time ?? '')) === horario);
    const cap = positivo(slot?.capacity);
    if (cap !== null) return cap;
  }
  return positivo(tour.capacity);
}

/* Duracao do tour em minutos: meta.duration (horas) x 60, senao a duracao por omissao */
export function duracaoDe(meta) {
  const horas = positivo(meta.duration);
  return horas !== null ? Math.round(horas * 60) : DURACAO_POR_OMISSAO_MIN;
}

/* Reservas de hoje -> um evento por (tour, horario), pela ordem em que aparecem */
export function eventosAtividades({ reservas, tours, atribuicoes } = {}) {
  const toursPorId = new Map((Array.isArray(tours) ? tours : []).filter(Boolean).map((t) => [t.id, t]));

  /* Guias por reserva (sem atribuicoes canceladas) */
  const guiasPorReserva = new Map();
  (Array.isArray(atribuicoes) ? atribuicoes : []).forEach((a) => {
    const nome = a?.staff?.name;
    /* condutores (role 'driver' nas atribuicoes compostas) nao sao guias */
    if (!a || a.status === 'cancelled' || a.role === 'driver' || !a.reservation_id || !nome) return;
    if (!guiasPorReserva.has(a.reservation_id)) guiasPorReserva.set(a.reservation_id, []);
    guiasPorReserva.get(a.reservation_id).push(nome);
  });

  const eventos = new Map();
  (Array.isArray(reservas) ? reservas : []).forEach((r) => {
    if (!r || !ESTADOS_ATIVOS.includes(r.status)) return;
    const tour = toursPorId.get(r.unit_id);
    if (!tour) return;
    const meta = metaDoTour(tour);
    const horario = paraMinutos(r.start_time) ?? paraMinutos(meta.start_time);
    const id = `${tour.id}|${horario === null ? 'sem-hora' : paraHora(horario)}`;

    if (!eventos.has(id)) {
      eventos.set(id, {
        id,
        inicio: horario === null ? null : paraHora(horario),
        inicioMin: horario,
        fimMin: horario === null ? null : horario + duracaoDe(meta),
        titulo: tour.name || '',
        local: typeof meta.meeting_point === 'string' ? meta.meeting_point : '',
        pessoas: 0,
        capacidade: capacidadeDe(tour, meta, horario),
        pendentes: 0,
        guias: [],
        clientes: [],
      });
    }
    const ev = eventos.get(id);
    ev.pessoas += positivo(r.guests) ?? 1;
    if (r.status === 'pending') ev.pendentes += 1;
    if (r.customer_name) ev.clientes.push(r.customer_name);
    (guiasPorReserva.get(r.id) || []).forEach((g) => { if (!ev.guias.includes(g)) ev.guias.push(g); });
  });

  return [...eventos.values()];
}

/* Estado visual do evento pela hora atual (minutos desde as 00:00) */
export function estadoDoEvento(evento, agoraMin) {
  if (!evento || evento.inicioMin === null || evento.inicioMin === undefined) return 'sem_hora';
  const fim = Math.min(evento.fimMin ?? evento.inicioMin + DURACAO_POR_OMISSAO_MIN, FIM_DO_DIA_MIN);
  /* Chegadas, partidas, levantamentos e devolucoes por fazer: a hora passar nao as conclui */
  if (agoraMin >= fim) return evento.acaoPendente ? 'a_seguir' : 'concluido';
  if (agoraMin >= evento.inicioMin) return 'a_decorrer';
  return 'a_seguir';
}

/* Separa os eventos sem hora e ordena: por hora de inicio, empate pelo titulo */
export function ordenarAgenda(eventos) {
  const lista = Array.isArray(eventos) ? eventos.filter(Boolean) : [];
  const porTitulo = (a, b) => String(a.titulo).localeCompare(String(b.titulo));
  return {
    semHora: lista.filter((e) => e.inicioMin === null || e.inicioMin === undefined).sort(porTitulo),
    comHora: lista
      .filter((e) => e.inicioMin !== null && e.inicioMin !== undefined)
      .sort((a, b) => (a.inicioMin - b.inicioMin) || porTitulo(a, b)),
  };
}

/* ── Metricas da moldura ─────────────────────────────────────── */

function numeroOuZero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/* Receita acumulada por dia, de inicioMes ate hoje (inclusive); dias sem entrada somam 0 */
export function serieReceitaAcumulada(serie, inicioMes, hoje) {
  const porDia = new Map();
  (Array.isArray(serie) ? serie : []).forEach((p) => {
    if (p && typeof p.periodo === 'string') porDia.set(p.periodo, (porDia.get(p.periodo) || 0) + numeroOuZero(p.receita));
  });
  const valores = [];
  const d = new Date(`${inicioMes}T00:00:00Z`);
  const fim = new Date(`${hoje}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(fim.getTime())) return valores;
  let acumulado = 0;
  while (d <= fim) {
    acumulado += porDia.get(d.toISOString().slice(0, 10)) || 0;
    valores.push(Math.round(acumulado * 100) / 100);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return valores;
}

/* Variacao percentual arredondada; sem base (anterior <= 0) ou valores invalidos -> null */
export function variacaoPercentual(atual, anterior) {
  const a = Number(atual);
  const b = Number(anterior);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return Math.round(((a - b) / b) * 100);
}

/* Receita / numero de reservas; sem reservas -> null */
export function valorMedio(receita, numReservas) {
  const n = Number(numReservas);
  if (!Number.isFinite(n) || n <= 0) return null;
  return numeroOuZero(receita) / n;
}

/* Soma do que falta pagar (nunca negativo por reserva) */
export function porReceber(reservas) {
  return (Array.isArray(reservas) ? reservas : []).reduce((soma, r) => (
    soma + Math.max(0, numeroOuZero(r?.total_price) - numeroOuZero(r?.amount_paid))
  ), 0);
}

/* Locale das datas por idioma da app */
const LOCALES = { pt: 'pt-PT', en: 'en-GB', de: 'de-DE', nl: 'nl-NL' };
export function localeDe(lang) {
  return LOCALES[lang] || LOCALES.pt;
}

/* Chave da saudacao pela hora local: 5-11 manha, 12-18 tarde, resto noite */
export function saudacao(hora) {
  if (hora >= 5 && hora <= 11) return 'morning';
  if (hora >= 12 && hora <= 18) return 'afternoon';
  return 'evening';
}
