import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
import { getResumo } from '../services/financeiroService';
import { getWeatherForecast } from '../services/weatherService';
import api from '../services/api';

vi.mock('../services/unitsService', () => ({ listUnits: vi.fn() }));
vi.mock('../services/reservationsService', () => ({ listReservations: vi.fn() }));
vi.mock('../services/financeiroService', () => ({ getResumo: vi.fn() }));
vi.mock('../services/weatherService', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, getWeatherForecast: vi.fn() };
});
vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => vi.fn(),
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

/* Datas escritas a mao (nao calculadas com o codigo em teste) */
const HOJE = '2026-12-01';
const AMANHA = '2026-12-02';
const SEMANA_FIM = '2026-12-07';
const MES_INICIO = '2026-12-01';
const MES_FIM = '2026-12-31';

const TOUR = { id: 't1', name: 'Tour Teste', capacity: 10, status: 'active', description: null };
const ZERO = { receita: 0, num_reservas: 0, valor_medio: 0, taxa_ocupacao: 0 };

function reserva(over) {
  return {
    id: 'r', unit_id: 't1', status: 'confirmed', guests: 1, check_in: HOJE,
    payment_status: 'paid', customer_name: 'Cliente', created_at: '2026-01-01T10:00:00Z',
    ...over,
  };
}

/* Os tres pedidos distinguem-se pelo par (from, to). No dia 1 o pedido da semana e o do mes
   partilham o `from`, so o `to` os separa. */
function carrega({ hoje = [], semana = [], mes = [], meteo = [] }) {
  listUnits.mockReset().mockResolvedValue([TOUR]);
  listReservations.mockReset().mockImplementation(async ({ from, to }) => {
    if (from === HOJE && to === HOJE) return hoje;
    if (from === HOJE && to === SEMANA_FIM) return semana;
    if (from === MES_INICIO && to === MES_FIM) return mes;
    throw new Error(`pedido inesperado ${from} ${to}`);
  });
  getResumo.mockReset().mockResolvedValue({ atual: ZERO, anterior: ZERO, variacao: ZERO });
  getWeatherForecast.mockReset().mockResolvedValue(meteo);
  api.get.mockReset().mockResolvedValue({ data: { data: null } });
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

  it('a faixa de 7 dias usa os dados da semana e nao os do mes', async () => {
    carrega({
      hoje: [reserva({ id: 'h1' })],
      semana: [reserva({ id: 'w1' }), reserva({ id: 'w2', check_in: AMANHA })],
      /* dados do mes diferentes: 3 por pagar hoje */
      mes: [1, 2, 3].map((n) => reserva({ id: `m${n}`, payment_status: 'pending' })),
    });
    renderActivity();
    expect(await screen.findByText('Próximos 7 dias')).toBeInTheDocument();
    expect(screen.getAllByText('1 res.')).toHaveLength(2);
    expect(screen.queryByText('3 res.')).not.toBeInTheDocument();
    /* os pagamentos por regularizar vem do mes */
    expect(screen.getByText('3 pagamento(s) por regularizar')).toBeInTheDocument();
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
