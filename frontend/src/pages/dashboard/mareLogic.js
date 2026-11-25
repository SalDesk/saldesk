/* Logica pura do painel Mare (Hoje): mare do dia, series, variacoes e ocupacao.
   Sem React e sem Date.now: recebe dados ja carregados e devolve valores. */
import {
  paraMinutos, paraHora, porReceber, metaDoTour, positivo, capacidadeDe, duracaoDe,
} from './agendaLogic';

/* Estados que contam (os mesmos que o Dashboard de atividades considera reservas validas) */
const ESTADOS_MARE = ['pending', 'confirmed', 'checked_in', 'checked_out'];
const ESTADOS_CHECKIN = ['checked_in', 'checked_out'];

/* Eixo da mare por omissao: 07:00 a 20:00 */
const HORA_INICIO_OMISSAO = 7;
const HORA_FIM_OMISSAO = 20;

/* Valor e series: tudo o que nao esta cancelado (inclui no_show), como reservasMes do Dashboard */
const naoCancelada = (r) => !!r && r.status !== 'cancelled';
const ativa = (r) => !!r && ESTADOS_MARE.includes(r.status);
const lista = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const pessoasDe = (r) => positivo(r.guests) ?? 1;
const numeroOuZero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ── Datas (YYYY-MM-DD) sem deriva de fuso ───────────────────── */

function somarDias(data, dias) {
  const [a, m, d] = String(data).split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return t.toISOString().slice(0, 10);
}

/* n dias consecutivos a partir de inicio (inclusive) */
export function diasSeguintes(inicio, n) {
  return Array.from({ length: Math.max(0, n) }, (_, i) => somarDias(inicio, i));
}

/* ── Mare do dia ─────────────────────────────────────────────── */

/* Pessoas na rua por hora. Uma atividade conta numa hora se se sobrepoe a essa hora.
   Reservas sem hora (nem da reserva nem do tour) ou de tours desconhecidos ficam fora. */
export function curvaMare(reservas, tours) {
  const toursPorId = new Map(lista(tours).map((t) => [t.id, t]));
  const atividades = [];
  const saidasPorId = new Map();

  lista(reservas).forEach((r) => {
    if (!ativa(r)) return;
    const tour = toursPorId.get(r.unit_id);
    if (!tour) return;
    const meta = metaDoTour(tour);
    const inicioMin = paraMinutos(r.start_time) ?? paraMinutos(meta.start_time);
    if (inicioMin === null) return;
    atividades.push({ inicioMin, fimMin: inicioMin + duracaoDe(meta), pessoas: pessoasDe(r) });
    const inicio = paraHora(inicioMin);
    saidasPorId.set(`${tour.id}|${inicio}`, { inicio, titulo: tour.name || '' });
  });

  let inicioHora = HORA_INICIO_OMISSAO;
  let fimHora = HORA_FIM_OMISSAO;
  atividades.forEach((a) => {
    inicioHora = Math.min(inicioHora, Math.floor(a.inicioMin / 60));
    /* ultima hora com sobreposicao, sem passar da meia-noite */
    fimHora = Math.max(fimHora, Math.min(23, Math.ceil(a.fimMin / 60) - 1));
  });

  const pontos = [];
  for (let hora = inicioHora; hora <= fimHora; hora += 1) {
    const pessoas = atividades
      .filter((a) => a.inicioMin < (hora + 1) * 60 && a.fimMin > hora * 60)
      .reduce((s, a) => s + a.pessoas, 0);
    pontos.push({ hora, pessoas });
  }

  const maximo = pontos.reduce((m, p) => Math.max(m, p.pessoas), 0);
  const pico = maximo > 0 ? { ...pontos.find((p) => p.pessoas === maximo) } : null;
  const saidas = [...saidasPorId.values()]
    .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.titulo.localeCompare(b.titulo));

  /* intervalos: atividades exatas (minutos), usadas por pessoasAs */
  return { inicioHora, fimHora, pontos, pico, saidas, intervalos: atividades };
}

/* Pessoas na rua num minuto exato (inicio inclusive, fim exclusive) */
export function pessoasAs(curva, minutos) {
  return (curva?.intervalos || [])
    .filter((a) => a.inicioMin <= minutos && minutos < a.fimMin)
    .reduce((s, a) => s + a.pessoas, 0);
}

/* ── Series e variacoes ──────────────────────────────────────── */

/* Total em euros das reservas nao canceladas */
export function valorDoDia(reservas) {
  return lista(reservas).filter(naoCancelada).reduce((s, r) => s + numeroOuZero(r.total_price), 0);
}

/* Uma medida por dia, os n dias que terminam em fimData, do mais antigo ao mais recente.
   medida: 'reservas' (numero), 'pessoas' ou 'valor'. Agrupa por check_in. */
export function serieDias(reservas, fimData, n, medida) {
  const dias = diasSeguintes(somarDias(fimData, -(n - 1)), n);
  const porDia = new Map(dias.map((d) => [d, 0]));
  lista(reservas).filter(naoCancelada).forEach((r) => {
    if (!porDia.has(r.check_in)) return;
    let valor = 1;
    if (medida === 'valor') valor = numeroOuZero(r.total_price);
    else if (medida === 'pessoas') valor = pessoasDe(r);
    porDia.set(r.check_in, porDia.get(r.check_in) + valor);
  });
  return dias.map((d) => porDia.get(d));
}

function temBase(semanaPassada) {
  return typeof semanaPassada === 'number' && Number.isFinite(semanaPassada) && semanaPassada > 0;
}

/* Diferenca com sinal face a semana passada: '+3', '-2', '0'; sem base -> null */
export function variacaoSemana(hoje, semanaPassada) {
  if (!temBase(semanaPassada) || !Number.isFinite(Number(hoje))) return null;
  const d = Math.round(Number(hoje) - semanaPassada);
  return d > 0 ? `+${d}` : String(d);
}

/* Variacao percentual inteira com sinal: '+8%', '-5%', '0%'; sem base -> null */
export function variacaoSemanaPct(hoje, semanaPassada) {
  if (!temBase(semanaPassada) || !Number.isFinite(Number(hoje))) return null;
  const p = Math.round(((Number(hoje) - semanaPassada) / semanaPassada) * 100);
  return `${p > 0 ? '+' : ''}${p}%`;
}

/* ── Saida e ocupacao ────────────────────────────────────────── */

/* Reservas de uma saida (evento da agenda: id "tour|HH:MM").
   A reserva pertence ao evento pela mesma regra de eventosAtividades: tour + (hora propria ?? hora do tour). */
export function reservasDaSaida(evento, reservasHoje, tours) {
  const toursPorId = new Map(lista(tours).map((t) => [String(t.id), t]));
  const tourId = String(evento?.tourId ?? String(evento?.id ?? '').split('|')[0]);
  const inicioMin = evento?.inicioMin ?? paraMinutos(evento?.inicio);
  const meta = metaDoTour(toursPorId.get(tourId));
  return lista(reservasHoje).filter((r) => {
    if (!ativa(r) || String(r.unit_id) !== tourId) return false;
    const horario = paraMinutos(r.start_time) ?? paraMinutos(meta.start_time);
    return horario === (inicioMin ?? null);
  });
}

/* Pessoas com check-in, total e por receber de uma saida */
export function detalheSaida(evento, reservasHoje, tours) {
  const doEvento = reservasDaSaida(evento, reservasHoje, tours);
  const soma = (rs) => rs.reduce((s, r) => s + pessoasDe(r), 0);
  return {
    checkin: soma(doEvento.filter((r) => ESTADOS_CHECKIN.includes(r.status))),
    total: soma(doEvento),
    porReceber: porReceber(doEvento),
  };
}

/* Capacidade do dia: soma dos horarios da ficha; sem horarios, a capacidade do tour; senao null */
function capacidadeDoDia(tour) {
  const meta = metaDoTour(tour);
  if (Array.isArray(meta.time_slots) && meta.time_slots.length > 0) {
    const soma = meta.time_slots.reduce((s, slot) => {
      const horario = paraMinutos(String(slot?.time ?? ''));
      return s + (horario === null ? 0 : (capacidadeDe(tour, meta, horario) ?? 0));
    }, 0);
    if (soma > 0) return soma;
  }
  return positivo(tour.capacity);
}

/* Ocupacao por tour ativo e dia: pessoas, capacidade e percentagem inteira (null sem capacidade) */
export function ocupacaoDias(reservas, tours, dias) {
  const validas = lista(reservas).filter(ativa);
  return lista(tours)
    .filter((t) => t.status !== 'inactive' && t.is_active !== false)
    .map((tour) => {
      const capacidade = capacidadeDoDia(tour);
      const celulas = lista(dias).map((data) => {
        const pessoas = validas
          .filter((r) => r.unit_id === tour.id && r.check_in === data)
          .reduce((s, r) => s + pessoasDe(r), 0);
        return {
          data,
          pessoas,
          capacidade,
          pct: capacidade === null ? null : Math.round((pessoas / capacidade) * 100),
        };
      });
      return { tourId: tour.id, nome: tour.name || '', celulas };
    });
}
