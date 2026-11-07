import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Financial from '../pages/Financial';
import TransacoesTable from '../pages/financial/TransacoesTable';
import Comparativo from '../pages/financial/Comparativo';
import KpiCard from '../components/financial/KpiCard';
import RevenueChart from '../components/financial/RevenueChart';
import ChannelChart from '../components/financial/ChannelChart';
import ServiceBarChart from '../components/financial/ServiceBarChart';
import TopCustomersList from '../components/financial/TopCustomersList';
import * as fin from '../services/financeiroService';
import * as exp from '../services/expensesService';
import * as seller from '../services/sellerService';
import { listStaff } from '../services/staffService';
import { coresDosGraficos, dadosDoGrafico } from './helpers/rechartsMock';
import {
  FUTURE, MES, eur, cve, fmtDate, RESUMO, RECEITA, UNIDADES, CLIENTES, CANAIS, TRANSACOES,
  FORECAST, DESPESAS, MANUAIS, STAFF, COMISSOES,
} from './helpers/financeFixtures';

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

let spyErr; let spyWarn;

beforeEach(() => {
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
  exp.getSalaryConfig.mockResolvedValue({});
  exp.getSalaryPayments.mockResolvedValue([]);
  exp.getObligations.mockResolvedValue({});
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
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

function montarPagina() {
  return render(<MemoryRouter future={FUTURE}><Financial /></MemoryRouter>);
}
async function paginaPronta() {
  await screen.findByText('Receita total');
  await screen.findByText('Carla Dias'); /* transacoes carregadas */
}
const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border)-(?:green|yellow|blue|red)-\d/;

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Visao Geral: KPIs e graficos da pagina', () => {
  it('kpis_receita_directas_ticket_medio_e_margem_sem_custos', async () => {
    montarPagina();
    await paginaPronta();
    expect(screen.getByText('Receita total')).toBeInTheDocument();
    expect(screen.getAllByText(eur(1000)).length).toBeGreaterThan(0);
    expect(screen.getByText('vs periodo ant.')).toBeInTheDocument();
    expect(screen.getByText('Directas 60%')).toBeInTheDocument();
    expect(screen.getByText('4 via OTA')).toBeInTheDocument();
    expect(screen.getByText('Ticket medio')).toBeInTheDocument();
    expect(screen.getAllByText(eur(100)).length).toBeGreaterThan(0);
    /* sem custos guardados a margem e a propria receita e o rotulo nao leva percentagem */
    expect(screen.getByText('Margem liquida')).toBeInTheDocument();
  });

  it('margem_liquida_desconta_os_custos_guardados_em_localStorage', async () => {
    localStorage.setItem('saldesk_tour_costs_v1', JSON.stringify({ u1: { guide: 100, transport: 50 } }));
    montarPagina();
    await paginaPronta();
    expect(screen.getByText('Margem liquida (85%)')).toBeInTheDocument();
    expect(screen.getAllByText(eur(850)).length).toBeGreaterThan(0);
    expect(screen.getByText('crescimento')).toBeInTheDocument();
  });

  it('top_clientes_mostra_os_nomes_e_valores', async () => {
    montarPagina();
    await paginaPronta();
    const cartao = screen.getByText('Top clientes').closest('div').parentElement;
    expect(within(cartao).getByText('Ana Silva')).toBeInTheDocument();
    expect(within(cartao).getByText('€500')).toBeInTheDocument();
    expect(within(cartao).getByText('Bruno Costa')).toBeInTheDocument();
  });

  it('comparativo_so_aparece_com_periodo_anterior', async () => {
    montarPagina();
    await paginaPronta();
    expect(screen.getByText('Comparativo com periodo anterior')).toBeInTheDocument();
    cleanup();
    fin.getResumo.mockResolvedValue({ atual: RESUMO.atual });
    montarPagina();
    await paginaPronta();
    expect(screen.queryByText('Comparativo com periodo anterior')).toBeNull();
  });

  it('actualizar_repete_getTransacoes', async () => {
    montarPagina();
    await paginaPronta();
    expect(fin.getTransacoes).toHaveBeenCalledTimes(1);
    const botao = screen.getByText('Transacoes').parentElement.querySelector('button');
    fireEvent.click(botao);
    await waitFor(() => expect(fin.getTransacoes).toHaveBeenCalledTimes(2));
    await screen.findByText('Carla Dias');
  });

  it('moeda_cve_converte_os_graficos_e_a_tabela', async () => {
    montarPagina();
    await paginaPronta();
    fireEvent.click(screen.getByRole('button', { name: 'CVE' }));
    expect(screen.getAllByText(cve(1000)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(cve(200)).length).toBeGreaterThan(0); /* transacao t1 */
    const barras = dadosDoGrafico('bar');
    expect(barras.map(b => b.receita)).toEqual([66000, 44000]);
  });
});

describe('TransacoesTable', () => {
  const montar = (props = {}) => render(<TransacoesTable transacoes={TRANSACOES} currency="EUR" loading={false} {...props} />);

  it('mostra_as_colunas_e_as_linhas', () => {
    montar();
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Data', 'Cliente', 'Servico', 'Canal', 'Metodo', 'Montante', 'Estado']);
    const linha = screen.getByText('Ana Silva').closest('tr');
    expect(linha).toHaveTextContent(fmtDate(`${MES}-03`));
    expect(linha).toHaveTextContent('Tour Ilha');
    expect(linha).toHaveTextContent('Directa');
    expect(linha).toHaveTextContent('PayPal');
    expect(linha).toHaveTextContent(eur(200));
    expect(linha).toHaveTextContent('Pago');
    expect(screen.getByText('Carla Dias').closest('tr')).toHaveTextContent('Pendente');
    expect(screen.getByText('Carla Dias').closest('tr')).toHaveTextContent('Manual');
    expect(screen.getByText('3 transacao(oes)')).toBeInTheDocument();
  });

  it('filtra_por_pesquisa_no_cliente_ou_no_servico', () => {
    montar();
    fireEvent.change(screen.getByPlaceholderText('Pesquisar...'), { target: { value: 'carla' } });
    expect(screen.getByText('1 transacao(oes)')).toBeInTheDocument();
    expect(screen.queryByText('Ana Silva')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Pesquisar...'), { target: { value: 'MERG' } });
    expect(screen.getByText('Bruno Costa')).toBeInTheDocument();
    expect(screen.queryByText('Carla Dias')).toBeNull();
  });

  it('filtra_por_metodo_e_por_estado', () => {
    montar();
    const [metodo, estado] = screen.getAllByRole('combobox');
    fireEvent.change(metodo, { target: { value: 'cash' } });
    expect(screen.getByText('2 transacao(oes)')).toBeInTheDocument();
    expect(screen.queryByText('Ana Silva')).toBeNull();
    fireEvent.change(estado, { target: { value: 'pending' } });
    expect(screen.getByText('1 transacao(oes)')).toBeInTheDocument();
    expect(screen.getByText('Carla Dias')).toBeInTheDocument();
    expect(Array.from(metodo.options).map(o => o.textContent)).toEqual(['Todos os metodos', 'PayPal', 'SISP', 'Dinheiro', 'Transferencia']);
    expect(Array.from(estado.options).map(o => o.textContent)).toEqual(['Todos os estados', 'Pago', 'Pendente', 'Parcial', 'Reembolsado']);
  });

  it('mostra_no_maximo_50_linhas', () => {
    const muitas = Array.from({ length: 60 }, (_, i) => ({ id: `m${i}`, check_in: `${MES}-03`, customer_name: `Cliente ${i}`, total_price: 10 }));
    montar({ transacoes: muitas });
    expect(screen.getAllByRole('row')).toHaveLength(51); /* cabecalho + 50 */
    expect(screen.getByText('60 transacao(oes)')).toBeInTheDocument();
  });

  it('campos_em_falta_dao_travessao_e_zero', () => {
    montar({ transacoes: [{ id: 'x' }] });
    const linha = screen.getAllByRole('row')[1];
    expect(linha).toHaveTextContent(eur(0));
    expect(within(linha).getAllByText('—').length).toBeGreaterThanOrEqual(5);
  });

  it('moeda_cve_converte_o_montante', () => {
    montar({ currency: 'CVE' });
    expect(screen.getByText('Ana Silva').closest('tr')).toHaveTextContent(cve(200));
  });

  it('sem_transacoes_mostra_o_vazio', () => {
    montar({ transacoes: [] });
    expect(screen.getByText('Sem transacoes no periodo')).toBeInTheDocument();
    montar({ transacoes: null });
    expect(screen.getAllByText('Sem transacoes no periodo')).toHaveLength(2);
  });

  it('em_carga_mostra_o_spinner_e_nao_a_tabela', () => {
    montar({ loading: true });
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('Sem transacoes no periodo')).toBeNull();
  });
});

describe('Comparativo', () => {
  it('mostra_actual_anterior_e_variacao', () => {
    render(<Comparativo resumo={RESUMO} currency="EUR" />);
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Metrica', 'Periodo actual', 'Periodo anterior', 'Variacao']);
    const receita = screen.getByText('Receita').closest('tr');
    expect(receita).toHaveTextContent(eur(1000));
    expect(receita).toHaveTextContent(eur(800));
    expect(receita).toHaveTextContent(`+${eur(25)}`);
    expect(screen.getByText('Reservas').closest('tr')).toHaveTextContent('+25');
    const ocup = screen.getByText('Ocupacao').closest('tr');
    expect(ocup).toHaveTextContent('50.0%');
    expect(ocup).toHaveTextContent('40.0%');
    expect(ocup).toHaveTextContent('+10.0 p.p.');
  });

  it('variacao_zero_ou_nula_mostra_travessao_e_negativa_nao_leva_mais', () => {
    const resumo = { ...RESUMO, variacao: { receita: 0, num_reservas: null, taxa_ocupacao: -5 } };
    render(<Comparativo resumo={resumo} currency="EUR" />);
    expect(within(screen.getByText('Receita').closest('tr')).getByText('—')).toBeInTheDocument();
    expect(within(screen.getByText('Reservas').closest('tr')).getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Ocupacao').closest('tr')).toHaveTextContent('-5.0 p.p.');
  });

  it('nao_desenha_nada_sem_periodo_anterior_ou_variacao', () => {
    const { container } = render(<Comparativo resumo={{ atual: RESUMO.atual, variacao: RESUMO.variacao }} currency="EUR" />);
    expect(container).toBeEmptyDOMElement();
    const outro = render(<Comparativo resumo={null} currency="EUR" />);
    expect(outro.container).toBeEmptyDOMElement();
  });

  it('moeda_cve_converte_receita_e_variacao', () => {
    render(<Comparativo resumo={RESUMO} currency="CVE" />);
    expect(screen.getByText('Receita').closest('tr')).toHaveTextContent(cve(1000));
    expect(screen.getByText('Receita').closest('tr')).toHaveTextContent(`+${cve(25)}`);
  });
});

describe('Graficos de receitas', () => {
  it('canais_consolidam_directa_com_public_e_manual_com_admin', () => {
    render(<ChannelChart data={[
      { source: 'direct', num_reservas: 2, receita: 100 }, { source: 'public', num_reservas: 3, receita: 50 },
      { source: 'admin', num_reservas: 1, receita: 10 }, { source: 'manual', num_reservas: 4, receita: 20 },
      { source: 'booking_com', num_reservas: 5, receita: 70 },
    ]} />);
    expect(dadosDoGrafico('pie')).toEqual([
      { name: 'Directa', num_reservas: 5, receita: 150 },
      { name: 'Manual', num_reservas: 5, receita: 30 },
      { name: 'Booking.com', num_reservas: 5, receita: 70 },
    ]);
  });

  it('canais_sem_dados_mostra_o_texto', () => {
    render(<ChannelChart data={[]} />);
    expect(screen.getByText('Sem dados')).toBeInTheDocument();
  });

  it('top_5_servicos_ordenados_por_receita_com_nome_cortado_aos_16', () => {
    const unidades = [
      { name: 'A', receita: 10, num_reservas: 1 }, { name: 'Passeio de barco muito comprido', receita: 90, num_reservas: 2 },
      { name: 'C', receita: 30, num_reservas: 3 }, { name: 'D', receita: 20, num_reservas: 4 },
      { name: 'E', receita: 50, num_reservas: 5 }, { name: 'F', receita: 40, num_reservas: 6 },
    ];
    render(<ServiceBarChart data={unidades} currency="EUR" />);
    const d = dadosDoGrafico('bar');
    expect(d.map(x => x.receita)).toEqual([90, 50, 40, 30, 20]);
    expect(d[0].name).toBe('Passeio de barco…');
    expect(d[0].fullName).toBe('Passeio de barco muito comprido');
  });

  it('servicos_sem_dados_mostra_o_texto', () => {
    render(<ServiceBarChart data={[]} />);
    expect(screen.getByText('Sem dados de servicos')).toBeInTheDocument();
  });

  it('receita_por_periodo_converte_etiquetas_e_valores', () => {
    render(<RevenueChart data={[{ periodo: '2026-11-03', receita: 10, num_reservas: 2 }]} granularidade="day" currency="CVE" />);
    const d = dadosDoGrafico('area');
    expect(d).toEqual([{ label: '3 Nov', receita: 1100, reservas: 2 }]);
    cleanup();
    render(<RevenueChart data={[{ periodo: '2026-11', receita: 10 }]} granularidade="month" currency="EUR" />);
    expect(dadosDoGrafico('area')[0].label).toBe('Nov 2026');
  });

  it('receita_por_periodo_sem_dados_mostra_o_texto', () => {
    render(<RevenueChart data={[]} granularidade="day" />);
    expect(screen.getByText('Sem dados para o periodo seleccionado')).toBeInTheDocument();
  });

  it('top_clientes_barra_proporcional_ao_maior_e_vazio', () => {
    const { container } = render(<TopCustomersList data={CLIENTES} />);
    const barras = container.querySelectorAll('[style*="width"]');
    expect(barras[0].style.width).toBe('100%');
    expect(barras[1].style.width).toBe('60%');
    cleanup();
    render(<TopCustomersList data={[]} />);
    expect(screen.getByText('Sem dados')).toBeInTheDocument();
  });
});

/* ───────────────────────── design system ───────────────────────── */

describe('Visao Geral com o design system', () => {
  it('as_duas_tabelas_tem_role_table_e_as_colunas_esperadas', () => {
    render(<TransacoesTable transacoes={TRANSACOES} currency="EUR" loading={false} />);
    const tabela = screen.getByRole('table');
    expect(within(tabela).getAllByRole('columnheader')).toHaveLength(7);
    cleanup();
    render(<Comparativo resumo={RESUMO} currency="EUR" />);
    expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(4);
  });

  it('os_campos_de_filtro_tem_nome_acessivel', () => {
    render(<TransacoesTable transacoes={TRANSACOES} currency="EUR" loading={false} />);
    expect(screen.getByLabelText('Pesquisar transacoes')).toBeInTheDocument();
    expect(screen.getByLabelText('Metodo de pagamento')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado do pagamento')).toBeInTheDocument();
  });

  it('transacoes_e_comparativo_sem_hexadecimais_nem_cores_nomeadas', () => {
    const { container } = render(<><TransacoesTable transacoes={TRANSACOES} currency="EUR" loading={false} /><Comparativo resumo={RESUMO} currency="EUR" /></>);
    const html = container.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html).not.toMatch(/text-error/);
  });

  it('o_estado_pago_usa_os_tokens_de_sucesso', () => {
    render(<TransacoesTable transacoes={TRANSACOES} currency="EUR" loading={false} />);
    const pago = within(screen.getByText('Ana Silva').closest('tr')).getByText('Pago');
    expect(pago.className).toContain('var(--success)');
    expect(pago.className).toContain('var(--success-light)');
    const pendente = within(screen.getByText('Carla Dias').closest('tr')).getByText('Pendente');
    expect(pendente.className).toContain('var(--warning)');
  });

  it('o_vazio_das_transacoes_usa_o_EmptyState', () => {
    render(<TransacoesTable transacoes={[]} currency="EUR" loading={false} />);
    expect(screen.getByText('Sem transacoes no periodo')).toHaveClass('font-display');
  });

  it('o_botao_de_actualizar_transacoes_tem_nome_acessivel', async () => {
    montarPagina();
    await paginaPronta();
    expect(screen.getByRole('button', { name: 'Actualizar transacoes' })).toBeInTheDocument();
  });

  it('os_graficos_da_visao_geral_so_usam_cores_var', async () => {
    montarPagina();
    await paginaPronta();
    const cores = coresDosGraficos();
    expect(cores.length).toBeGreaterThan(10);
    expect(cores.filter(c => !c.startsWith('var(--'))).toEqual([]);
  });

  it('o_delta_positivo_do_KpiCard_usa_o_token_de_sucesso', () => {
    render(<KpiCard label="Receita" value={100} delta={5} format="euro" />);
    const delta = screen.getByText('+€5').closest('div');
    expect(delta.className).toContain('var(--success)');
    expect(delta.className).not.toMatch(HEX);
  });
});
