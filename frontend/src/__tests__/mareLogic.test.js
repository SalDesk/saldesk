/* Logica pura do painel Mare (Hoje). */
import { describe, expect, it } from 'vitest';
import {
  curvaMare, pessoasAs, serieDias, valorDoDia, variacaoSemana, variacaoSemanaPct,
  detalheSaida, ocupacaoDias, diasSeguintes,
} from '../pages/dashboard/mareLogic';
import { porReceber } from '../pages/dashboard/agendaLogic';

const tour = (id, name, meta = {}, extra = {}) => ({
  id, name, status: 'active', is_active: true, capacity: null, description: JSON.stringify(meta), ...extra,
});
let seq = 0;
const res = (o) => ({
  id: `r${seq += 1}`, unit_id: 'A', status: 'confirmed', check_in: '2026-11-25',
  start_time: null, guests: 1, total_price: 0, amount_paid: 0, ...o,
});

describe('mareLogic', () => {
  it('curvaMare_conta_pessoas_por_hora', () => {
    const tours = [tour('A', 'Buggy', { duration: 3 }), tour('B', 'Passeio')];
    const reservas = [
      res({ unit_id: 'A', start_time: '08:30', guests: 2 }),
      res({ unit_id: 'A', start_time: '08:30:00', guests: 4 }),
      res({ unit_id: 'B', start_time: '10:00', guests: null }),
    ];
    const c = curvaMare(reservas, tours);
    const h = (n) => c.pontos.find((p) => p.hora === n).pessoas;
    expect(h(9)).toBe(6);
    expect(h(10)).toBe(7);
    expect(h(11)).toBe(6);
    expect(h(12)).toBe(0);
    expect(c.pico).toEqual({ hora: 10, pessoas: 7 });
    expect(pessoasAs(c, 8 * 60 + 30)).toBe(6);
    expect(pessoasAs(c, 10 * 60 + 30)).toBe(7);
    expect(pessoasAs(c, 11 * 60 + 30)).toBe(0);
  });

  it('curvaMare_ignora_canceladas_e_alarga_o_eixo', () => {
    const tours = [tour('A', 'Madrugada'), tour('B', 'Noite')];
    const canc = res({ unit_id: 'A', start_time: '09:00', guests: 5, status: 'cancelled' });
    const c = curvaMare([
      canc,
      res({ unit_id: 'A', start_time: '06:00' }),
      res({ unit_id: 'B', start_time: '21:30' }),
    ], tours);
    expect(c.inicioHora).toBe(6);
    expect(c.fimHora).toBe(22);
    expect(c.pontos).toHaveLength(17);
    expect(c.pontos.find((p) => p.hora === 9).pessoas).toBe(0);

    const vazia = curvaMare([canc], tours);
    expect(vazia.pontos.map((p) => p.hora)).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(vazia.pontos.every((p) => p.pessoas === 0)).toBe(true);
    expect(vazia.pico).toBeNull();
  });

  it('curvaMare_usa_a_hora_do_tour_e_conta_checked_out', () => {
    const tours = [tour('A', 'Buggy', { start_time: '14:00' })];
    const c = curvaMare([res({ status: 'checked_out', guests: 3 }), res({ unit_id: 'X', start_time: '10:00' })], tours);
    expect(c.pico).toEqual({ hora: 14, pessoas: 3 });
  });

  it('curvaMare_saidas_uma_por_tour_e_hora', () => {
    const tours = [tour('A', 'Buggy'), tour('B', 'Barco')];
    const c = curvaMare([
      res({ unit_id: 'A', start_time: '09:00' }),
      res({ unit_id: 'A', start_time: '09:00:00' }),
      res({ unit_id: 'B', start_time: '08:00' }),
    ], tours);
    expect(c.saidas).toEqual([{ inicio: '08:00', titulo: 'Barco' }, { inicio: '09:00', titulo: 'Buggy' }]);
  });

  it('serieDias_e_valorDoDia', () => {
    const reservas = [
      res({ check_in: '2026-11-25', total_price: 100, status: 'confirmed', guests: 2 }),
      res({ check_in: '2026-11-25', total_price: 50.5, status: 'pending', guests: 3 }),
      res({ check_in: '2026-11-25', total_price: 999, status: 'cancelled' }),
      res({ check_in: '2026-11-23', total_price: 40, status: 'checked_out', guests: null }),
      res({ check_in: '2026-11-01', total_price: 7 }),
    ];
    expect(valorDoDia(reservas.slice(0, 3))).toBe(150.5);
    const valor = serieDias(reservas, '2026-11-25', 7, 'valor');
    expect(valor).toHaveLength(7);
    expect(valor).toEqual([0, 0, 0, 0, 40, 0, 150.5]);
    expect(serieDias(reservas, '2026-11-25', 3, 'reservas')).toEqual([1, 0, 2]);
    expect(serieDias(reservas, '2026-11-25', 3, 'pessoas')).toEqual([1, 0, 5]);
    expect(serieDias(reservas, '2026-12-02', 2, 'valor')).toEqual([0, 0]);
  });

  it('variacaoSemana_sem_base_devolve_null', () => {
    expect(variacaoSemana(14, 11)).toBe('+3');
    expect(variacaoSemana(9, 11)).toBe('-2');
    expect(variacaoSemana(11, 11)).toBe('0');
    expect(variacaoSemana(5, 0)).toBeNull();
    expect(variacaoSemana(5, null)).toBeNull();
    expect(variacaoSemana(5, 'x')).toBeNull();
    expect(variacaoSemanaPct(1860, 1720)).toBe('+8%');
    expect(variacaoSemanaPct(95, 100)).toBe('-5%');
    expect(variacaoSemanaPct(100, 100)).toBe('0%');
    expect(variacaoSemanaPct(10, 0)).toBeNull();
    expect(variacaoSemanaPct(10, null)).toBeNull();
  });

  it('detalheSaida_conta_checkins_e_por_receber', () => {
    const evento = { id: 'A|09:00', inicio: '09:00', inicioMin: 540, titulo: 'Buggy' };
    const doEvento = [
      res({ status: 'checked_in', start_time: '09:00', guests: 2, total_price: 100, amount_paid: 100 }),
      res({ status: 'checked_out', start_time: '09:00:00', guests: 3, total_price: 90, amount_paid: 40 }),
      res({ status: 'confirmed', start_time: '09:00', guests: null, total_price: 30, amount_paid: 0 }),
    ];
    const outras = [
      res({ unit_id: 'B', start_time: '09:00', guests: 9, total_price: 500 }),
      res({ start_time: '11:00', guests: 9, total_price: 500 }),
      res({ start_time: '09:00', guests: 9, total_price: 500, status: 'cancelled' }),
    ];
    const d = detalheSaida(evento, [...doEvento, ...outras]);
    expect(d).toEqual({ checkin: 5, total: 6, porReceber: porReceber(doEvento) });
    expect(d.porReceber).toBe(80);
  });

  it('ocupacaoDias_usa_capacidade_dos_horarios_ou_do_tour', () => {
    const tours = [
      tour('A', 'Mergulho', { time_slots: [{ time: '09:00', capacity: 8 }, { time: '15:00', capacity: 8 }] }, { capacity: 99 }),
      tour('B', 'Barco', {}, { capacity: 10 }),
      tour('C', 'Livre'),
      tour('D', 'Inativo', {}, { capacity: 5, status: 'inactive' }),
    ];
    const reservas = [
      res({ unit_id: 'A', guests: 12 }),
      res({ unit_id: 'B', guests: 10 }),
      res({ unit_id: 'C', guests: 4 }),
      res({ unit_id: 'A', guests: 5, status: 'cancelled' }),
    ];
    const dias = ['2026-11-25', '2026-11-26'];
    const o = ocupacaoDias(reservas, tours, dias);
    expect(o.map((t) => t.tourId)).toEqual(['A', 'B', 'C']);
    expect(o[0]).toMatchObject({ nome: 'Mergulho' });
    expect(o[0].celulas[0]).toEqual({ data: '2026-11-25', pessoas: 12, capacidade: 16, pct: 75 });
    expect(o[0].celulas[1]).toEqual({ data: '2026-11-26', pessoas: 0, capacidade: 16, pct: 0 });
    expect(o[1].celulas[0].pct).toBe(100);
    expect(o[2].celulas[0]).toEqual({ data: '2026-11-25', pessoas: 4, capacidade: null, pct: null });
  });

  it('diasSeguintes_atravessa_o_mes', () => {
    expect(diasSeguintes('2026-11-29', 3)).toEqual(['2026-11-29', '2026-11-30', '2026-12-01']);
    expect(diasSeguintes('2026-02-27', 3)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
  });
});
