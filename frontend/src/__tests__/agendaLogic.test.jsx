/* Logica pura da agenda do dia do dashboard (eventos de atividades, estados, ordenacao). */
import { describe, expect, it } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import {
  paraMinutos, eventosAtividades, estadoDoEvento, ordenarAgenda,
  serieReceitaAcumulada, variacaoPercentual, valorMedio, porReceber, saudacao,
} from '../pages/dashboard/agendaLogic';
import useAgora from '../hooks/useAgora';

const TOUR = { id: 't1', name: 'Buggy', capacity: 16, description: JSON.stringify({ start_time: '09:00', duration: 2, meeting_point: 'Santa Maria' }) };
const SLOTS = { id: 't2', name: 'Mergulho', capacity: 20, description: JSON.stringify({ duration: 1.5, time_slots: [{ time: '09:00', capacity: 8 }, { time: '15:00', capacity: '6' }] }) };
const SEM = { id: 't3', name: 'Kite', capacity: 6, description: null };
let seq = 0;
const r = (o) => ({ id: 'r' + (seq += 1), unit_id: 't1', status: 'confirmed', guests: 2, customer_name: 'Ana Silva', start_time: null, ...o });

describe('agendaLogic: eventos de atividades', () => {
  it('paraMinutos aceita HH:MM e HH:MM:SS e recusa lixo', () => {
    expect(paraMinutos('14:00')).toBe(840);
    expect(paraMinutos('14:00:00')).toBe(840);
    [null, undefined, '', 'abc', '25:99'].forEach((v) => expect(paraMinutos(v)).toBeNull());
  });

  it('agrupa_por_tour_e_usa_a_hora_e_a_duracao_da_ficha', () => {
    const [e] = eventosAtividades({ reservas: [r({}), r({ guests: 3, status: 'pending' })], tours: [TOUR], atribuicoes: [] });
    expect(e).toMatchObject({ id: 't1|09:00', inicio: '09:00', inicioMin: 540, fimMin: 660, titulo: 'Buggy', local: 'Santa Maria', pessoas: 5, capacidade: 16, pendentes: 1 });
  });

  it('tour_com_horarios_da_um_evento_por_horario_com_a_capacidade_do_horario', () => {
    const ev = eventosAtividades({ reservas: [r({ unit_id: 't2', start_time: '09:00:00' }), r({ unit_id: 't2', start_time: '15:00:00' })], tours: [SLOTS], atribuicoes: [] });
    expect(ev.map((e) => [e.inicio, e.capacidade, e.fimMin - e.inicioMin])).toEqual([['09:00', 8, 90], ['15:00', 6, 90]]);
  });

  it('hora_com_segundos_e_a_mesma_hora', () => {
    const ev = eventosAtividades({ reservas: [r({ start_time: '09:00:00' }), r({ start_time: null })], tours: [TOUR], atribuicoes: [] });
    expect(ev).toHaveLength(1);
  });

  it('sem_hora_vai_para_o_grupo_sem_hora', () => {
    const ev = eventosAtividades({ reservas: [r({ unit_id: 't3' })], tours: [SEM], atribuicoes: [] });
    expect(ev[0]).toMatchObject({ inicio: null, inicioMin: null, fimMin: null, capacidade: 6 });
    expect(ordenarAgenda(ev).semHora).toHaveLength(1);
    expect(estadoDoEvento(ev[0], 600)).toBe('sem_hora');
  });

  it('so_estados_ativos_entram', () => {
    const ev = eventosAtividades({ reservas: ['cancelled', 'checked_out', 'no_show'].map((s) => r({ status: s })), tours: [TOUR], atribuicoes: [] });
    expect(ev).toEqual([]);
  });

  it('guias_distintos_e_sem_atribuicoes_canceladas', () => {
    const a = r({ id: 'ra' });
    const b = r({ id: 'rb' });
    const atr = [
      { reservation_id: 'ra', status: 'confirmed', staff: { name: 'Djo' } },
      { reservation_id: 'rb', status: 'confirmed', staff: { name: 'Djo' } },
      { reservation_id: 'rb', status: 'cancelled', staff: { name: 'Kiko' } },
    ];
    expect(eventosAtividades({ reservas: [a, b], tours: [TOUR], atribuicoes: atr })[0].guias).toEqual(['Djo']);
  });

  it('clientes_pela_ordem_das_reservas', () => {
    const ev = eventosAtividades({ reservas: [r({ customer_name: 'Ana Silva' }), r({ customer_name: 'Rui Costa' })], tours: [TOUR], atribuicoes: [] });
    expect(ev[0].clientes).toEqual(['Ana Silva', 'Rui Costa']);
  });

  it('estado_pela_hora', () => {
    const [e] = eventosAtividades({ reservas: [r({})], tours: [TOUR], atribuicoes: [] }); // 09:00-11:00
    expect([estadoDoEvento(e, 500), estadoDoEvento(e, 540), estadoDoEvento(e, 659), estadoDoEvento(e, 660)])
      .toEqual(['a_seguir', 'a_decorrer', 'a_decorrer', 'concluido']);
  });

  it('sem_duracao_conta_60_minutos', () => {
    const t = { ...TOUR, description: JSON.stringify({ start_time: '10:00' }) };
    expect(eventosAtividades({ reservas: [r({})], tours: [t], atribuicoes: [] })[0].fimMin).toBe(660);
  });

  it('fim_depois_da_meia_noite', () => {
    const t = { ...TOUR, description: JSON.stringify({ start_time: '23:00', duration: 3 }) };
    const [e] = eventosAtividades({ reservas: [r({})], tours: [t], atribuicoes: [] });
    expect(estadoDoEvento(e, 1439)).toBe('a_decorrer');
  });

  it('ordena_por_hora_e_depois_por_nome', () => {
    const t4 = { ...TOUR, id: 't4', name: 'Alfa' };
    const ev = eventosAtividades({ reservas: [r({}), r({ unit_id: 't4' }), r({ unit_id: 't2', start_time: '15:00' })], tours: [TOUR, t4, SLOTS], atribuicoes: [] });
    expect(ordenarAgenda(ev).comHora.map((e) => e.titulo)).toEqual(['Alfa', 'Buggy', 'Mergulho']);
  });

  it('reserva_de_tour_desconhecido_e_ficha_com_json_invalido_nao_rebentam', () => {
    const t = { ...SEM, description: '{nao e json' };
    expect(eventosAtividades({ reservas: [r({ unit_id: 'x' }), r({ unit_id: 't3' })], tours: [t], atribuicoes: undefined })).toHaveLength(1);
  });
});

describe('agendaLogic: metricas', () => {
  it('serie_acumulada_por_dia', () => {
    expect(serieReceitaAcumulada([{ periodo: '2026-11-02', receita: 100 }, { periodo: '2026-11-04', receita: 50 }, { periodo: '2026-10-31', receita: 999 }], '2026-11-01', '2026-11-05'))
      .toEqual([0, 100, 100, 150, 150]);
  });

  it('serie_sem_dados_da_zeros', () => {
    expect(serieReceitaAcumulada(undefined, '2026-11-01', '2026-11-03')).toEqual([0, 0, 0]);
  });

  it('variacao_percentual', () => {
    expect(variacaoPercentual(1120, 1000)).toBe(12);
    expect(variacaoPercentual(500, 0)).toBeNull();
    expect(variacaoPercentual(NaN, 10)).toBeNull();
  });

  it('valor_medio_e_por_receber', () => {
    expect(valorMedio(920, 20)).toBe(46);
    expect(valorMedio(920, 0)).toBeNull();
    expect(porReceber([{ total_price: 200, amount_paid: 20 }, { total_price: 50 }, { total_price: 10, amount_paid: 30 }])).toBe(230);
  });

  it('saudacao_pela_hora', () => {
    expect([4, 5, 11, 12, 18, 19].map(saudacao)).toEqual(['evening', 'morning', 'morning', 'afternoon', 'afternoon', 'evening']);
  });
});

describe('useAgora', () => {
  afterEach(() => { vi.useRealTimers(); });

  function Relogio() {
    const agora = useAgora();
    return <p>{agora.getMinutes()}</p>;
  }

  it('atualiza_a_cada_minuto_e_limpa_ao_desmontar', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 20, 11, 42, 0));
    const { unmount } = render(<Relogio />);
    expect(screen.getByText('42')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(60 * 1000); });
    expect(screen.getByText('43')).toBeInTheDocument();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
