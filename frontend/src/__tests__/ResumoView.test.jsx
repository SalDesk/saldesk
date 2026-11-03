import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResumoView from '../pages/dashboard/ResumoView';
import useUiStore from '../store/uiStore';
import { getResumo, getReceita, getUnidades } from '../services/financeiroService';
import { listReservations } from '../services/reservationsService';

/* Sem rede: todos os servicos usados pela vista sao simulados */
vi.mock('../services/financeiroService', () => ({
  getResumo: vi.fn(),
  getReceita: vi.fn(),
  getUnidades: vi.fn(),
}));
vi.mock('../services/reservationsService', () => ({
  listReservations: vi.fn(),
}));
/* O grafico nao interessa aqui (ResponsiveContainer nao mede nada no jsdom) */
vi.mock('../components/financial/RevenueChart', () => ({
  default: ({ data }) => <div data-testid="grafico" data-pontos={(data || []).length} />,
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

const ZERO = { receita: 0, num_reservas: 0, valor_medio: 0, taxa_ocupacao: 0 };

function resumo(over = {}) {
  return {
    atual:    { ...ZERO, ...(over.atual || {}) },
    anterior: { ...ZERO, ...(over.anterior || {}) },
    variacao: { ...ZERO, ...(over.variacao || {}) },
  };
}

function servicosVazios() {
  getResumo.mockReset().mockResolvedValue(resumo());
  getReceita.mockReset().mockResolvedValue([]);
  getUnidades.mockReset().mockResolvedValue([]);
  listReservations.mockReset().mockResolvedValue([]);
}

function renderResumo() {
  return render(
    <MemoryRouter future={FUTURE}>
      <ResumoView />
    </MemoryRouter>
  );
}

/* Datas locais, calculadas aqui sem reutilizar o codigo em teste */
function dois(n) { return String(n).padStart(2, '0'); }
function primeiroEUltimoDoMes() {
  const n = new Date();
  const y = n.getFullYear(), m = n.getMonth();
  return {
    inicio: `${y}-${dois(m + 1)}-01`,
    fim: `${y}-${dois(m + 1)}-${dois(new Date(y, m + 1, 0).getDate())}`,
  };
}

beforeEach(() => {
  servicosVazios();
  useUiStore.setState({ lang: 'pt' });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ResumoView', () => {
  it('pede os dados do mes', async () => {
    renderResumo();
    const { inicio, fim } = primeiroEUltimoDoMes();
    await waitFor(() => expect(getResumo).toHaveBeenCalledWith(inicio, fim));
    expect(getUnidades).toHaveBeenCalledWith(inicio, fim);
    expect(listReservations).toHaveBeenCalledWith({ from: inicio, to: fim });
    /* grafico: ultimos 30 dias, por dia, a acabar hoje */
    await waitFor(() => expect(getReceita).toHaveBeenCalled());
    const [ini30, fim30, gran] = getReceita.mock.calls[0];
    expect(gran).toBe('day');
    const hoje = new Date();
    const esperadoFim = `${hoje.getFullYear()}-${dois(hoje.getMonth() + 1)}-${dois(hoje.getDate())}`;
    expect(fim30).toBe(esperadoFim);
    const dias = Math.round((new Date(`${fim30}T00:00:00`) - new Date(`${ini30}T00:00:00`)) / 86400000);
    expect(dias).toBe(29);
    await screen.findByText('Receita do mês');
  });

  it('mostra receita e variacao', async () => {
    getResumo.mockResolvedValue(resumo({
      atual:    { receita: 1200, num_reservas: 14, valor_medio: 90, taxa_ocupacao: 62.5 },
      anterior: { receita: 1000, num_reservas: 10, valor_medio: 100, taxa_ocupacao: 50 },
      variacao: { receita: 20, num_reservas: 4, valor_medio: -10, taxa_ocupacao: 12.5 },
    }));
    renderResumo();
    expect(await screen.findByText(/^€1\s?200$/)).toBeInTheDocument();
    /* receita: diferenca absoluta em euros */
    expect(screen.getByText('+€200')).toBeInTheDocument();
    /* reservas: diferenca absoluta */
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('+4')).toBeInTheDocument();
    /* valor medio: diferenca absoluta em euros (90 - 100) */
    expect(screen.getByText('€90')).toBeInTheDocument();
    /* KpiCard formata o euro negativo com o sinal antes do simbolo */
    expect(screen.getByText('-€10')).toBeInTheDocument();
    /* ocupacao: pontos percentuais */
    expect(screen.getByText('62.5%')).toBeInTheDocument();
    expect(screen.getByText('+12.5 p.p.')).toBeInTheDocument();
    expect(screen.getAllByText('face ao mês anterior').length).toBe(4);
  });

  it('mostra servicos mais vendidos', async () => {
    getUnidades.mockResolvedValue([
      { name: 'Servico A', unit_type: 'tour', num_reservas: 2, receita: 100 },
      { name: 'Servico B', unit_type: 'tour', num_reservas: 9, receita: 900 },
      { name: 'Servico C', unit_type: 'tour', num_reservas: 3, receita: 300 },
      { name: 'Servico D', unit_type: 'tour', num_reservas: 5, receita: 500 },
      { name: 'Servico E', unit_type: 'tour', num_reservas: 4, receita: 400 },
      { name: 'Servico F', unit_type: 'tour', num_reservas: 1, receita: 50 },
    ]);
    renderResumo();
    const titulo = await screen.findByText('Serviços mais vendidos');
    const bloco = titulo.closest('section');
    await within(bloco).findByText('Servico B');
    const nomes = within(bloco).getAllByText(/^Servico /).map((el) => el.textContent);
    expect(nomes).toEqual(['Servico B', 'Servico D', 'Servico E', 'Servico C', 'Servico A']);
    expect(within(bloco).queryByText('Servico F')).not.toBeInTheDocument();
  });

  it('os blocos usam o mesmo aspeto dos cartoes do Hoje', async () => {
    getUnidades.mockResolvedValue([
      { name: 'Servico A', unit_type: 'tour', num_reservas: 2, receita: 100 },
    ]);
    renderResumo();
    const titulo = await screen.findByText('Serviços mais vendidos');
    const bloco = titulo.closest('section');
    /* cantos de 8px, contorno e titulo n-900, como o painel de atencao */
    expect(bloco.className).toContain('rounded-sm');
    expect(bloco.className).toContain('border-n-200');
    expect(bloco.className).not.toContain('rounded-lg');
    expect(bloco.className).not.toContain('shadow-sm');
    expect(titulo.className).toContain('text-n-900');
    /* o primeiro lugar usa uma cor que existe na paleta */
    await within(bloco).findByText('Servico A');
    expect(within(bloco).getByText('1').className).not.toContain('sand-700');
    expect(within(bloco).getByText('1').className).toContain('text-sand-600');
  });

  it('mostra as reservas mais recentes', async () => {
    listReservations.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({
        id: `r${i}`,
        created_at: `2026-11-0${i + 1}T10:00:00Z`,
        status: 'confirmed',
        customer_name: `Cliente ${i + 1}`,
        check_in: '2026-11-10',
        guests: 2,
        units: { name: 'Tour X' },
      })),
    );
    renderResumo();
    const titulo = await screen.findByText('Reservas recentes');
    const bloco = titulo.closest('section');
    await within(bloco).findByText(/Cliente 7/);
    expect(within(bloco).getAllByText(/Cliente \d/).length).toBe(5);
    expect(within(bloco).queryByText(/Cliente 2 /)).not.toBeInTheDocument();
  });

  it('estado vazio', async () => {
    renderResumo();
    expect(await screen.findByText('Sem receita nos últimos 30 dias')).toBeInTheDocument();
    expect(screen.getByText('Sem vendas este mês')).toBeInTheDocument();
    expect(screen.getByText('Sem reservas este mes')).toBeInTheDocument();
    expect(screen.queryByTestId('grafico')).not.toBeInTheDocument();
    /* os quatro KPIs aparecem a zero */
    expect(screen.getByText('Receita do mês')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('mostra o grafico quando ha receita', async () => {
    getReceita.mockResolvedValue([{ periodo: '2026-11-01', receita: 100, num_reservas: 2 }]);
    renderResumo();
    const grafico = await screen.findByTestId('grafico');
    expect(grafico).toHaveAttribute('data-pontos', '1');
  });

  it('servicos a falhar', async () => {
    const erro = new Error('falha de rede');
    getResumo.mockRejectedValue(erro);
    getReceita.mockRejectedValue(erro);
    getUnidades.mockRejectedValue(erro);
    listReservations.mockRejectedValue(erro);
    const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderResumo();
    expect(await screen.findByText('Sem vendas este mês')).toBeInTheDocument();
    expect(screen.getByText('Sem receita nos últimos 30 dias')).toBeInTheDocument();
    expect(screen.getByText('Receita do mês')).toBeInTheDocument();
    expect(consoleErro).not.toHaveBeenCalled();
  });
});
