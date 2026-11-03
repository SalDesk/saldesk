import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from '../pages/Dashboard';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';
import { listUnits } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import { getResumo } from '../services/financeiroService';
import { getWeatherForecast } from '../services/weatherService';
import api from '../services/api';

/* Sem rede: todos os servicos usados pelos dashboards sao simulados */
vi.mock('../services/unitsService', () => ({
  listUnits: vi.fn(),
}));
vi.mock('../services/reservationsService', () => ({
  listReservations: vi.fn(),
}));
vi.mock('../services/financeiroService', () => ({
  getResumo: vi.fn(),
  getReceita: vi.fn().mockResolvedValue([]),
  getUnidades: vi.fn().mockResolvedValue([]),
}));
vi.mock('../services/weatherService', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, getWeatherForecast: vi.fn() };
});
vi.mock('../services/api', () => ({
  default: { get: vi.fn() },
}));
vi.mock('../components/messaging/WhatsAppPendentes', () => ({
  default: () => <div data-testid="whatsapp-pendentes" />,
}));

/* Navegacao simulada, para verificar as acoes do cabecalho */
const navigateMock = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
}));

const RESUMO_VAZIO = {
  atual:    { receita: 0, num_reservas: 0, valor_medio: 0, taxa_ocupacao: 0 },
  anterior: { receita: 0, num_reservas: 0, valor_medio: 0, taxa_ocupacao: 0 },
  variacao: { receita: 0, num_reservas: 0, valor_medio: 0, taxa_ocupacao: 0 },
};

function servicosVazios() {
  listUnits.mockReset().mockResolvedValue([]);
  listReservations.mockReset().mockResolvedValue([]);
  getResumo.mockReset().mockResolvedValue(RESUMO_VAZIO);
  getWeatherForecast.mockReset().mockResolvedValue([]);
  api.get.mockReset().mockResolvedValue({ data: { data: null } });
}

function servicosAFalhar() {
  const erro = new Error('falha de rede');
  listUnits.mockReset().mockRejectedValue(erro);
  listReservations.mockReset().mockRejectedValue(erro);
  getResumo.mockReset().mockRejectedValue(erro);
  getWeatherForecast.mockReset().mockRejectedValue(erro);
  api.get.mockReset().mockRejectedValue(erro);
}

/* Texto que so o componente de cada tipo renderiza (pt, existente no codigo original) */
const TEXTO_ACTIVITY   = 'Top tours do mes';
const TEXTO_HOTEL      = 'Check-outs hoje';
const TEXTO_RENTACAR   = 'Levantamentos hoje';
const TEXTO_RESTAURANT = 'Covers do mes';
const TEXTO_GENERICO   = 'Accoes Rapidas';
const TODOS = [TEXTO_ACTIVITY, TEXTO_HOTEL, TEXTO_RENTACAR, TEXTO_RESTAURANT, TEXTO_GENERICO];

function renderDashboard(operator_type) {
  useAuthStore.setState({ operator: { name: 'Teste', operator_type } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/* Espera o texto do tipo certo e confirma que nenhum dos outros aparece */
async function esperaSoTipo(texto) {
  expect(await screen.findByText('Bem-vindo, Teste')).toBeInTheDocument();
  expect((await screen.findAllByText(texto)).length).toBeGreaterThan(0);
  TODOS.filter((outro) => outro !== texto).forEach((outro) => {
    expect(screen.queryByText(outro)).not.toBeInTheDocument();
  });
}

describe('Dashboard (fumo por tipo de operador)', () => {
  beforeEach(() => {
    servicosVazios();
    navigateMock.mockReset();
  });

  afterEach(() => {
    /* desmonta antes de repor as stores, para nao haver rerender fora de act */
    cleanup();
    useAuthStore.setState({ operator: null });
    useUiStore.setState({ lang: 'pt', dashboardView: 'hoje' });
  });

  it('activity mostra o dashboard de actividades', async () => {
    renderDashboard('activity');
    await esperaSoTipo(TEXTO_ACTIVITY);
  });

  it('hotel mostra o dashboard de hotel', async () => {
    renderDashboard('hotel');
    await esperaSoTipo(TEXTO_HOTEL);
  });

  it('rentacar mostra o dashboard de rent-a-car', async () => {
    renderDashboard('rentacar');
    await esperaSoTipo(TEXTO_RENTACAR);
  });

  it('restaurant mostra o dashboard de restaurante', async () => {
    renderDashboard('restaurant');
    await esperaSoTipo(TEXTO_RESTAURANT);
  });

  it('tipo em falta usa o generico', async () => {
    renderDashboard(undefined);
    await esperaSoTipo(TEXTO_GENERICO);
  });

  it('servicos a falhar nao partem', async () => {
    servicosAFalhar();
    renderDashboard('hotel');
    await esperaSoTipo(TEXTO_HOTEL);
    /* os pedidos rejeitados ja foram feitos e o componente continua a mostrar o seu texto */
    await waitFor(() => expect(listUnits).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByText(TEXTO_HOTEL).length).toBeGreaterThan(0));
  });

  it('interruptor mostra hoje por omissao', async () => {
    renderDashboard('hotel');
    await esperaSoTipo(TEXTO_HOTEL);
    expect(screen.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Resumo' })).toHaveAttribute('aria-selected', 'false');
  });

  it('trocar para resumo', async () => {
    renderDashboard('hotel');
    await esperaSoTipo(TEXTO_HOTEL);
    fireEvent.click(screen.getByRole('tab', { name: 'Resumo' }));
    expect(useUiStore.getState().dashboardView).toBe('resumo');
    expect(screen.getByRole('tab', { name: 'Resumo' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText(TEXTO_HOTEL)).not.toBeInTheDocument();
    /* o cabecalho e a lista de WhatsApp pendentes continuam montados */
    expect(screen.getByText('Bem-vindo, Teste')).toBeInTheDocument();
    expect(screen.getByTestId('whatsapp-pendentes')).toBeInTheDocument();
  });

  it('volta a hoje', async () => {
    renderDashboard('hotel');
    await esperaSoTipo(TEXTO_HOTEL);
    fireEvent.click(screen.getByRole('tab', { name: 'Resumo' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Hoje' }));
    expect(useUiStore.getState().dashboardView).toBe('hoje');
    expect(screen.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    expect((await screen.findAllByText(TEXTO_HOTEL)).length).toBeGreaterThan(0);
  });

  it('as acoes do cabecalho navegam', async () => {
    renderDashboard('hotel');
    await esperaSoTipo(TEXTO_HOTEL);
    fireEvent.click(screen.getByRole('button', { name: 'Nova reserva' }));
    expect(navigateMock).toHaveBeenLastCalledWith('/reservas');
    fireEvent.click(screen.getByRole('button', { name: 'Ver calendario' }));
    expect(navigateMock).toHaveBeenLastCalledWith('/calendario');
  });
});
