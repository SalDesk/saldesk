import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { recarregarPagina } from '../utils/recarregar';

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
vi.mock('../utils/recarregar', () => ({ recarregarPagina: vi.fn() }));
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
const TEXTO_ACTIVITY   = 'Ocupação do mês';
const TEXTO_HOTEL      = 'Mapa de Quartos — Hoje';
const TEXTO_RENTACAR   = 'Frota — Estado Actual';
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

/* Igual a renderDashboard, mas mantem o operador ja definido no teste */
function renderDashboardSemReset() {
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
  expect(await screen.findByText(/^(Bom dia|Boa tarde|Boa noite), Teste$/)).toBeInTheDocument();
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
    expect(screen.getByText(/^(Bom dia|Boa tarde|Boa noite), Teste$/)).toBeInTheDocument();
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

  it('activity: as acoes do cabecalho navegam e a nova reserva e unica', async () => {
    /* com um tour hoje nao ha estado vazio, logo so o cabecalho tem "Nova reserva" */
    const hoje = new Date().toLocaleDateString('en-CA');
    listUnits.mockResolvedValue([{ id: 't1', name: 'Tour Teste', capacity: 10, status: 'active' }]);
    listReservations.mockImplementation(async ({ stay_from, stay_to }) => (
      stay_from === hoje && stay_to === hoje
        ? [{ id: 'r1', unit_id: 't1', status: 'confirmed', guests: 2, check_in: hoje }]
        : []
    ));
    renderDashboard('activity');
    await esperaSoTipo(TEXTO_ACTIVITY);
    fireEvent.click(screen.getByRole('button', { name: 'Nova reserva' }));
    expect(navigateMock).toHaveBeenLastCalledWith('/reservas');
    fireEvent.click(screen.getByRole('button', { name: 'Ver calendario' }));
    expect(navigateMock).toHaveBeenLastCalledWith('/calendario');
  });
});

describe('Dashboard: cabecalho com saudacao, data e hora', () => {
  beforeEach(() => {
    servicosVazios();
    navigateMock.mockReset();
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useAuthStore.setState({ operator: null });
    useUiStore.setState({ lang: 'pt', dashboardView: 'hoje' });
  });

  function dataEsperada(data, locale) {
    const txt = data.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }

  it('cabecalho_saudacao_e_data_com_hora', async () => {
    const agora = new Date(2026, 10, 20, 11, 42);
    vi.setSystemTime(agora);
    useAuthStore.setState({ operator: { name: 'Zy Tours', operator_type: 'hotel' } });
    renderDashboardSemReset();
    expect(await screen.findByRole('heading', { name: 'Bom dia, Zy Tours' })).toBeInTheDocument();
    expect(screen.getByText(`${dataEsperada(agora, 'pt-PT')} · 11:42`)).toBeInTheDocument();
  });

  it('boa_tarde_as_15h', async () => {
    vi.setSystemTime(new Date(2026, 10, 20, 15, 5));
    useAuthStore.setState({ operator: { name: 'Zy Tours', operator_type: 'activity' } });
    renderDashboardSemReset();
    expect(await screen.findByRole('heading', { name: 'Boa tarde, Zy Tours' })).toBeInTheDocument();
    expect(screen.getByText(/ · 15:05$/)).toBeInTheDocument();
  });

  it('em_ingles', async () => {
    const agora = new Date(2026, 10, 20, 9, 7);
    vi.setSystemTime(agora);
    useUiStore.setState({ lang: 'en' });
    useAuthStore.setState({ operator: { name: 'Zy Tours', operator_type: 'restaurant' } });
    renderDashboardSemReset();
    expect(await screen.findByRole('heading', { name: 'Good morning, Zy Tours' })).toBeInTheDocument();
    expect(screen.getByText(`${dataEsperada(agora, 'en-GB')} · 09:07`)).toBeInTheDocument();
  });

  it('o_mesmo_cabecalho_na_vista_resumo', async () => {
    vi.setSystemTime(new Date(2026, 10, 20, 20, 30));
    useUiStore.setState({ dashboardView: 'resumo' });
    useAuthStore.setState({ operator: { name: 'Zy Tours', operator_type: 'activity' } });
    renderDashboardSemReset();
    expect(await screen.findByRole('heading', { name: 'Boa noite, Zy Tours' })).toBeInTheDocument();
  });
});

describe('Dashboard: virar o dia com o ecra aberto', () => {
  beforeEach(() => {
    servicosVazios();
    recarregarPagina.mockReset();
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useAuthStore.setState({ operator: null });
    useUiStore.setState({ lang: 'pt', dashboardView: 'hoje' });
  });

  it('recarrega_a_pagina_quando_passa_a_meia_noite', async () => {
    /* TODAY (shared.jsx) e calculado ao importar, com o relogio real: usar o dia de hoje */
    const h = new Date();
    vi.setSystemTime(new Date(h.getFullYear(), h.getMonth(), h.getDate(), 23, 59, 30));
    useAuthStore.setState({ operator: { name: 'Zy Tours', operator_type: 'activity' } });
    renderDashboardSemReset();
    await screen.findByRole('heading', { name: 'Boa noite, Zy Tours' });
    act(() => { vi.advanceTimersByTime(60 * 1000); });
    expect(recarregarPagina).toHaveBeenCalledTimes(1);
  });

  it('no_mesmo_dia_nao_recarrega', async () => {
    const h = new Date();
    vi.setSystemTime(new Date(h.getFullYear(), h.getMonth(), h.getDate(), 10, 0, 0));
    useAuthStore.setState({ operator: { name: 'Zy Tours', operator_type: 'activity' } });
    renderDashboardSemReset();
    await screen.findByRole('heading', { name: 'Bom dia, Zy Tours' });
    act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });
    expect(recarregarPagina).not.toHaveBeenCalled();
  });
});
