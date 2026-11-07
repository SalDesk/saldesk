import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Financial from '../pages/Financial';
import * as fin from '../services/financeiroService';
import * as exp from '../services/expensesService';
import * as seller from '../services/sellerService';
import { listStaff } from '../services/staffService';

/* Sem rede: so os servicos da pagina sao simulados; PlanGuard e usePlan sao os reais */
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

let PLANO = 'business';
vi.mock('../store/authStore', () => ({
  default: () => ({ operator: { plan: PLANO } }),
}));

/* o ResponsiveContainer real nao desenha nada no jsdom */
vi.mock('recharts', () => {
  /* os graficos nao renderizam os filhos (defs, linearGradient... nao sao HTML) */
  const grafico = (nome) => () => <div data-chart={nome} />;
  const vazio = () => null;
  return {
    ResponsiveContainer: ({ children }) => <div data-chart="container">{children}</div>,
    PieChart: grafico('pie'), BarChart: grafico('bar'), AreaChart: grafico('area'),
    Pie: vazio, Cell: vazio, Bar: vazio, Area: vazio,
    XAxis: vazio, YAxis: vazio, CartesianGrid: vazio, Tooltip: vazio, Legend: vazio,
  };
});

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

/* mesmas formulas da pagina */
function ultimos30() {
  const fim = new Date(); const inicio = new Date(); inicio.setDate(inicio.getDate() - 29);
  const fmt = d => d.toISOString().slice(0, 10);
  return { inicio: fmt(inicio), fim: fmt(fim) };
}
const MES = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; })();
const ANO = new Date().getFullYear();
/* o Intl usa espacos finos; o Testing Library normaliza-os para espaco simples */
const norm = (t) => t.replace(/\s/g, ' ');
const eur = (n) => norm(`€${Math.round(n).toLocaleString('pt-PT')}`);
const cve = (n) => norm(`${Math.round(n * 110).toLocaleString('pt-PT')} CVE`);

const RESUMO = {
  atual: { receita: 1000, num_reservas: 10, taxa_ocupacao: 50 },
  anterior: { receita: 800, num_reservas: 8, taxa_ocupacao: 40 },
  variacao: { receita: 25, num_reservas: 25, taxa_ocupacao: 10 },
};
const RECEITA = [
  { periodo: `${MES}-01`, receita: 300, num_reservas: 3 },
  { periodo: `${MES}-02`, receita: 700, num_reservas: 7 },
];
const UNIDADES = [
  { unit_id: 'u1', name: 'Tour Ilha', receita: 600, num_reservas: 6 },
  { unit_id: 'u2', name: 'Mergulho', receita: 400, num_reservas: 4 },
];
const CLIENTES = [
  { customer_email: 'ana@x.cv', customer_name: 'Ana Silva', total_gasto: 500 },
  { customer_email: 'bruno@x.cv', customer_name: 'Bruno Costa', total_gasto: 300 },
];
const CANAIS = [
  { source: 'direct', num_reservas: 6, receita: 600 },
  { source: 'viator', num_reservas: 4, receita: 400 },
];
const TRANSACOES = [
  { id: 't1', check_in: `${MES}-03`, customer_name: 'Ana Silva', units: { name: 'Tour Ilha' }, source: 'direct', payment_method: 'paypal', payment_status: 'paid', total_price: 200 },
  { id: 't2', check_in: `${MES}-04`, customer_name: 'Bruno Costa', units: { name: 'Mergulho' }, source: 'viator', payment_method: 'cash', payment_status: 'paid', total_price: 150 },
  { id: 't3', check_in: `${MES}-05`, customer_name: 'Carla Dias', units: { name: 'Tour Ilha' }, source: 'manual', payment_method: 'cash', payment_status: 'pending', total_price: 80 },
];
const FORECAST = {
  confirmed_future_revenue: 500, same_period_last_year: 700, historical_avg: 900,
  weeks: [{ week_label: 'Semana 1', num_reservas: 2, receita: 250 }],
};
const DESPESAS = [{ id: 'e1', category: 'Renda', amount: 300, date: `${MES}-01`, staff_id: '', is_recurring: false, notes: 'Escritorio' }];
const MANUAIS = [{ id: 'r1', category: 'Venda ao balcao', amount: 120, date: `${MES}-01`, notes: 'Feira' }];
const STAFF = [
  { id: 's1', name: 'Rui Lopes', role: 'Guia', status: 'active' },
  { id: 's2', name: 'Vera Mendes', role: 'Vendedor de Praia', status: 'active' },
];
const COMISSOES = [
  { id: 'c1', amount: 20, status: 'pending', created_at: `${MES}-05T10:00:00Z`, reservations: { units: { name: 'Tour Ilha' } } },
  { id: 'c2', amount: 30, status: 'paid', created_at: `${MES}-06T10:00:00Z`, reservations: { units: { name: 'Mergulho' } } },
];

let errosEsperados = false;
let spyErr; let spyWarn;

beforeEach(() => {
  PLANO = 'business';
  errosEsperados = false;
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
  fin.exportExcel.mockResolvedValue();
  fin.exportPdf.mockResolvedValue();
  exp.listExpenses.mockResolvedValue(DESPESAS);
  exp.getSalaryConfig.mockResolvedValue({ s1: { base: 1000, food: 50, transport: 30, inps_pct: 15 } });
  exp.getSalaryPayments.mockResolvedValue([]);
  exp.getObligations.mockResolvedValue({ inps_status_current: 'pending', insurances: [{ name: 'Seguro Frota', renewal_date: '2027-06-01', amount_annual: 400 }] });
  exp.setObligations.mockResolvedValue();
  seller.listSellerCommissions.mockResolvedValue(COMISSOES);
  listStaff.mockResolvedValue(STAFF);
});

afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  if (!errosEsperados) {
    expect(erros).toEqual([]);
    expect(avisos).toEqual([]);
  }
});

function montar() {
  return render(<MemoryRouter future={FUTURE}><Financial /></MemoryRouter>);
}
/* separadores: o texto aparece primeiro no separador, depois no conteudo */
function abrir(rotulo) { fireEvent.click(screen.getAllByText(rotulo)[0]); }
async function prontaVisaoGeral() { await screen.findByText('Receita total'); await waitFor(() => expect(fin.getTransacoes).toHaveBeenCalled()); }

describe('Financeiro: pagina inteira', () => {
  it('renderiza_a_visao_geral_com_os_pedidos_e_os_kpis', async () => {
    montar();
    await prontaVisaoGeral();
    const { inicio, fim } = ultimos30();
    expect(fin.getResumo).toHaveBeenCalledWith(inicio, fim);
    expect(fin.getReceita).toHaveBeenCalledWith(inicio, fim, 'day');
    expect(fin.getUnidades).toHaveBeenCalledWith(inicio, fim);
    expect(fin.getTopClientes).toHaveBeenCalledWith(inicio, fim);
    expect(fin.getCanais).toHaveBeenCalledWith(inicio, fim);
    expect(fin.getTransacoes).toHaveBeenCalledWith(inicio, fim);
    expect(fin.getReceita).toHaveBeenCalledWith(`${ANO}-01-01`, `${ANO}-12-31`, 'month');
    expect(screen.getByRole('heading', { name: 'Financeiro' })).toBeInTheDocument();
    expect(screen.getAllByText(eur(1000)).length).toBeGreaterThan(0); /* receita total */
    expect(screen.getByText('Directas 60%')).toBeInTheDocument();
    expect(screen.getByText('Ticket medio')).toBeInTheDocument();
    expect(screen.getAllByText(eur(100)).length).toBeGreaterThan(0); /* 1000 / 10 */
  });

  it('abre_cada_sub_separador_de_receitas_sem_rebentar', async () => {
    montar();
    await prontaVisaoGeral();
    abrir('Por Tour');
    expect(await screen.findByText('Custos operacionais por tour')).toBeInTheDocument();
    abrir('Previsao');
    expect(await screen.findByText('Previsao semanal')).toBeInTheDocument();
    expect(screen.getByText(/Previsao abaixo da media historica/)).toBeInTheDocument();
    abrir('Caixa');
    expect(await screen.findByText('Pagamentos em dinheiro')).toBeInTheDocument();
    abrir('Receitas Manuais');
    expect(await screen.findByText('Registar receita')).toBeInTheDocument();
    expect(await screen.findByText('Feira')).toBeInTheDocument();
    abrir('Visao Geral');
    expect(await screen.findByText('Receita total')).toBeInTheDocument();
  });

  it('abre_cada_area_de_topo_sem_rebentar', async () => {
    montar();
    await prontaVisaoGeral();
    abrir('Despesas');
    expect(await screen.findByText('Registar despesa')).toBeInTheDocument();
    expect(await screen.findByText('Escritorio')).toBeInTheDocument();
    abrir('Salarios');
    expect(await screen.findByText('Colaboradores activos')).toBeInTheDocument();
    abrir('Comissoes');
    expect(await screen.findByText('Vera Mendes')).toBeInTheDocument();
    abrir('Obrigacoes');
    expect(await screen.findByText('INPS — Contribuicoes mensais')).toBeInTheDocument();
    expect(await screen.findByText('Seguro Frota')).toBeInTheDocument();
    abrir('Resultado');
    expect(await screen.findByText('Decomposicao do resultado')).toBeInTheDocument();
    abrir('Receitas');
    expect(await screen.findByText('Receita total')).toBeInTheDocument();
  });

  it('sem_o_plano_as_quatro_areas_pro_mostram_o_bloqueio_e_Comissoes_nao', async () => {
    PLANO = 'starter';
    montar();
    await prontaVisaoGeral();
    /* cadeado nos separadores: Despesas, Salarios, Obrigacoes e Resultado */
    expect(document.querySelectorAll('svg.lucide-lock').length).toBe(4);
    for (const area of ['Despesas', 'Salarios', 'Obrigacoes', 'Resultado']) {
      abrir(area);
      expect(await screen.findByText('Ver planos de subscricao')).toBeInTheDocument();
    }
    abrir('Comissoes');
    expect(await screen.findByText('Vera Mendes')).toBeInTheDocument();
    expect(screen.queryByText('Ver planos de subscricao')).toBeNull();
    abrir('Receitas');
    expect(await screen.findByText('Receita total')).toBeInTheDocument();
    expect(screen.queryByText('Ver planos de subscricao')).toBeNull();
  });

  it('com_o_plano_nao_ha_cadeados', async () => {
    montar();
    await prontaVisaoGeral();
    expect(document.querySelectorAll('svg.lucide-lock').length).toBe(0);
  });

  it('previsao_so_se_pede_na_primeira_abertura', async () => {
    montar();
    await prontaVisaoGeral();
    expect(fin.getForecast).toHaveBeenCalledTimes(0);
    abrir('Previsao');
    await screen.findByText('Previsao semanal');
    expect(fin.getForecast).toHaveBeenCalledTimes(1);
    abrir('Caixa');
    await screen.findByText('Pagamentos em dinheiro');
    abrir('Previsao');
    await screen.findByText('Previsao semanal');
    expect(fin.getForecast).toHaveBeenCalledTimes(1);
  });

  it('previsao_em_falha_mostra_dados_nao_disponiveis', async () => {
    fin.getForecast.mockRejectedValue(new Error('x'));
    montar();
    await prontaVisaoGeral();
    abrir('Previsao');
    expect(await screen.findByText('Dados de previsao nao disponiveis.')).toBeInTheDocument();
  });

  it('listStaff_so_se_pede_ao_abrir_despesas_salarios_ou_comissoes', async () => {
    montar();
    await prontaVisaoGeral();
    expect(listStaff).toHaveBeenCalledTimes(0);
    abrir('Obrigacoes');
    await screen.findByText('INPS — Contribuicoes mensais');
    expect(listStaff).toHaveBeenCalledTimes(0);
    abrir('Despesas');
    await screen.findByText('Registar despesa');
    await waitFor(() => expect(listStaff).toHaveBeenCalledTimes(1));
    abrir('Obrigacoes');
    await screen.findByText('INPS — Contribuicoes mensais');
    abrir('Despesas');
    await screen.findByText('Registar despesa');
    expect(listStaff).toHaveBeenCalledTimes(1);
  });

  it('interruptor_de_moeda_converte_com_110_e_vale_nas_outras_areas', async () => {
    montar();
    await prontaVisaoGeral();
    fireEvent.click(screen.getByRole('button', { name: 'CVE' }));
    expect(screen.getAllByText(cve(1000)).length).toBeGreaterThan(0);
    abrir('Resultado');
    await screen.findByText('Decomposicao do resultado');
    expect(screen.getAllByText(cve(1000)).length).toBeGreaterThan(0); /* receita bruta em CVE */
    /* interruptor flutuante das outras areas */
    fireEvent.click(screen.getByRole('button', { name: 'EUR' }));
    expect(screen.getAllByText(eur(1000)).length).toBeGreaterThan(0);
    expect(screen.queryByText(cve(1000))).toBeNull();
  });

  it('exportar_chama_exportExcel_e_exportPdf_com_o_periodo', async () => {
    montar();
    await prontaVisaoGeral();
    const { inicio, fim } = ultimos30();
    fireEvent.click(screen.getByRole('button', { name: 'Excel' }));
    await waitFor(() => expect(fin.exportExcel).toHaveBeenCalledWith(inicio, fim));
    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
    await waitFor(() => expect(fin.exportPdf).toHaveBeenCalledWith(inicio, fim));
    /* so em Receitas */
    abrir('Comissoes');
    await screen.findByText('Vera Mendes');
    expect(screen.queryByRole('button', { name: 'Excel' })).toBeNull();
  });

  it('falha_do_carregamento_nao_rebenta', async () => {
    errosEsperados = true;
    fin.getResumo.mockRejectedValue(new Error('falhou'));
    fin.getTransacoes.mockRejectedValue(new Error('falhou'));
    montar();
    expect(await screen.findByText('Receita total')).toBeInTheDocument();
    await waitFor(() => expect(spyErr).toHaveBeenCalled()); /* carregar() regista o erro */
    expect(screen.getAllByText(eur(0)).length).toBeGreaterThan(0);
    expect(await screen.findByText('Sem transacoes no periodo')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Financeiro' })).toBeInTheDocument();
  });
});
