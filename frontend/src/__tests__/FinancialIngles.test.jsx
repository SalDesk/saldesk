import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Financial from '../pages/Financial';
import DespesasTab from '../pages/financial/DespesasTab';
import * as fin from '../services/financeiroService';
import * as exp from '../services/expensesService';
import * as seller from '../services/sellerService';
import { listStaff } from '../services/staffService';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';
import { dadosDoGrafico } from './helpers/rechartsMock';
import {
  FUTURE, MES, ANO, norm, RESUMO, RECEITA, UNIDADES, CLIENTES, CANAIS, TRANSACOES, FORECAST, MANUAIS, STAFF, COMISSOES,
} from './helpers/financeFixtures';

/* O Financeiro inteiro em ingles: rotulos traduzidos, valores guardados (categorias, metodos, estados,
   ids dos custos) iguais aos de sempre e numeros e datas pelo en-GB. */
vi.mock('../services/financeiroService', () => ({
  getResumo: vi.fn(), getReceita: vi.fn(), getUnidades: vi.fn(), getTopClientes: vi.fn(),
  getCanais: vi.fn(), exportExcel: vi.fn(), getTransacoes: vi.fn(), exportPdf: vi.fn(),
  getForecast: vi.fn(), getReceitasManuais: vi.fn(), createReceitaManual: vi.fn(),
  updateReceitaManual: vi.fn(), deleteReceitaManual: vi.fn(),
}));
vi.mock('../services/expensesService', () => ({
  listExpenses: vi.fn(), addExpenseLocal: vi.fn(), updateExpenseLocal: vi.fn(), deleteExpenseLocal: vi.fn(),
  getSalaryConfig: vi.fn(), setSalaryConfig: vi.fn(), getSalaryPayments: vi.fn(), addSalaryPayment: vi.fn(),
  getObligations: vi.fn(), setObligations: vi.fn(),
}));
vi.mock('../services/sellerService', () => ({
  listSellerCommissions: vi.fn(), markCommissionPaid: vi.fn(), getSellerCommissionPct: vi.fn(() => 10),
}));
vi.mock('../services/staffService', () => ({ listStaff: vi.fn() }));
vi.mock('../store/authStore', () => ({ default: () => ({ operator: { plan: 'business' } }) }));
vi.mock('recharts', async () => (await import('./helpers/rechartsMock')).makeRechartsMock());

const eurEn = (n) => norm(`€${Math.round(n).toLocaleString('en-GB')}`);
const dataEn = (d) => norm(new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }));
const DESPESAS = [{ id: 'e1', category: 'Renda', amount: 300, date: `${MES}-01`, staff_id: '', is_recurring: false, notes: 'Escritorio' }];
/* dados dos testes que podem parecer portugueses (nomes, notas, seguros) */
const DADOS = ['Tour Ilha', 'Mergulho', 'Ana Silva', 'Bruno Costa', 'Carla Dias', 'Semana 1', 'Escritorio', 'Feira',
  'Rui Lopes', 'Vera Mendes', 'Seguro Frota', 'Imposto Único sobre Rendimentos'];

let spyErr; let spyWarn;
beforeEach(() => {
  useUiStore.setState({ lang: 'en' });
  localStorage.clear();
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  fin.getResumo.mockResolvedValue(RESUMO);
  fin.getReceita.mockResolvedValue(RECEITA);
  fin.getUnidades.mockResolvedValue(UNIDADES);
  fin.getTopClientes.mockResolvedValue(CLIENTES);
  fin.getCanais.mockResolvedValue(CANAIS);
  fin.getTransacoes.mockResolvedValue(TRANSACOES);
  fin.getForecast.mockResolvedValue(FORECAST);
  fin.getReceitasManuais.mockResolvedValue(MANUAIS);
  exp.listExpenses.mockResolvedValue(DESPESAS);
  exp.addExpenseLocal.mockImplementation(async (e) => e);
  exp.getSalaryConfig.mockResolvedValue({ s1: { base: 1000, food: 50, transport: 30, inps_pct: 15 } });
  exp.getSalaryPayments.mockResolvedValue([]);
  exp.getObligations.mockResolvedValue({ inps_status_current: 'pending', insurances: [{ name: 'Seguro Frota', renewal_date: '2027-06-01', amount_annual: 400 }] });
  exp.setObligations.mockResolvedValue();
  seller.listSellerCommissions.mockResolvedValue(COMISSOES);
  listStaff.mockResolvedValue(STAFF);
});
afterEach(() => {
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  useUiStore.setState({ lang: 'pt' });
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

function montar() {
  return render(<MemoryRouter future={FUTURE}><Financial /></MemoryRouter>);
}
function abrir(rotulo) { fireEvent.click(screen.getAllByText(rotulo)[0]); }
async function pronta() { await screen.findByText('Total revenue'); await waitFor(() => expect(fin.getTransacoes).toHaveBeenCalled()); }
const opcoes = (select) => [...select.options].map(o => [o.value, o.textContent]);
const cabecalhos = (tabela) => within(tabela).getAllByRole('columnheader').map(h => h.textContent);
const semPortugues = (raiz) => {
  expect(portuguesNoEcra(DADOS, raiz)).toEqual([]);
  expect(chavesCruas(['financial', 'staff'], raiz)).toEqual([]);
};

describe('Financeiro em inglês: visão geral', () => {
  it('separadores_kpis_cartoes_e_transaccoes_em_ingles_sem_portugues', async () => {
    montar();
    await pronta();
    expect(screen.getByRole('heading', { name: 'Financial' })).toBeInTheDocument();
    for (const r of ['Revenue', 'Expenses', 'Payroll', 'Commissions', 'Obligations', 'Profit and loss',
      'Overview', 'By tour', 'Forecast', 'Cash', 'Manual revenue',
      'Last 30 days', 'This month', 'Last month', 'This year', 'Day', 'Week', 'Month']) {
      expect(screen.getAllByText(r).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('Direct 60%')).toBeInTheDocument();
    expect(screen.getByText('4 via OTA')).toBeInTheDocument();
    expect(screen.getByText('Average ticket')).toBeInTheDocument();
    expect(screen.getByText('vs prev. period')).toBeInTheDocument();
    expect(screen.getAllByText(eurEn(1000)).length).toBeGreaterThan(0);
    for (const h of ['Revenue by period', 'By channel', `Annual seasonality — ${ANO}`, 'Top 5 services by revenue',
      'Top customers', 'Comparison with previous period', 'Transactions']) {
      expect(screen.getByText(h, { selector: 'h3' })).toBeInTheDocument();
    }
    const [comparativo, transaccoes] = screen.getAllByRole('table');
    expect(cabecalhos(comparativo)).toEqual(['Metric', 'Current period', 'Previous period', 'Change']);
    expect(within(comparativo).getAllByRole('row').slice(1).map(r => within(r).getAllByRole('cell')[0].textContent))
      .toEqual(['Revenue', 'Bookings', 'Occupancy']);
    expect(cabecalhos(transaccoes)).toEqual(['Date', 'Customer', 'Service', 'Channel', 'Method', 'Amount', 'Status']);
    const ana = within(transaccoes).getByText('Ana Silva').closest('tr');
    expect(ana).toHaveTextContent(dataEn(`${MES}-03`));
    expect(ana).toHaveTextContent('Direct');
    expect(ana).toHaveTextContent('PayPal');
    expect(ana).toHaveTextContent('Paid');
    expect(within(transaccoes).getByText('Carla Dias').closest('tr')).toHaveTextContent('Manual');
    expect(within(transaccoes).getByText('Carla Dias').closest('tr')).toHaveTextContent('Pending');
    expect(screen.getByRole('button', { name: 'Refresh transactions' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search transactions')).toHaveAttribute('placeholder', 'Search...');
    expect(screen.getByText('3 transaction(s)')).toBeInTheDocument();
    semPortugues();
  });

  it('os_filtros_mostram_rotulos_ingleses_e_comparam_os_valores_de_sempre', async () => {
    montar();
    await pronta();
    const metodo = screen.getByLabelText('Payment method');
    const estado = screen.getByLabelText('Payment status');
    expect(opcoes(metodo)).toEqual([['Todos', 'All methods'], ['paypal', 'PayPal'], ['sisp', 'SISP'], ['cash', 'Cash'], ['transfer', 'Bank transfer']]);
    expect(opcoes(estado)).toEqual([['Todos', 'All statuses'], ['paid', 'Paid'], ['pending', 'Pending'], ['partial', 'Partial'], ['refunded', 'Refunded']]);
    fireEvent.change(metodo, { target: { value: 'cash' } });
    expect(screen.getByText('2 transaction(s)')).toBeInTheDocument();
    fireEvent.change(estado, { target: { value: 'pending' } });
    expect(screen.getByText('1 transaction(s)')).toBeInTheDocument();
    fireEvent.change(metodo, { target: { value: 'transfer' } });
    expect(screen.getByText('No transactions in this period')).toBeInTheDocument();
  });
});

describe('Financeiro em inglês: sub-separadores de receitas', () => {
  it('por_tour_e_custos_gravam_com_os_ids_de_sempre', async () => {
    montar();
    await pronta();
    abrir('By tour');
    expect(await screen.findByText('Operating costs by tour')).toBeInTheDocument();
    expect(screen.getByText('Revenue by tour')).toBeInTheDocument();
    expect(cabecalhos(screen.getByRole('table'))).toEqual(['Tour', 'Bookings', 'Gross revenue', 'Cost', 'Margin', '%', '']);
    fireEvent.click(screen.getByRole('button', { name: 'Edit costs for Tour Ilha' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Costs — Tour Ilha')).toBeInTheDocument();
    for (const r of ['Guide / Instructor', 'Transport', 'Tickets / Admission', 'Meals', 'Other']) {
      expect(within(dialogo).getByLabelText(r)).toBeInTheDocument();
    }
    expect(within(dialogo).getByText('Total operating cost')).toBeInTheDocument();
    semPortugues(dialogo);
    fireEvent.change(within(dialogo).getByLabelText('Guide / Instructor'), { target: { value: '40' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Save' }));
    expect(JSON.parse(localStorage.getItem('saldesk_tour_costs_v1')).u1).toMatchObject({ guide: '40', transport: 0, tickets: 0, meals: 0, other: 0 });
  });

  it('previsao_caixa_e_receitas_manuais_em_ingles', async () => {
    montar();
    await pronta();
    abrir('Forecast');
    expect(await screen.findByText('Weekly forecast')).toBeInTheDocument();
    expect(screen.getByText('Forecast below the historical average. Consider marketing actions.')).toBeInTheDocument();
    for (const r of ['Confirmed revenue (next period)', 'Same period — last year', 'Monthly historical average', '2 booking(s)']) {
      expect(screen.getByText(r)).toBeInTheDocument();
    }
    semPortugues();

    abrir('Cash');
    expect(await screen.findByText('Cash payments')).toBeInTheDocument();
    for (const r of ['Total received', 'Confirmed', 'Awaiting confirmation']) expect(screen.getByText(r)).toBeInTheDocument();
    expect(cabecalhos(screen.getByRole('table'))).toEqual(['Date', 'Customer', 'Service', 'Amount', 'Status']);
    semPortugues();

    abrir('Manual revenue');
    expect(await screen.findByText('Feira')).toBeInTheDocument();
    expect(screen.getByText('Feira').closest('tr')).toHaveTextContent('Counter sale');
    const categoria = screen.getByLabelText('Category');
    expect(opcoes(categoria)).toEqual([
      ['', 'All categories'], ['Venda ao balcao', 'Counter sale'], ['Comissao de parceiro', 'Partner commission'],
      ['Merchandising', 'Merchandising'], ['Aluguer de equipamento', 'Equipment rental'], ['Patrocinio', 'Sponsorship'],
      ['Evento privado', 'Private event'], ['Outro', 'Other'],
    ]);
    fireEvent.change(categoria, { target: { value: 'Patrocinio' } });
    expect(screen.getByText('No manual revenue in the selected period.')).toBeInTheDocument();
    fireEvent.change(categoria, { target: { value: 'Venda ao balcao' } });
    expect(screen.getByRole('button', { name: 'Edit revenue - Counter sale' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete revenue - Counter sale' })).toBeInTheDocument();
    semPortugues();
  });
});

describe('Financeiro em inglês: despesas', () => {
  it('registar_com_a_categoria_Salaries_grava_Salarios', async () => {
    render(<DespesasTab currency="EUR" staff={STAFF} />);
    await screen.findByText('Escritorio');
    expect(cabecalhos(screen.getByRole('table'))).toEqual(['Date', 'Category', 'Staff member', 'Amount', 'Recurring', 'Notes', '']);
    expect(screen.getByText('Escritorio').closest('tr')).toHaveTextContent('Rent');
    expect(dadosDoGrafico('pie')).toEqual([{ name: 'Rent', total: 300 }]);
    expect(screen.getByText('Expenses by category')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Total:')).toHaveTextContent(`Total: ${eurEn(300)}`);
    const filtro = screen.getByLabelText('Category');
    expect(opcoes(filtro).slice(0, 3)).toEqual([['', 'All categories'], ['Salarios', 'Salaries'], ['Comissoes vendedores', 'Seller commissions']]);
    /* nomes oficiais ficam iguais */
    expect(opcoes(filtro).filter(([v]) => v === 'INPS' || v === 'IUR')).toEqual([['INPS', 'INPS'], ['IUR', 'IUR']]);
    semPortugues();

    fireEvent.click(screen.getByRole('button', { name: 'Record expense' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Record expense', { selector: 'h2' })).toBeInTheDocument();
    const cat = within(dialogo).getByLabelText('Category');
    const salaries = [...cat.options].find(o => o.textContent === 'Salaries');
    fireEvent.change(cat, { target: { value: salaries.value } });
    fireEvent.change(within(dialogo).getByLabelText('Amount'), { target: { value: '750' } });
    const colaborador = within(dialogo).getByLabelText('Staff member');
    expect(opcoes(colaborador)).toEqual([['', 'None in particular'], ['s1', 'Rui Lopes (Guide)'], ['s2', 'Vera Mendes (Beach Seller)']]);
    fireEvent.change(colaborador, { target: { value: 's1' } });
    expect(within(dialogo).getByText('Monthly recurring expense')).toBeInTheDocument();
    for (const r of ['Currency', 'Date', 'Notes', 'Receipt URL']) expect(within(dialogo).getByLabelText(r)).toBeInTheDocument();
    semPortugues(dialogo);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Record' }));
    await waitFor(() => expect(exp.addExpenseLocal).toHaveBeenCalledTimes(1));
    expect(exp.addExpenseLocal.mock.calls[0][0]).toMatchObject({ category: 'Salarios', amount: 750, staff_id: 's1' });
  });

  it('em_portugues_as_categorias_mostram_o_valor_gravado_como_sempre', async () => {
    useUiStore.setState({ lang: 'pt' });
    render(<DespesasTab currency="EUR" staff={STAFF} />);
    await screen.findByText('Escritorio');
    expect(opcoes(screen.getByLabelText('Categoria')).slice(0, 3)).toEqual([['', 'Todas as categorias'], ['Salarios', 'Salarios'], ['Comissoes vendedores', 'Comissoes vendedores']]);
    expect(dadosDoGrafico('pie')).toEqual([{ name: 'Renda', total: 300 }]);
  });
});

describe('Financeiro em inglês: pessoal, obrigações e resultado', () => {
  it('payroll_em_ingles', async () => {
    montar();
    await pronta();
    abrir('Payroll');
    expect(await screen.findByText('Active staff')).toBeInTheDocument();
    for (const r of ['Total payroll/month', 'Paid this month', 'Unpaid this month']) expect(screen.getByText(r)).toBeInTheDocument();
    expect(cabecalhos(screen.getByRole('table'))).toEqual(['Staff member', 'Base salary', 'Allowances', 'Employer INPS', 'Total cost/month', 'Status', '']);
    const rui = screen.getByText('Rui Lopes').closest('tr');
    expect(rui).toHaveTextContent('Guide');
    expect(rui).toHaveTextContent(`Meal ${eurEn(50)} Transport ${eurEn(30)}`);
    expect(rui).toHaveTextContent('Pending');
    expect(within(rui).getByRole('button', { name: 'Pay salary - Rui Lopes' })).toBeInTheDocument();
    semPortugues();
    fireEvent.click(within(rui).getByRole('button', { name: 'Edit salary - Rui Lopes' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Salary — Rui Lopes')).toBeInTheDocument();
    for (const r of ['Base salary (€/month)', 'Meal allowance', 'Transport allowance', 'Employer INPS (%)']) {
      expect(within(dialogo).getByLabelText(r)).toBeInTheDocument();
    }
    expect(within(dialogo).getByText('Default: 15% (Cape Verde)')).toBeInTheDocument();
    expect(within(dialogo).getByText('Total monthly cost')).toBeInTheDocument();
    expect(within(dialogo).getByText(eurEn(1230))).toBeInTheDocument();
    semPortugues(dialogo);
  });

  it('comissoes_em_ingles', async () => {
    montar();
    await pronta();
    abrir('Commissions');
    expect(await screen.findByText('Vera Mendes')).toBeInTheDocument();
    expect(screen.getByText('10% commission · 2 booking(s) this month')).toBeInTheDocument();
    for (const r of ['Total', 'Paid', 'Pending']) expect(screen.getAllByText(r).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Pay commission - Tour Ilha' })).toBeInTheDocument();
    semPortugues();
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Pay commissions — Vera Mendes')).toBeInTheDocument();
    expect(within(dialogo).getByText(/^Pending commissions this month:/)).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Confirm payment' })).toBeInTheDocument();
    semPortugues(dialogo);
  });

  it('obrigacoes_em_ingles_com_os_nomes_oficiais_iguais', async () => {
    montar();
    await pronta();
    abrir('Obligations');
    expect(await screen.findByText('INPS — Monthly contributions')).toBeInTheDocument();
    expect(screen.getByText('IUR — income tax (Imposto Único sobre Rendimentos)')).toBeInTheDocument();
    for (const r of ['Filing date', '15th of each month', 'Employer contribution', '15% of gross salaries',
      'Employee contribution', '8% of gross salaries', 'Insurance', 'SalDesk subscription',
      'Monthly withholding tax on salaries. Annual return in April.']) {
      expect(screen.getByText(r)).toBeInTheDocument();
    }
    expect(screen.getByText('Seguro Frota').parentElement).toHaveTextContent(`Renewal: ${dataEn('2027-06-01')}`);
    expect(screen.getByText('€400/year')).toBeInTheDocument();
    expect(opcoes(screen.getByLabelText('INPS status'))).toEqual([['pending', 'Pending this month'], ['paid', 'Paid this month']]);
    expect(opcoes(screen.getByLabelText('Current plan'))).toEqual([
      ['starter', 'Starter — €29/month'], ['pro', 'Pro — €69/month'], ['business', 'Business — €79/month'],
    ]);
    expect(screen.getByLabelText('IUR notes')).toHaveAttribute('placeholder', 'IUR notes, estimated amounts, accountant in charge...');
    expect(screen.getByRole('button', { name: 'Remove insurance - Seguro Frota' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add insurance' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('INPS status'), { target: { value: 'paid' } });
    expect(exp.setObligations).toHaveBeenLastCalledWith(expect.objectContaining({ inps_status_current: 'paid' }));
    semPortugues();
  });

  it('resultado_em_ingles_com_os_meses_no_grafico', async () => {
    montar();
    await pronta();
    abrir('Profit and loss');
    expect(await screen.findByText('Result breakdown')).toBeInTheDocument();
    for (const r of ['Operating expenses', 'Bookings in period', 'Margin', 'Operating exp.', 'Revenue vs expenses — last 6 months']) {
      expect(screen.getByText(r)).toBeInTheDocument();
    }
    for (const r of ['Gross revenue', 'Payroll', 'Net result']) expect(screen.getAllByText(r).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Export PDF/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export Excel/ })).toBeInTheDocument();
    const mesesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const barras = dadosDoGrafico('bar');
    expect(barras[barras.length - 1].name).toBe(mesesEn[new Date().getMonth()]);
    semPortugues();
  });
});
