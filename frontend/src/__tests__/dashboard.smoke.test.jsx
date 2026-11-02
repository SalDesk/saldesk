import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from '../pages/Dashboard';
import useAuthStore from '../store/authStore';
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

async function renderDashboard(operator_type) {
  useAuthStore.setState({ operator: { name: 'Teste', operator_type } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return screen.findByText('Bem-vindo, Teste');
}

describe('Dashboard (fumo por tipo de operador)', () => {
  beforeEach(() => {
    servicosVazios();
  });

  it('activity mostra o titulo', async () => {
    expect(await renderDashboard('activity')).toBeInTheDocument();
  });

  it('hotel mostra o titulo', async () => {
    expect(await renderDashboard('hotel')).toBeInTheDocument();
  });

  it('rentacar mostra o titulo', async () => {
    expect(await renderDashboard('rentacar')).toBeInTheDocument();
  });

  it('restaurant mostra o titulo', async () => {
    expect(await renderDashboard('restaurant')).toBeInTheDocument();
  });

  it('tipo em falta usa o generico', async () => {
    expect(await renderDashboard(undefined)).toBeInTheDocument();
  });

  it('servicos a falhar nao partem', async () => {
    servicosAFalhar();
    expect(await renderDashboard('hotel')).toBeInTheDocument();
    /* deixa assentar os pedidos falhados */
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('Bem-vindo, Teste')).toBeInTheDocument();
  });
});
