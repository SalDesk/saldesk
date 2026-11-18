/* Eventos da agenda de hotel, rent-a-car e restaurante (funcoes puras). */
import { describe, expect, it } from 'vitest';
import {
  eventosHotel, eventosRentacar, eventosRestaurante, HORA_CHEGADA_HOTEL, HORA_PARTIDA_HOTEL, DURACAO_MESA_MIN,
} from '../pages/dashboard/agendaTipos';

const HOJE = '2026-11-20';
const t = (k, v) => k + (v ? JSON.stringify(v) : '');
let seq = 0;
const r = (o) => ({ id: 'r' + (seq += 1), unit_id: 'u1', status: 'confirmed', guests: 2, customer_name: 'Ana Silva', check_in: HOJE, check_out: '2026-11-23', start_time: null, ...o });

describe('agendaTipos: hotel', () => {
  const QUARTO = { id: 'u1', name: 'Suite 12', unit_type: 'suite' };

  it('as_constantes_do_desenho', () => {
    expect([HORA_CHEGADA_HOTEL, HORA_PARTIDA_HOTEL, DURACAO_MESA_MIN]).toEqual(['14:00', '11:00', 90]);
  });

  it('hotel_chegadas_as_14_e_partidas_as_11', () => {
    const chegada = r({});
    const partida = r({ check_in: '2026-11-17', check_out: HOJE, status: 'checked_in', customer_name: 'Rui Costa' });
    const meio = r({ check_in: '2026-11-18', check_out: '2026-11-22', status: 'checked_in' });
    const ev = eventosHotel({ reservas: [chegada, partida, meio], unidades: [QUARTO], hoje: HOJE, t });
    expect(ev).toHaveLength(2);
    expect(ev.find((e) => e.tipo === 'chegada')).toMatchObject({ inicio: '14:00', inicioMin: 840, fimMin: 900, titulo: 'dashboard.agenda.chegada{"name":"Ana Silva"}' });
    expect(ev.find((e) => e.tipo === 'partida')).toMatchObject({ inicio: '11:00', inicioMin: 660, fimMin: 720, titulo: 'dashboard.agenda.partida{"name":"Rui Costa"}' });
  });

  it('hotel_chegada_e_partida_no_mesmo_quarto_sao_dois_eventos', () => {
    const sai = r({ check_in: '2026-11-17', check_out: HOJE, status: 'checked_in' });
    const entra = r({});
    const ev = eventosHotel({ reservas: [sai, entra], unidades: [QUARTO], hoje: HOJE, t });
    expect(ev.map((e) => e.tipo).sort()).toEqual(['chegada', 'partida']);
    expect(new Set(ev.map((e) => e.id)).size).toBe(2);
  });

  it('hotel_detalhe_quarto_hospedes_noites', () => {
    const [e] = eventosHotel({ reservas: [r({ check_out: '2026-11-23' })], unidades: [QUARTO], hoje: HOJE, t });
    expect(e.detalhe).toBe('Suite 12 · dashboard.agenda.guests{"n":2} · dashboard.agenda.nights{"n":3}');
    expect(e).toMatchObject({ capacidade: null, pessoas: 2, clientes: ['Ana Silva'], guias: [] });
  });

  it('hotel_pendente_conta_como_por_confirmar', () => {
    const [e] = eventosHotel({ reservas: [r({ status: 'pending' })], unidades: [QUARTO], hoje: HOJE, t });
    expect(e.pendentes).toBe(1);
  });

  it('hotel_chegada_ja_feita_ou_partida_ja_feita_nao_aparecem', () => {
    const chegou = r({ status: 'checked_in' });
    const saiu = r({ check_in: '2026-11-17', check_out: HOJE, status: 'checked_out' });
    expect(eventosHotel({ reservas: [chegou, saiu], unidades: [QUARTO], hoje: HOJE, t })).toEqual([]);
  });

  it('ids_repetidos_dao_um_so_evento', () => {
    const a = r({});
    expect(eventosHotel({ reservas: [a, { ...a }], unidades: [QUARTO], hoje: HOJE, t })).toHaveLength(1);
  });
});

describe('agendaTipos: rent-a-car', () => {
  const CARRO = { id: 'u1', name: 'Carro 1', description: JSON.stringify({ brand: 'Kia', model: 'Picanto', plate: 'ST-12-AB' }) };

  it('rentacar_levantamento_com_hora_e_devolucao', () => {
    const lev = r({ start_time: '09:30:00' });
    const dev = r({ check_in: '2026-11-15', check_out: HOJE, status: 'checked_in', start_time: '18:00' });
    const ev = eventosRentacar({ reservas: [lev, dev], unidades: [CARRO], hoje: HOJE, t });
    expect(ev.find((e) => e.tipo === 'levantamento')).toMatchObject({ inicio: '09:30', fimMin: 630, detalhe: 'Kia Picanto · ST-12-AB', titulo: 'dashboard.agenda.levantamento{"name":"Ana Silva"}' });
    expect(ev.find((e) => e.tipo === 'devolucao')).toMatchObject({ inicio: '18:00' });
  });

  it('rentacar_sem_hora_vai_para_sem_hora', () => {
    const [e] = eventosRentacar({ reservas: [r({})], unidades: [CARRO], hoje: HOJE, t });
    expect(e).toMatchObject({ inicio: null, inicioMin: null, fimMin: null });
  });

  it('rentacar_sem_meta_usa_o_nome', () => {
    const [e] = eventosRentacar({ reservas: [r({})], unidades: [{ id: 'u1', name: 'Buggy 2' }], hoje: HOJE, t });
    expect(e.detalhe).toBe('Buggy 2');
  });
});

describe('agendaTipos: restaurante', () => {
  const MESA = { id: 'u1', name: 'Mesa A', unit_type: 'table', description: JSON.stringify({ number: 4 }) };
  const PRATO = { id: 'p1', name: 'Atum', unit_type: 'menu_item' };
  const MENU = { id: 'p2', name: 'Degustacao', unit_type: 'tasting_menu' };
  const rr = (o) => r({ check_out: HOJE, start_time: '20:00', ...o });

  it('restaurante_hora_duracao_e_mesa', () => {
    const [com] = eventosRestaurante({ reservas: [rr({ duration_minutes: 120 })], unidades: [MESA], pedidos: [], hoje: HOJE, t });
    expect(com).toMatchObject({ inicio: '20:00', fimMin: 1320, tipo: 'mesa' });
    expect(com.detalhe.startsWith('dashboard.restaurant.table{"n":4}')).toBe(true);
    const [sem] = eventosRestaurante({ reservas: [rr({})], unidades: [MESA], pedidos: [], hoje: HOJE, t });
    expect(sem.fimMin).toBe(1290);
  });

  it('restaurante_marca_pre_pedido', () => {
    const a = rr({ id: 'res-a' });
    const [e] = eventosRestaurante({ reservas: [a], unidades: [MESA], pedidos: [{ id: 'o1', reservation_id: 'res-a' }], hoje: HOJE, t });
    expect(e.detalhe.endsWith('dashboard.agenda.preOrder')).toBe(true);
  });

  it('restaurante_ignora_pratos_e_menus', () => {
    const ev = eventosRestaurante({ reservas: [rr({ unit_id: 'p1' }), rr({ unit_id: 'p2' }), rr({})], unidades: [MESA, PRATO, MENU], pedidos: [], hoje: HOJE, t });
    expect(ev).toHaveLength(1);
  });

  it('so_estados_ativos_no_restaurante', () => {
    const ev = eventosRestaurante({ reservas: ['cancelled', 'checked_out', 'no_show'].map((s) => rr({ status: s })), unidades: [MESA], pedidos: [], hoje: HOJE, t });
    expect(ev).toEqual([]);
  });

  it('mesa_sem_numero_usa_o_nome', () => {
    const [e] = eventosRestaurante({ reservas: [rr({})], unidades: [{ id: 'u1', name: 'Esplanada 2', unit_type: 'table' }], pedidos: [], hoje: HOJE, t });
    expect(e.detalhe.startsWith('Esplanada 2')).toBe(true);
  });
});

describe('agendaTipos: entradas em falta', () => {
  it('entradas_em_falta_nao_rebentam', () => {
    expect(eventosHotel({})).toEqual([]);
    expect(eventosRentacar({})).toEqual([]);
    expect(eventosRestaurante({})).toEqual([]);
  });
});
