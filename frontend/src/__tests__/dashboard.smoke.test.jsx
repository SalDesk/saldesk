import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
  });

  afterEach(() => {
    /* desmonta antes de repor as stores, para nao haver rerender fora de act */
    cleanup();
    useAuthStore.setState({ operator: null });
    useUiStore.setState({ lang: 'pt' });
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
});
