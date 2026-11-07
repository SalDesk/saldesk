import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SalariosTab from '../pages/financial/SalariosTab';
import ComissoesTab from '../pages/financial/ComissoesTab';
import { getSalaryConfig, setSalaryConfig, getSalaryPayments, addSalaryPayment } from '../services/expensesService';
import { listSellerCommissions, markCommissionPaid } from '../services/sellerService';
import { listStaff } from '../services/staffService';
import { MES, eur, cve, norm } from './helpers/financeFixtures';

vi.mock('../services/expensesService', () => ({
  getSalaryConfig: vi.fn(), setSalaryConfig: vi.fn(), getSalaryPayments: vi.fn(), addSalaryPayment: vi.fn(),
}));
vi.mock('../services/sellerService', () => ({
  listSellerCommissions: vi.fn(), markCommissionPaid: vi.fn(), getSellerCommissionPct: vi.fn(() => 10),
}));
vi.mock('../services/staffService', () => ({ listStaff: vi.fn() }));

const MES_ANT = (() => { const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth() - 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
const AGORA = new Date();
const MES_NUM = AGORA.getMonth() + 1;
const ANO_NUM = AGORA.getFullYear();

const COLABORADORES = [
  { id: 's1', name: 'Rui Lopes', role: 'Guia', status: 'active' },
  { id: 's2', name: 'Vera Mendes', role: 'Vendedor de Praia', status: 'active', commission_pct: 12 },
  { id: 's3', name: 'Ex Colega', role: 'Guia', status: 'inactive' },
  { id: 's4', name: 'Pedro Praia', role: 'Vendedor de Praia', status: 'inactive' },
];
const CONFIG = { s1: { base: 1000, food: 50, transport: 30, inps_pct: 15 } };
const COMISSOES = [
  { id: 'c1', amount: 20, status: 'pending', created_at: `${MES}-05T10:00:00Z`, reservations: { units: { name: 'Tour Ilha' } } },
  { id: 'c2', amount: 30, status: 'paid', created_at: `${MES}-06T10:00:00Z`, reservations: { customer_name: 'Ana Silva' } },
  { id: 'c3', amount: 99, status: 'pending', created_at: `${MES_ANT}-05T10:00:00Z`, reservations: { units: { name: 'Do mes passado' } } },
];

let spyErr; let spyWarn;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  listStaff.mockResolvedValue(COLABORADORES);
  getSalaryConfig.mockResolvedValue(CONFIG);
  getSalaryPayments.mockResolvedValue([]);
  listSellerCommissions.mockResolvedValue(COMISSOES);
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

async function montarSalarios(props = {}) {
  const r = render(<SalariosTab currency="EUR" {...props} />);
  await screen.findByText('Colaboradores activos');
  return r;
}
async function montarComissoes(props = {}) {
  const r = render(<ComissoesTab currency="EUR" {...props} />);
  await waitFor(() => expect(screen.queryByText('Vera Mendes') || screen.queryByText('Sem vendedores de praia activos.')).toBeTruthy());
  return r;
}
const kpi = (rotulo) => norm(screen.getByText(rotulo).previousSibling.textContent);
const linha = (nome) => screen.getByText(nome).closest('tr');

/* ───────────────────────── Salarios: caracterizacao ───────────────────────── */

describe('Salarios', () => {
  it('so_colaboradores_activos_e_kpis_de_folha_pagos_e_por_pagar', async () => {
    await montarSalarios();
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Colaborador', 'Salario base', 'Subsidios', 'INPS patronal', 'Custo total/mes', 'Estado', '']);
    expect(screen.queryByText('Ex Colega')).toBeNull();
    expect(kpi('Colaboradores activos')).toBe('2'); /* s1 e s2: s3 e s4 estao inactivos */
  });

  it('custo_total_e_base_mais_subsidios_mais_inps_e_valores_por_omissao', async () => {
    await montarSalarios();
    const rui = linha('Rui Lopes');
    expect(rui).toHaveTextContent(eur(1000));
    expect(rui).toHaveTextContent(`Alim. ${eur(50)} Transp. ${eur(30)}`);
    expect(rui).toHaveTextContent('15%');
    expect(rui).toHaveTextContent(eur(1230)); /* 1000 + 50 + 30 + 150 */
    expect(rui).toHaveTextContent('Guia');
    expect(rui).toHaveTextContent('Pendente');
    const vera = linha('Vera Mendes');
    expect(within(vera).getAllByText('—').length).toBeGreaterThanOrEqual(2); /* base e subsidios */
    expect(vera).toHaveTextContent('15%'); /* inps por omissao */
    expect(vera).toHaveTextContent(eur(0));
    expect(kpi('Folha salarial total/mes')).toBe(eur(1230));
    expect(kpi('Pagos este mes')).toBe('0');
    expect(kpi('Por pagar este mes')).toBe('2');
  });

  it('pago_se_ha_pagamento_do_mes_e_ano_correntes', async () => {
    getSalaryPayments.mockResolvedValue([
      { staffId: 's1', month: MES_NUM, year: ANO_NUM, amount: 1230 },
      { staffId: 's2', month: MES_NUM, year: ANO_NUM - 1, amount: 10 },
    ]);
    await montarSalarios();
    expect(linha('Rui Lopes')).toHaveTextContent('Pago');
    expect(within(linha('Rui Lopes')).queryByText('Pagar')).toBeNull();
    expect(linha('Vera Mendes')).toHaveTextContent('Pendente');
    expect(within(linha('Vera Mendes')).getByText('Pagar')).toBeInTheDocument();
    expect(kpi('Pagos este mes')).toBe('1');
    expect(kpi('Por pagar este mes')).toBe('1');
  });

  it('pagar_chama_addSalaryPayment_com_staffId_mes_ano_e_valor_calculado', async () => {
    addSalaryPayment.mockImplementation(async (p) => p);
    await montarSalarios();
    fireEvent.click(within(linha('Rui Lopes')).getByText('Pagar'));
    expect(screen.getByText('Registar pagamento — Rui Lopes')).toBeInTheDocument();
    expect(screen.getByText('Valor calculado')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText(eur(1230))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
    await waitFor(() => expect(addSalaryPayment).toHaveBeenCalledWith({ staffId: 's1', month: MES_NUM, year: ANO_NUM, amount: 1230 }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(linha('Rui Lopes')).toHaveTextContent('Pago');
    expect(kpi('Pagos este mes')).toBe('1');
  });

  it('editar_salario_chama_setSalaryConfig_com_numeros_e_actualiza_o_custo', async () => {
    setSalaryConfig.mockResolvedValue();
    await montarSalarios();
    fireEvent.click(within(linha('Rui Lopes')).getAllByRole('button')[0]);
    expect(screen.getByText('Salario — Rui Lopes')).toBeInTheDocument();
    const campos = within(screen.getByRole('dialog')).getAllByRole('spinbutton');
    expect(campos.map(c => c.value)).toEqual(['1000', '50', '30', '15']);
    expect(screen.getByText('Default: 15% (Cabo Verde)')).toBeInTheDocument();
    fireEvent.change(campos[0], { target: { value: '2000' } });
    expect(within(screen.getByRole('dialog')).getByText(eur(2380))).toBeInTheDocument(); /* 2000 + 50 + 30 + 300 */
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(setSalaryConfig).toHaveBeenCalledWith('s1', { base: 2000, food: 50, transport: 30, inps_pct: 15 }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(linha('Rui Lopes')).toHaveTextContent(eur(2380));
  });

  it('cancelar_fecha_os_modais_sem_gravar', async () => {
    await montarSalarios();
    fireEvent.click(within(linha('Rui Lopes')).getByText('Pagar'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(linha('Rui Lopes')).getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(addSalaryPayment).not.toHaveBeenCalled();
    expect(setSalaryConfig).not.toHaveBeenCalled();
  });

  it('moeda_cve_converte_os_valores', async () => {
    await montarSalarios({ currency: 'CVE' });
    expect(linha('Rui Lopes')).toHaveTextContent(cve(1230));
    expect(kpi('Folha salarial total/mes')).toBe(cve(1230));
  });

  it('sem_colaboradores_activos_ou_com_listStaff_a_falhar_mostra_o_vazio', async () => {
    listStaff.mockResolvedValue([]);
    await montarSalarios();
    expect(screen.getByText('Sem colaboradores activos.')).toBeInTheDocument();
    cleanup();
    listStaff.mockRejectedValue(new Error('x'));
    await montarSalarios();
    expect(screen.getByText('Sem colaboradores activos.')).toBeInTheDocument();
  });

  it('em_carga_mostra_so_o_spinner', () => {
    getSalaryConfig.mockReturnValue(new Promise(() => {}));
    render(<SalariosTab currency="EUR" />);
    expect(screen.queryByText('Colaboradores activos')).toBeNull();
  });
});

/* ───────────────────────── Comissoes: caracterizacao ───────────────────────── */

describe('Comissoes', () => {
  it('so_vendedor_de_praia_activo_e_so_comissoes_do_mes_corrente', async () => {
    await montarComissoes();
    expect(screen.getByText('Vera Mendes')).toBeInTheDocument();
    expect(screen.queryByText('Pedro Praia')).toBeNull(); /* inactivo */
    expect(screen.queryByText('Rui Lopes')).toBeNull(); /* nao e vendedor */
    expect(screen.getByText('12% comissao · 2 reserva(s) este mes')).toBeInTheDocument();
    expect(screen.queryByText('Do mes passado')).toBeNull();
    const cartao = screen.getByText('Vera Mendes').closest('div.flex.items-start').parentElement;
    expect(within(cartao).getByText(eur(50))).toBeInTheDocument(); /* total */
    expect(within(cartao).getByText(eur(30), { selector: 'p' })).toBeInTheDocument(); /* pago */
    expect(within(cartao).getByText(eur(20), { selector: 'p' })).toBeInTheDocument(); /* pendente */
    ['Total', 'Pago', 'Pendente'].forEach(r => expect(within(cartao).getAllByText(r).length).toBeGreaterThan(0));
    expect(within(cartao).getByText('Tour Ilha')).toBeInTheDocument();
    expect(within(cartao).getByText('Ana Silva')).toBeInTheDocument(); /* sem unidade: nome do cliente */
  });

  it('sem_commission_pct_usa_a_percentagem_global_por_omissao', async () => {
    listStaff.mockResolvedValue([{ id: 's2', name: 'Vera Mendes', role: 'Vendedor de Praia', status: 'active' }]);
    await montarComissoes();
    expect(screen.getByText('10% comissao · 2 reserva(s) este mes')).toBeInTheDocument();
  });

  it('pagar_uma_comissao_chama_markCommissionPaid_e_marca_paga', async () => {
    await montarComissoes();
    const linhaTour = screen.getByText('Tour Ilha').parentElement;
    expect(linhaTour).toHaveTextContent('Pendente');
    fireEvent.click(within(linhaTour).getByText('Pagar'));
    expect(markCommissionPaid).toHaveBeenCalledWith('c1');
    await waitFor(() => expect(screen.getByText('Tour Ilha').parentElement).toHaveTextContent('Pago'));
    expect(screen.queryByText('Registar pag.')).toBeNull(); /* ja nada pendente */
  });

  it('registar_pag_paga_todas_as_pendentes_do_mes', async () => {
    listSellerCommissions.mockResolvedValue([...COMISSOES, { id: 'c4', amount: 5, status: 'pending', created_at: `${MES}-09T10:00:00Z`, reservations: { units: { name: 'Outro' } } }]);
    await montarComissoes();
    fireEvent.click(screen.getByText('Registar pag.'));
    expect(screen.getByText('Pagar comissoes — Vera Mendes')).toBeInTheDocument();
    expect(screen.getByText(eur(25), { selector: 'span.font-bold' })).toBeInTheDocument(); /* 20 + 5 */
    expect(screen.getByText('Esta accao marca todas as comissoes pendentes deste vendedor como pagas.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
    expect(markCommissionPaid.mock.calls.map(c => c[0])).toEqual(['c1', 'c4']);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('cancelar_fecha_o_modal_sem_pagar', async () => {
    await montarComissoes();
    fireEvent.click(screen.getByText('Registar pag.'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(markCommissionPaid).not.toHaveBeenCalled();
  });

  it('comissoes_que_nao_sao_lista_dao_zero_reservas', async () => {
    listSellerCommissions.mockResolvedValue(null);
    await montarComissoes();
    expect(screen.getByText('12% comissao · 0 reserva(s) este mes')).toBeInTheDocument();
  });

  it('sem_vendedores_ou_com_listStaff_a_falhar_mostra_o_vazio', async () => {
    listStaff.mockResolvedValue([COLABORADORES[0]]);
    await montarComissoes();
    expect(screen.getByText('Sem vendedores de praia activos.')).toBeInTheDocument();
    expect(screen.getByText(/na secção Colaboradores/)).toBeInTheDocument();
    cleanup();
    listStaff.mockRejectedValue(new Error('x'));
    await montarComissoes();
    expect(screen.getByText('Sem vendedores de praia activos.')).toBeInTheDocument();
  });

  it('moeda_cve_converte_e_em_carga_mostra_o_spinner', async () => {
    await montarComissoes({ currency: 'CVE' });
    expect(screen.getByText(cve(50))).toBeInTheDocument();
    cleanup();
    listStaff.mockReturnValue(new Promise(() => {}));
    render(<ComissoesTab currency="EUR" />);
    expect(screen.queryByText('Vera Mendes')).toBeNull();
    expect(screen.queryByText('Sem vendedores de praia activos.')).toBeNull();
  });
});

/* ───────────────────────── design system ───────────────────────── */

describe('Salarios e Comissoes com o design system', () => {
  it('a_folha_tem_role_table_e_as_accoes_tem_nome_acessivel', async () => {
    await montarSalarios();
    expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Editar salario - Rui Lopes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagar salario - Rui Lopes' })).toBeInTheDocument();
  });

  it('os_campos_do_SalaryForm_tem_nome_acessivel', async () => {
    await montarSalarios();
    fireEvent.click(screen.getByRole('button', { name: 'Editar salario - Rui Lopes' }));
    const modal = within(screen.getByRole('dialog'));
    ['Salario base (€/mes)', 'Subsidio alimentacao', 'Subsidio transporte', 'INPS patronal (%)'].forEach(r => expect(modal.getByLabelText(r)).toBeInTheDocument());
  });

  it('estados_e_kpis_usam_tokens', async () => {
    getSalaryPayments.mockResolvedValue([{ staffId: 's1', month: MES_NUM, year: ANO_NUM, amount: 1230 }]);
    await montarSalarios();
    expect(within(linha('Rui Lopes')).getByText('Pago').className).toContain('var(--success)');
    expect(within(linha('Vera Mendes')).getByText('Pendente').className).toContain('var(--warning)');
    expect(screen.getByText('Pagos este mes').previousSibling.className).toContain('var(--success)');
    expect(screen.getByText('Por pagar este mes').previousSibling.className).toContain('var(--warning)');
    expect(screen.getByText('Folha salarial total/mes').previousSibling.className).toContain('var(--error)');
  });

  it('os_vazios_usam_EmptyState', async () => {
    listStaff.mockResolvedValue([]);
    await montarSalarios();
    expect(screen.getByText('Sem colaboradores activos.')).toHaveClass('font-display');
    cleanup();
    await montarComissoes();
    expect(screen.getByText('Sem vendedores de praia activos.')).toHaveClass('font-display');
  });

  it('comissoes_usam_tokens_e_a_accao_de_pagar_tem_nome_acessivel', async () => {
    await montarComissoes();
    expect(screen.getByText(eur(30), { selector: 'p' }).className).toContain('var(--success)');
    expect(screen.getByText(eur(20), { selector: 'p' }).className).toContain('var(--warning)');
    expect(screen.getByRole('button', { name: 'Pagar comissao - Tour Ilha' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Registar pag.'));
    expect(screen.getByText(/Comissoes pendentes este mes/).closest('div').className).toContain('var(--warning-light)');
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error', async () => {
    getSalaryPayments.mockResolvedValue([{ staffId: 's1', month: MES_NUM, year: ANO_NUM, amount: 1230 }]);
    await montarSalarios();
    fireEvent.click(screen.getByRole('button', { name: 'Editar salario - Rui Lopes' }));
    let html = document.body.innerHTML;
    cleanup();
    await montarComissoes();
    html += document.body.innerHTML;
    expect(html).not.toMatch(/#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/);
    expect(html).not.toMatch(/(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border)-(?:green|yellow|blue|red)-\d/);
    expect(html).not.toMatch(/text-error/);
  });
});
