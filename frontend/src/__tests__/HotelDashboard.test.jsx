import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HotelDashboard from '../pages/dashboard/HotelDashboard';
import useUiStore from '../store/uiStore';
import { listUnits } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import { getResumo } from '../services/financeiroService';
import { getWeatherForecast } from '../services/weatherService';
import api from '../services/api';

/* Sem rede: todos os servicos usados pelo dashboard sao simulados */
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

/* Navegacao simulada */
const navigateMock = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

/* Datas locais calculadas aqui, sem reutilizar o codigo em teste */
const HOJE = new Date().toLocaleDateString('en-CA');
const MES_INICIO = HOJE.slice(0, 8) + '01';
const MES_FIM = (() => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + 1, 0).toLocaleDateString('en-CA');
})();

const ZERO = { receita: 0, num_reservas: 0, valor_medio: 0, taxa_ocupacao: 0 };
function resumo(atual = {}) {
  return {
    atual: { ...ZERO, ...atual },
    anterior: { ...ZERO },
    variacao: { ...ZERO },
  };
}

/* Unidade completa; sobrepoe-se o que interessa a cada teste */
function unidade(over) {
  return { id: 'u1', name: 'Quarto 101', unit_type: 'double', status: 'available', is_active: true, ...over };
}

/* Reserva completa; sobrepoe-se o que interessa a cada teste */
function reserva(over) {
  return {
    id: 'r', unit_id: 'u1', status: 'confirmed', guests: 2, check_in: HOJE,
    check_out: MES_FIM, customer_name: 'Cliente', ...over,
  };
}

/* Responde a cada pedido conforme o par (from, to): hoje ou mes */
function carregaServicos({ units = [unidade()], hoje = [], mes = [], res = resumo() } = {}) {
  listUnits.mockReset().mockResolvedValue(units);
  listReservations.mockReset().mockImplementation(async ({ from, to }) => {
    /* O dia 1 pode ser igual a hoje: so o par (from, to) separa os pedidos */
    if (from === HOJE && to === HOJE) return hoje;
    if (from === MES_INICIO && to === MES_FIM) return mes;
    throw new Error(`pedido inesperado ${from} ${to}`);
  });
  getResumo.mockReset().mockResolvedValue(res);
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

function renderHotel() {
  return render(
    <MemoryRouter future={FUTURE}>
      <HotelDashboard />
    </MemoryRouter>
  );
}

describe('HotelDashboard (Hoje)', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    navigateMock.mockReset();
    carregaServicos();
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    /* nenhum erro ou aviso no consolo durante o teste */
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('manutencao, sem confirmacao e limpeza aparecem no painel', async () => {
    carregaServicos({
      units: [
        unidade({ id: 'u1', name: 'Quarto 101', status: 'maintenance' }),
        unidade({ id: 'u2', name: 'Quarto 102', status: 'cleaning' }),
      ],
      hoje: [reserva({ id: 'p1', unit_id: 'u2', status: 'pending' })],
    });
    renderHotel();
    expect(await screen.findByText('1 unidade(s) em manutenção')).toBeInTheDocument();
    expect(screen.getByText('1 reserva(s) por confirmar')).toBeInTheDocument();
    expect(screen.getByText('1 limpeza(s) por fazer')).toBeInTheDocument();
    expect(screen.queryByText('Tudo em ordem')).not.toBeInTheDocument();
    /* cada linha abre o seu destino */
    fireEvent.click(screen.getByRole('button', { name: /1 reserva\(s\) por confirmar/ }));
    expect(navigateMock).toHaveBeenLastCalledWith('/reservas');
    fireEvent.click(screen.getByRole('button', { name: /1 limpeza\(s\) por fazer/ }));
    expect(navigateMock).toHaveBeenLastCalledWith('/housekeeping');
  });

  it('sem alertas mostra Tudo em ordem', async () => {
    renderHotel();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
    expect(screen.getByText('Requer atenção')).toBeInTheDocument();
    /* sem check-ins nem check-outs: estados vazios compactos */
    expect(screen.getByText('Nenhum check-in agendado para hoje')).toBeInTheDocument();
    expect(screen.getByText('Nenhum check-out agendado para hoje')).toBeInTheDocument();
  });

  it('o mapa continua a mostrar as unidades', async () => {
    renderHotel();
    expect(await screen.findByText('Quarto 101')).toBeInTheDocument();
    expect(screen.getByText('Mapa de Quartos — Hoje')).toBeInTheDocument();
  });

  it('mantem os cinco indicadores e os blocos de check-in e check-out', async () => {
    carregaServicos({
      hoje: [
        reserva({ id: 'c1', status: 'confirmed', customer_name: 'Ana Entrada' }),
        reserva({ id: 'c2', status: 'checked_in', check_in: '2020-01-01', check_out: HOJE, customer_name: 'Rui Saida' }),
      ],
      res: resumo({ receita: 500 }),
    });
    renderHotel();
    expect(await screen.findByText('Ana Entrada')).toBeInTheDocument();
    expect(screen.getByText('Rui Saida')).toBeInTheDocument();
    expect(screen.getByText('Ocupacao hoje')).toBeInTheDocument();
    expect(screen.getByText('Receita do mês')).toBeInTheDocument();
    expect(screen.getByText('€500')).toBeInTheDocument();
    expect(screen.getByText('Reservas pendentes')).toBeInTheDocument();
    expect(screen.getAllByText('Check-ins hoje').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Check-outs hoje').length).toBeGreaterThan(0);
  });

  it('servicos a falhar mostram estados vazios sem erro', async () => {
    servicosAFalhar();
    renderHotel();
    expect(await screen.findByText('Tudo em ordem')).toBeInTheDocument();
    expect(screen.getByText('Nenhum check-in agendado para hoje')).toBeInTheDocument();
    expect(screen.getByText('Sem unidades registadas.')).toBeInTheDocument();
    await waitFor(() => expect(listUnits).toHaveBeenCalled());
  });

  it('reservas sem campos nao rebentam', async () => {
    const vazia = { id: 'x', status: 'pending' };
    carregaServicos({ units: [{ id: 'u9', name: 'Quarto 9' }], hoje: [vazia], mes: [vazia] });
    renderHotel();
    expect(await screen.findByText('Quarto 9')).toBeInTheDocument();
    expect(screen.getByText('Tudo em ordem')).toBeInTheDocument();
  });
});
