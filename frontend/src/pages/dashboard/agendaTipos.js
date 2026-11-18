/* Eventos da agenda do dia para hotel, rent-a-car e restaurante (funcoes puras, sem React).
   Devolvem o mesmo tipo Evento da agenda das atividades (agendaLogic.js), com dois campos a mais:
   `tipo` e `detalhe` (a linha secundaria ja composta). */
import { DURACAO_POR_OMISSAO_MIN, paraHora, paraMinutos } from './agendaLogic';

export const HORA_CHEGADA_HOTEL = '14:00';
export const HORA_PARTIDA_HOTEL = '11:00';
export const DURACAO_MESA_MIN = 90;

const ESTADOS_RESTAURANTE = ['pending', 'confirmed', 'checked_in'];
const PRATOS = ['menu_item', 'tasting_menu'];

function lista(valor) {
  return Array.isArray(valor) ? valor.filter(Boolean) : [];
}

function meta(unidade) {
  const d = unidade?.description;
  if (typeof d !== 'string' || !d.startsWith('{')) return {};
  try {
    const m = JSON.parse(d);
    return m && typeof m === 'object' ? m : {};
  } catch {
    return {};
  }
}

function pessoasDe(reserva) {
  const n = Number(reserva.guests);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/* Reservas sem ids repetidos (a mesma reserva pode chegar por dois pedidos) */
function semRepetidos(reservas) {
  const vistos = new Set();
  return lista(reservas).filter((r) => {
    if (vistos.has(r.id)) return false;
    vistos.add(r.id);
    return true;
  });
}

function evento({ tipo, reserva, inicioMin, duracao, detalhe, t, acaoPendente = false }) {
  const temHora = inicioMin !== null && inicioMin !== undefined;
  return {
    id: `${tipo}|${reserva.id}`,
    tipo,
    inicio: temHora ? paraHora(inicioMin) : null,
    inicioMin: temHora ? inicioMin : null,
    fimMin: temHora ? inicioMin + duracao : null,
    titulo: t(`dashboard.agenda.${tipo}`, { name: reserva.customer_name || '—' }),
    detalhe: detalhe.filter(Boolean).join(' · '),
    local: '',
    pessoas: pessoasDe(reserva),
    capacidade: null,
    pendentes: reserva.status === 'pending' ? 1 : 0,
    guias: [],
    clientes: reserva.customer_name ? [reserva.customer_name] : [],
    /* so entram chegadas/partidas/levantamentos/devolucoes ainda por fazer: nunca ficam "concluidas" pela hora */
    acaoPendente,
  };
}

function noites(reserva) {
  const a = new Date(`${reserva.check_in}T00:00:00Z`).getTime();
  const b = new Date(`${reserva.check_out}T00:00:00Z`).getTime();
  const n = Math.round((b - a) / 86400000);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/* Hotel: chegadas (check_in hoje, ainda por chegar) as 14:00 e partidas (check_out hoje, ainda por sair) as 11:00 */
export function eventosHotel({ reservas, unidades, hoje, t = (k) => k } = {}) {
  const porId = new Map(lista(unidades).map((u) => [u.id, u]));
  const eventos = [];
  semRepetidos(reservas).forEach((r) => {
    const quarto = porId.get(r.unit_id);
    const detalhe = [quarto?.name, t('dashboard.agenda.guests', { n: pessoasDe(r) }), t('dashboard.agenda.nights', { n: noites(r) })];
    if (r.check_out === hoje && r.status === 'checked_in') {
      eventos.push(evento({ tipo: 'partida', reserva: r, inicioMin: paraMinutos(HORA_PARTIDA_HOTEL), duracao: DURACAO_POR_OMISSAO_MIN, detalhe, t, acaoPendente: true }));
    }
    if (r.check_in === hoje && ['pending', 'confirmed'].includes(r.status)) {
      eventos.push(evento({ tipo: 'chegada', reserva: r, inicioMin: paraMinutos(HORA_CHEGADA_HOTEL), duracao: DURACAO_POR_OMISSAO_MIN, detalhe, t, acaoPendente: true }));
    }
  });
  return eventos;
}

/* Rent-a-car: levantamentos (check_in hoje, por levantar) e devolucoes (check_out hoje, por devolver), a hora da reserva */
export function eventosRentacar({ reservas, unidades, hoje, t = (k) => k } = {}) {
  const porId = new Map(lista(unidades).map((u) => [u.id, u]));
  const eventos = [];
  semRepetidos(reservas).forEach((r) => {
    const viatura = porId.get(r.unit_id);
    const m = meta(viatura);
    const nome = m.brand ? `${m.brand} ${m.model || ''}`.trim() : viatura?.name;
    const detalhe = [nome, m.plate];
    const inicioMin = paraMinutos(r.start_time);
    if (r.check_in === hoje && ['pending', 'confirmed'].includes(r.status)) {
      eventos.push(evento({ tipo: 'levantamento', reserva: r, inicioMin, duracao: DURACAO_POR_OMISSAO_MIN, detalhe, t, acaoPendente: true }));
    }
    if (r.check_out === hoje && r.status === 'checked_in') {
      eventos.push(evento({ tipo: 'devolucao', reserva: r, inicioMin, duracao: DURACAO_POR_OMISSAO_MIN, detalhe, t, acaoPendente: true }));
    }
  });
  return eventos;
}

/* Restaurante: uma por reserva de mesa ativa hoje, a hora da reserva; marca o pre-pedido quando existe */
export function eventosRestaurante({ reservas, unidades, pedidos, hoje, t = (k) => k } = {}) {
  const porId = new Map(lista(unidades).map((u) => [u.id, u]));
  /* pedidos cancelados ja nao sao pre-pedido */
  const comPedido = new Set(lista(pedidos).filter((p) => p.status !== 'cancelled').map((p) => p.reservation_id).filter(Boolean));
  return semRepetidos(reservas)
    /* so se excluem reservas em pratos/menus conhecidos: se as mesas nao carregarem, as reservas ficam */
    .filter((r) => ESTADOS_RESTAURANTE.includes(r.status) && !PRATOS.includes(porId.get(r.unit_id)?.unit_type) && (!hoje || r.check_in === hoje))
    .map((r) => {
      const mesa = porId.get(r.unit_id);
      const m = meta(mesa);
      const duracao = Number(r.duration_minutes) > 0 ? Number(r.duration_minutes) : DURACAO_MESA_MIN;
      const detalhe = [
        mesa ? (m.number ? t('dashboard.restaurant.table', { n: m.number }) : mesa.name) : t('dashboard.restaurant.noTable'),
        t('dashboard.agenda.guests', { n: pessoasDe(r) }),
        comPedido.has(r.id) ? t('dashboard.agenda.preOrder') : '',
      ];
      return evento({ tipo: 'mesa', reserva: r, inicioMin: paraMinutos(r.start_time), duracao, detalhe, t });
    });
}
