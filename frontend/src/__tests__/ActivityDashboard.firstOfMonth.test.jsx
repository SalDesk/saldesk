import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/* Relogio simulado ANTES de qualquer import: TODAY (shared.jsx) e calculado ao importar o
   modulo. So a Date e simulada, para os temporizadores do findBy continuarem reais. */
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 11, 1, 12, 0, 0)); /* 1 de Dezembro de 2026, hora local */
});

import ActivityDashboard from '../pages/dashboard/ActivityDashboard';
import useUiStore from '../store/uiStore';
import { listUnits } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import { getWeatherForecast } from '../services/weatherService';

vi.mock('../services/unitsService', () => ({ listUnits: vi.fn() }));
vi.mock('../services/reservationsService', () => ({ listReservations: vi.fn() }));
vi.mock('../services/assignmentService', () => ({ listAssignments: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/weatherService', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, getWeatherForecast: vi.fn() };
});
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => vi.fn(),
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

/* Datas escritas a mao (nao calculadas com o codigo em teste) */
const HOJE = '2026-12-01';
const AMANHA = '2026-12-02';
/* os proximos 14 dias: 1 a 14 de dezembro */
const SEMANA_FIM = '2026-12-14';
/* os 13 dias antes de hoje atravessam a mudanca de mes */
const ANTERIOR_INICIO = '2026-11-18';
const ONTEM = '2026-11-30';

const TOUR = { id: 't1', name: 'Tour Teste', capacity: 10, status: 'active', description: null };

function reserva(over) {
  return {
    id: 'r', unit_id: 't1', status: 'confirmed', guests: 1, check_in: HOJE,
    payment_status: 'paid', customer_name: 'Cliente', created_at: '2026-01-01T10:00:00Z',
    ...over,
  };
}

/* Os tres pedidos distinguem-se pelo par exato (stay_from, stay_to). No dia 1 os 13 dias
   anteriores estao no mes passado. Qualquer outra forma de argumentos (por exemplo from/to) lanca. */
function carrega({ hoje = [], semana = [], anterior = [], porPagar = [], meteo = [] }) {
  listUnits.mockReset().mockResolvedValue([TOUR]);
  listReservations.mockReset().mockImplementation(async (params) => {
    if (Object.keys(params || {}).join(',') === 'payment_status' && params.payment_status === 'pending,partial') return porPagar;
    if (Object.keys(params || {}).sort().join(',') !== 'stay_from,stay_to') {
      throw new Error(`pedido inesperado ${JSON.stringify(params)}`);
    }
    const { stay_from: de, stay_to: ate } = params;
    if (de === HOJE && ate === HOJE) return hoje;
    if (de === HOJE && ate === SEMANA_FIM) return semana;
    if (de === ANTERIOR_INICIO && ate === ONTEM) return anterior;
    throw new Error(`pedido inesperado ${de} ${ate}`);
  });
  getWeatherForecast.mockReset().mockResolvedValue(meteo);
}

function renderActivity() {
  return render(
    <MemoryRouter future={FUTURE}>
      <ActivityDashboard />
    </MemoryRouter>
  );
}

describe('ActivityDashboard no primeiro dia do mes', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('o relogio simulado e o dia 1', () => {
    expect(new Date().toLocaleDateString('en-CA')).toBe(HOJE);
  });

  it('o mapa de ocupacao usa os dados da semana e nao os dos dias anteriores', async () => {
    carrega({
      hoje: [reserva({ id: 'h1' })],
      semana: [reserva({ id: 'w1' }), reserva({ id: 'w2', check_in: AMANHA })],
      /* dados dos dias anteriores diferentes: 3 reservas ontem */
      anterior: [1, 2, 3].map((n) => reserva({ id: `m${n}`, check_in: ONTEM })),
      porPagar: [1, 2, 3].map((n) => reserva({ id: `m${n}`, payment_status: 'pending' })),
    });
    renderActivity();
    expect(await screen.findByText('Próximos 7 dias')).toBeInTheDocument();
    /* capacidade 10: 1 pessoa hoje (w1) e 1 amanha (w2) = duas celulas de 10%; as 3 de ontem nao entram */
    const mapa = screen.getByRole('table');
    expect(within(mapa).getAllByText('10%')).toHaveLength(2);
    expect(within(mapa).queryByText('30%')).not.toBeInTheDocument();
    /* os pagamentos por regularizar vem do pedido proprio (qualquer mes) */
    expect(screen.getByText('3 pagamento(s) por regularizar')).toBeInTheDocument();
  });

  it('os pedidos usam stay_from e stay_to', async () => {
    carrega({});
    renderActivity();
    expect(await screen.findByText('Próximos 7 dias')).toBeInTheDocument();
    const pedidos = listReservations.mock.calls.map(([params]) => params);
    expect(pedidos).toHaveLength(4);
    pedidos.forEach((p) => {
      expect(p).not.toHaveProperty('from');
      expect(p).not.toHaveProperty('to');
    });
    /* no dia 1, os 13 dias anteriores caem no mes passado */
    expect(pedidos).toEqual(expect.arrayContaining([
      { stay_from: HOJE, stay_to: HOJE },
      { stay_from: ANTERIOR_INICIO, stay_to: ONTEM },
      { stay_from: HOJE, stay_to: SEMANA_FIM },
    ]));
  });

  it('o aviso de mau tempo cruza com as reservas da semana', async () => {
    carrega({
      semana: [reserva({ id: 'w1', check_in: AMANHA })],
      meteo: [{ date: AMANHA, code: 95, precipitation: 12 }],
    });
    renderActivity();
    expect(await screen.findByText('1 tour(s) afectado(s) pela meteorologia')).toBeInTheDocument();
  });
});
