import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RevenueChart from '../components/financial/RevenueChart';
import ServiceBarChart from '../components/financial/ServiceBarChart';
import ChannelChart from '../components/financial/ChannelChart';
import DespesasTab from '../pages/financial/DespesasTab';
import Demand from '../pages/Demand';
import { listExpenses } from '../services/expensesService';
import { getReceita } from '../services/financeiroService';
import { listReservations } from '../services/reservationsService';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra } from './helpers/portuguesNoEcra';
import { MES, norm } from './helpers/financeFixtures';

/* Dicas e eixos dos graficos do Financeiro e da Previsao: os montantes seguem a lingua do painel.
   O recharts e simulado de forma a desenhar a dica (content ou formatter) com um valor de 1234 e o
   eixo (tickFormatter) com o mesmo valor. */
vi.mock('recharts', async () => {
  const React = await import('react');
  const PONTO = { value: 1234, name: '2026', dataKey: 'curValue', color: '#000', payload: { receita: 1234, fullName: 'Tour Ilha', num_reservas: 2, name: 'Tour Ilha', fill: '#000' } };
  /* so os filhos componentes (defs e linearGradient nao sao HTML) */
  const caixa = ({ children }) => React.createElement('div', null,
    React.Children.toArray(children).filter(c => c && typeof c.type !== 'string'));
  const nada = () => null;
  const eixo = ({ tickFormatter }) => (tickFormatter ? React.createElement('span', { 'data-eixo': '' }, tickFormatter(1234)) : null);
  const Tooltip = ({ content, formatter }) => {
    if (content) return React.cloneElement(content, { active: true, payload: [PONTO], label: 'Nov' });
    if (formatter) return React.createElement('span', { 'data-dica': '' }, String([].concat(formatter(1234, 'x', PONTO))[0]));
    return null;
  };
  return {
    ResponsiveContainer: caixa, AreaChart: caixa, BarChart: caixa, PieChart: caixa,
    Area: nada, Bar: nada, Pie: nada, Cell: nada, CartesianGrid: nada, Legend: nada, ReferenceLine: nada,
    XAxis: eixo, YAxis: eixo, Tooltip,
  };
});
vi.mock('../services/expensesService', () => ({
  listExpenses: vi.fn(), addExpenseLocal: vi.fn(), updateExpenseLocal: vi.fn(), deleteExpenseLocal: vi.fn(),
}));
vi.mock('../services/financeiroService', () => ({ getReceita: vi.fn() }));
vi.mock('../services/reservationsService', () => ({ listReservations: vi.fn() }));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const dica = () => norm(document.querySelector('[data-dica]')?.textContent || '');

beforeEach(() => {
  listExpenses.mockResolvedValue([{ id: 'e1', category: 'Renda', amount: 300, date: `${MES}-01`, is_recurring: false }]);
  getReceita.mockResolvedValue([{ periodo: `${new Date().getFullYear()}-01`, receita: 1234 }]);
  listReservations.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  useUiStore.setState({ lang: 'pt' });
});

describe('dicas dos gráficos em inglês', () => {
  it('receita_por_periodo_mostra_€1,234_em_ingles_e_€1234_em_portugues', () => {
    useUiStore.setState({ lang: 'en' });
    const { unmount } = render(<RevenueChart data={[{ periodo: `${MES}-01`, receita: 1234, num_reservas: 2 }]} granularidade="day" />);
    expect(screen.getByText('€1,234')).toBeInTheDocument();
    unmount();
    useUiStore.setState({ lang: 'pt' });
    render(<RevenueChart data={[{ periodo: `${MES}-01`, receita: 1234, num_reservas: 2 }]} granularidade="day" />);
    expect(screen.getByText('€1234')).toBeInTheDocument();
  });

  it('a_receita_mensal_mostra_o_mes_em_ingles', () => {
    useUiStore.setState({ lang: 'en' });
    render(<RevenueChart data={[]} granularidade="month" />);
    expect(screen.getByText('No data for the selected period')).toBeInTheDocument();
  });

  it('top_servicos_mostra_o_montante_e_as_reservas_em_ingles', () => {
    useUiStore.setState({ lang: 'en' });
    render(<ServiceBarChart data={[{ name: 'Tour Ilha', receita: 1234, num_reservas: 2 }]} />);
    expect(screen.getByText('€1,234')).toBeInTheDocument();
    expect(screen.getByText('2 booking(s)')).toBeInTheDocument();
    expect(portuguesNoEcra(['Tour Ilha'])).toEqual([]);
  });

  it('canais_e_vazios_em_ingles', () => {
    useUiStore.setState({ lang: 'en' });
    const { unmount } = render(<ChannelChart data={[{ source: 'direct', num_reservas: 2, receita: 1234 }]} />);
    expect(screen.getByText('2 booking(s)')).toBeInTheDocument();
    expect(portuguesNoEcra(['Tour Ilha'])).toEqual([]);
    unmount();
    render(<ServiceBarChart data={[]} />);
    expect(screen.getByText('No service data')).toBeInTheDocument();
  });

  it('despesas_por_categoria_mostra_€1,234_em_ingles', async () => {
    useUiStore.setState({ lang: 'en' });
    render(<DespesasTab currency="EUR" staff={[]} />);
    await screen.findByText('Expenses by category');
    expect(screen.getByText('€1,234')).toBeInTheDocument();
  });

  it('previsao_de_procura_mostra_€1,234_na_dica_em_ingles', async () => {
    useUiStore.setState({ lang: 'en' });
    render(<MemoryRouter future={FUTURE}><Demand /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('2026: €1,234')).toBeInTheDocument());
  });
});
