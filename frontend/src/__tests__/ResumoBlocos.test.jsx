import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResumoView from '../pages/dashboard/ResumoView';
import CanaisDonut from '../components/dashboard/CanaisDonut';
import TopServicos from '../components/dashboard/TopServicos';
import QuemSaoClientes from '../components/dashboard/QuemSaoClientes';
import { Dica } from '../components/dashboard/GraficoReceita';
import useUiStore from '../store/uiStore';
import useAuthStore from '../store/authStore';
import { getResumo, getReceita, getUnidades, getCanais } from '../services/financeiroService';
import { listReservations } from '../services/reservationsService';
import { listUnits } from '../services/unitsService';
import { getReviewsStats } from '../services/analyticsService';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

vi.mock('../services/financeiroService', () => ({
  getResumo: vi.fn(), getReceita: vi.fn(), getUnidades: vi.fn(), getCanais: vi.fn(),
}));
vi.mock('../services/reservationsService', () => ({ listReservations: vi.fn() }));
vi.mock('../services/unitsService', () => ({ listUnits: vi.fn() }));
vi.mock('../services/analyticsService', () => ({ getReviewsStats: vi.fn() }));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const ZERO = { receita: 0, num_reservas: 0, valor_medio: 0, taxa_ocupacao: 0 };

const CANAIS = [
  { source: 'direct', num_reservas: 4, receita: 400 },
  { source: 'public', num_reservas: 2, receita: 200 },
  { source: 'booking_com', num_reservas: 4, receita: 300 },
];

beforeEach(() => {
  getResumo.mockReset().mockResolvedValue({ atual: ZERO, anterior: ZERO, variacao: ZERO });
  getReceita.mockReset().mockResolvedValue([]);
  getUnidades.mockReset().mockResolvedValue([]);
  getCanais.mockReset().mockResolvedValue([]);
  listReservations.mockReset().mockResolvedValue([]);
  listUnits.mockReset().mockResolvedValue([]);
  getReviewsStats.mockReset().mockResolvedValue(null);
  useUiStore.setState({ lang: 'pt' });
  useAuthStore.setState({ operator: { name: 'Zy Tours', operator_type: 'hotel' } });
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ operator: null });
  useUiStore.setState({ lang: 'pt' });
});

describe('CanaisDonut', () => {
  it('desenha o donut com os canais no aria-label, a legenda e as directas ao centro', () => {
    render(<CanaisDonut canais={CANAIS} estado="ok" />);
    const donut = screen.getByRole('img');
    expect(donut.getAttribute('aria-label')).toMatch(/^Origem das reservas: .*Directo 40%.*Booking\.com 40%.*Pag\. Pública 20%\. 60% directas\.$/);
    const legenda = screen.getByRole('list');
    expect(within(legenda).getByText('Directo')).toBeInTheDocument();
    expect(within(legenda).getByText('Booking.com')).toBeInTheDocument();
    expect(within(legenda).getByText('Pag. Pública')).toBeInTheDocument();
    expect(screen.getByTestId('resumo-canais-directas')).toHaveTextContent('60%');
    expect(screen.getByText('directas')).toBeInTheDocument();
  });

  it('sem canais mostra o estado vazio', () => {
    render(<CanaisDonut canais={[]} estado="ok" />);
    expect(screen.getByText('Sem reservas neste período')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('com mais de 5 origens agrupa as mais pequenas em Outros', () => {
    const muitos = ['direct', 'airbnb', 'viator', 'getyourguide', 'booking_com', 'manual'].map((source, i) => ({ source, num_reservas: 10 - i }));
    render(<CanaisDonut canais={muitos} estado="ok" />);
    const legenda = screen.getByRole('list');
    expect(within(legenda).getAllByRole('listitem')).toHaveLength(5);
    expect(within(legenda).getByText('Outros')).toBeInTheDocument();
  });
});

describe('TopServicos', () => {
  const unidades = ['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) => ({ id: n, name: `Servico ${n}`, num_reservas: i + 1, receita: 1000 - i * 100 }));

  it('mostra no maximo 5 linhas com o dinheiro no formato do painel e a primeira barra em areia', () => {
    render(<TopServicos servicos={unidades} estado="ok" />);
    expect(screen.getAllByTestId('resumo-top-linha')).toHaveLength(5);
    expect(screen.queryByText('Servico F')).not.toBeInTheDocument();
    expect(screen.getByText('€1000')).toBeInTheDocument();
    const barras = screen.getAllByTestId('resumo-top-barra');
    expect(barras[0].className).toContain('bg-sand-500');
    expect(barras[1].className).not.toContain('bg-sand-500');
    expect(screen.getByText('1 reserva')).toBeInTheDocument();
    expect(screen.getByText('2 reservas')).toBeInTheDocument();
  });

  it('em ingles o dinheiro usa o formato ingles', () => {
    useUiStore.setState({ lang: 'en' });
    render(<TopServicos servicos={[{ name: 'Tour', num_reservas: 3, receita: 12500 }]} estado="ok" />);
    expect(screen.getByText('€12,500')).toBeInTheDocument();
    expect(screen.getByText('3 bookings')).toBeInTheDocument();
  });

  it('sem nenhuma reserva mostra o estado vazio', () => {
    render(<TopServicos servicos={[{ name: 'Tour', num_reservas: 0, receita: 0 }]} estado="ok" />);
    expect(screen.getByText('Sem reservas neste período')).toBeInTheDocument();
  });

  it('sem vendas concluidas ordena por reservas e diz-o', () => {
    const lista = [
      { name: 'Tour A', num_reservas: 2, receita: 0 },
      { name: 'Tour B', num_reservas: 7, receita: 0 },
      { name: 'Tour C', num_reservas: 0, receita: 0 },
    ];
    render(<TopServicos servicos={lista} estado="ok" />);
    expect(screen.getByText('Ainda sem vendas concluídas neste período; ordenado por reservas.')).toBeInTheDocument();
    const linhas = screen.getAllByTestId('resumo-top-linha');
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent('Tour B');
    expect(linhas[0]).toHaveTextContent('7 reservas');
    expect(screen.getAllByTestId('resumo-top-barra')[0].style.width).toBe('100%');
  });

  it('com receita nao mostra a nota de ordenacao por reservas', () => {
    render(<TopServicos servicos={[{ name: 'Tour', num_reservas: 3, receita: 100 }]} estado="ok" />);
    expect(screen.queryByText(/ordenado por reservas/)).not.toBeInTheDocument();
  });
});

describe('QuemSaoClientes', () => {
  const reservas = { estado: 'ok', dados: [{ customer_country: 'gb' }, { customer_country: 'GB' }, { customer_country: 'PT' }] };
  const nota = { estado: 'ok', dados: { total: 126, average: 4.66 } };

  it('mostra a nota media e o numero de avaliacoes, sem taxa de repeticao', () => {
    render(<QuemSaoClientes avaliacao={nota} reservas={reservas} />);
    const cartao = screen.getByTestId('resumo-nota');
    expect(cartao).toHaveTextContent('4,7');
    expect(cartao).toHaveTextContent('Nota média (126 avaliações)');
    expect(screen.queryByText(/voltam a reservar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/repeat/i)).not.toBeInTheDocument();
  });

  it('esconde a nota sem avaliacoes ou se o pedido falhou', () => {
    const { rerender } = render(<QuemSaoClientes avaliacao={{ estado: 'ok', dados: { total: 0, average: null } }} reservas={reservas} />);
    expect(screen.queryByTestId('resumo-nota')).not.toBeInTheDocument();
    rerender(<QuemSaoClientes avaliacao={{ estado: 'erro' }} reservas={reservas} />);
    expect(screen.queryByTestId('resumo-nota')).not.toBeInTheDocument();
  });

  it('lista os paises com o nome na lingua do painel', () => {
    const { unmount } = render(<QuemSaoClientes avaliacao={nota} reservas={reservas} />);
    const linhas = screen.getAllByTestId('resumo-pais');
    expect(linhas[0]).toHaveTextContent('Reino Unido');
    expect(linhas[0]).toHaveTextContent('67%');
    expect(linhas[1]).toHaveTextContent('Portugal');
    unmount();
    useUiStore.setState({ lang: 'en' });
    render(<QuemSaoClientes avaliacao={nota} reservas={reservas} />);
    expect(screen.getAllByTestId('resumo-pais')[0]).toHaveTextContent('United Kingdom');
  });

  it('texto livre: Portugal, portugal e PT juntam-se; Lisboa fica como escrito', () => {
    const dados = [{ customer_country: 'Portugal' }, { customer_country: 'portugal' }, { customer_country: 'PT' }, { customer_country: 'Lisboa' }];
    render(<QuemSaoClientes avaliacao={nota} reservas={{ estado: 'ok', dados }} />);
    const linhas = screen.getAllByTestId('resumo-pais');
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent('Portugal');
    expect(linhas[0]).toHaveTextContent('75%');
    expect(linhas[1]).toHaveTextContent('Lisboa');
  });

  it('com 1000 reservas avisa que so conta as mais recentes', () => {
    const mil = Array.from({ length: 1000 }, () => ({ customer_country: 'PT' }));
    render(<QuemSaoClientes avaliacao={nota} reservas={{ estado: 'ok', dados: mil }} />);
    expect(screen.getByText(/Com base nas 1\s?000 reservas mais recentes do período/)).toBeInTheDocument();
    cleanup();
    render(<QuemSaoClientes avaliacao={nota} reservas={reservas} />);
    expect(screen.queryByText(/Com base nas/)).not.toBeInTheDocument();
  });
});

function renderResumo() {
  return render(<MemoryRouter future={FUTURE}><ResumoView /></MemoryRouter>);
}

describe('ResumoView: blocos de baixo', () => {
  it('um pedido a falhar nao tira os outros blocos', async () => {
    getCanais.mockRejectedValue(new Error('falha'));
    getUnidades.mockResolvedValue([{ name: 'Servico B', num_reservas: 9, receita: 900 }]);
    getReviewsStats.mockResolvedValue({ total: 10, average: 4.5 });
    listReservations.mockResolvedValue([{ customer_country: 'PT' }]);
    renderResumo();
    expect(await screen.findByText('Não foi possível carregar os canais.')).toBeInTheDocument();
    expect(await screen.findByText('Servico B')).toBeInTheDocument();
    expect(await screen.findByTestId('resumo-nota')).toBeInTheDocument();
    expect(await screen.findByText('Portugal')).toBeInTheDocument();
  });

  it('as reservas do periodo sao pedidas uma so vez, tambem nas actividades', async () => {
    useAuthStore.setState({ operator: { name: 'Zy', operator_type: 'activity' } });
    renderResumo();
    await waitFor(() => expect(listUnits).toHaveBeenCalled());
    await screen.findByText('Sem países nas reservas deste período');
    const intervalos = listReservations.mock.calls.map(([p]) => `${p.stay_from}|${p.stay_to}`);
    expect(intervalos).toHaveLength(2);
    expect(new Set(intervalos).size).toBe(2);
  });

  it('as reservas recentes ja nao existem no resumo', async () => {
    renderResumo();
    await screen.findByText('De onde vêm as reservas');
    expect(screen.queryByText('Reservas recentes')).not.toBeInTheDocument();
    expect(listReservations.mock.calls.some(([p]) => p.order_by === 'created_at')).toBe(false);
  });

  it('em ingles todo o resumo esta em ingles', async () => {
    useUiStore.setState({ lang: 'en' });
    getCanais.mockResolvedValue(CANAIS);
    getUnidades.mockResolvedValue([{ name: 'Tour X', num_reservas: 2, receita: 300 }]);
    getReviewsStats.mockResolvedValue({ total: 3, average: 4.2 });
    listReservations.mockResolvedValue([{ customer_country: 'gb' }]);
    renderResumo();
    expect(await screen.findByText('Where bookings come from')).toBeInTheDocument();
    expect(await screen.findByText('United Kingdom')).toBeInTheDocument();
    expect(await screen.findByText('Tour X')).toBeInTheDocument();
    expect(await screen.findByTestId('resumo-nota')).toBeInTheDocument();
    expect(portuguesNoEcra(['Tour X', 'Booking.com'])).toEqual([]);
    expect(chavesCruas(['dashboard'])).toEqual([]);
  });
});

describe('GraficoReceita: dinheiro no formato do painel', () => {
  afterEach(cleanup);

  it('a_dica_do_grafico_em_pt_nao_leva_separador_de_milhares', () => {
    useUiStore.setState({ lang: 'pt' });
    const series = [{ rotulo: '1 dez', actual: 12345, anterior: 1860 }];
    render(<Dica active payload={[{ payload: { x: 0 } }]} series={series} />);
    expect(screen.getByText('€12345')).toBeInTheDocument();
    expect(screen.getByText(/Período anterior: €1860/)).toBeInTheDocument();
  });

  it('em_ingles_leva_o_separador_da_lingua', () => {
    useUiStore.setState({ lang: 'en' });
    const series = [{ rotulo: 'Dec 1', actual: 12345, anterior: null }];
    render(<Dica active payload={[{ payload: { x: 0 } }]} series={series} />);
    expect(screen.getByText('€12,345')).toBeInTheDocument();
    useUiStore.setState({ lang: 'pt' });
  });
});
