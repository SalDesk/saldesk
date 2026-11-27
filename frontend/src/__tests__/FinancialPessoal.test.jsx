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
  { id: 'c3', amount: 99, status: 'pending', created_at: `${MES_ANT}-05T10:00:00Z`, reservations: { units: { name: 'Do mês passado' } } },
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
const kpi = (rotulo) => norm(screen.getByText(rotulo).closest('article').querySelector('p.font-display').textContent);
const linha = (nome) => screen.getByText(nome).closest('tr');

/* ───────────────────────── Salarios: caracterizacao ───────────────────────── */

describe('Salarios', () => {
  it('so_colaboradores_activos_e_kpis_de_folha_pagos_e_por_pagar', async () => {
    await montarSalarios();
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Colaborador', 'Salário base', 'Subsídios', 'INPS patronal', 'Custo total/mês', 'Estado', '']);
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
    expect(kpi('Folha salarial total/mês')).toBe(eur(1230));
    expect(kpi('Pagos este mês')).toBe('0');
    expect(kpi('Por pagar este mês')).toBe('2');
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
    expect(kpi('Pagos este mês')).toBe('1');
    expect(kpi('Por pagar este mês')).toBe('1');
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
    expect(kpi('Pagos este mês')).toBe('1');
  });

  it('editar_salario_chama_setSalaryConfig_com_numeros_e_actualiza_o_custo', async () => {
    setSalaryConfig.mockResolvedValue();
    await montarSalarios();
    fireEvent.click(within(linha('Rui Lopes')).getAllByRole('button')[0]);
    expect(screen.getByText('Salário — Rui Lopes')).toBeInTheDocument();
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
    expect(kpi('Folha salarial total/mês')).toBe(cve(1230));
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

describe('Comissões', () => {
  it('so_vendedor_de_praia_activo_e_so_comissoes_do_mes_corrente', async () => {
    await montarComissoes();
    expect(screen.getByText('Vera Mendes')).toBeInTheDocument();
    expect(screen.queryByText('Pedro Praia')).toBeNull(); /* inactivo */
    expect(screen.queryByText('Rui Lopes')).toBeNull(); /* nao e vendedor */
    expect(screen.getByText('12% comissão · 2 reserva(s) este mês')).toBeInTheDocument();
    expect(screen.queryByText('Do mês passado')).toBeNull();
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
    expect(screen.getByText('10% comissão · 2 reserva(s) este mês')).toBeInTheDocument();
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
    expect(screen.getByText('Pagar comissões — Vera Mendes')).toBeInTheDocument();
    expect(screen.getByText(eur(25), { selector: 'span.font-bold' })).toBeInTheDocument(); /* 20 + 5 */
    expect(screen.getByText('Esta acção marca todas as comissões pendentes deste vendedor como pagas.')).toBeInTheDocument();
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
    expect(screen.getByText('12% comissão · 0 reserva(s) este mês')).toBeInTheDocument();
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

describe('Salários e Comissões com o design system', () => {
  it('a_folha_tem_role_table_e_as_accoes_tem_nome_acessivel', async () => {
    await montarSalarios();
    expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Editar salário - Rui Lopes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagar salário - Rui Lopes' })).toBeInTheDocument();
  });

  it('os_campos_do_SalaryForm_tem_nome_acessivel', async () => {
    await montarSalarios();
    fireEvent.click(screen.getByRole('button', { name: 'Editar salário - Rui Lopes' }));
    const modal = within(screen.getByRole('dialog'));
    ['Salário base (€/mês)', 'Subsídio alimentação', 'Subsídio transporte', 'INPS patronal (%)'].forEach(r => expect(modal.getByLabelText(r)).toBeInTheDocument());
  });

  it('estados_e_kpis_usam_tokens', async () => {
    getSalaryPayments.mockResolvedValue([{ staffId: 's1', month: MES_NUM, year: ANO_NUM, amount: 1230 }]);
    await montarSalarios();
    expect(within(linha('Rui Lopes')).getByText('Pago').className).toContain('var(--success)');
    expect(within(linha('Vera Mendes')).getByText('Pendente').className).toContain('var(--warning)');
    /* o tom vem da pequena caixa do MareStat: turquesa = pagos, areia = por pagar, sem marca = folha */
    const marca = (r) => screen.getByText(r).closest('article').querySelector('[data-mare-stat-tint]');
    expect(marca('Pagos este mês').className).toMatch(/turquoise/);
    expect(marca('Por pagar este mês').className).toMatch(/sand/);
    expect(marca('Folha salarial total/mês')).toBeNull();
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
    expect(screen.getByRole('button', { name: 'Pagar comissão - Tour Ilha' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Registar pag.'));
    expect(screen.getByText(/Comissões pendentes este mês/).closest('div').className).toContain('var(--warning-light)');
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error', async () => {
    getSalaryPayments.mockResolvedValue([{ staffId: 's1', month: MES_NUM, year: ANO_NUM, amount: 1230 }]);
    await montarSalarios();
    fireEvent.click(screen.getByRole('button', { name: 'Editar salário - Rui Lopes' }));
    let html = document.body.innerHTML;
    cleanup();
    await montarComissoes();
    html += document.body.innerHTML;
    expect(html).not.toMatch(/#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/);
    expect(html).not.toMatch(/(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border)-(?:green|yellow|blue|red)-\d/);
    expect(html).not.toMatch(/text-error/);
  });
});

/* ───────────────────────── estilo Mare ───────────────────────── */

const tileDe = (rotulo) => screen.getByText(rotulo).closest('article');

describe('Salários no estilo Mare', () => {
  it('os_quatro_numeros_sao_MareStat_e_a_lista_esta_num_cartao_Mare', async () => {
    await montarSalarios();
    ['Colaboradores activos', 'Folha salarial total/mês', 'Pagos este mês', 'Por pagar este mês'].forEach((r) => {
      expect(tileDe(r)).toHaveClass('bg-white', 'rounded-[18px]', 'border-mare-card');
      expect(tileDe(r).querySelector('p.font-display')).not.toBeNull();
    });
    expect(tileDe('Colaboradores activos').querySelector('p.font-display')).toHaveTextContent('2');
    expect(screen.getByRole('table').closest('.border-mare-card')).toHaveClass('bg-white', 'rounded-[18px]');
  });

  it('valores_sao_mono_o_estado_e_Badge_e_as_accoes_respeitam_o_toque', async () => {
    await montarSalarios();
    const rui = linha('Rui Lopes');
    expect(within(rui).getByText(eur(1000))).toHaveClass('font-mono', 'tabular-nums');
    expect(within(rui).getByText(eur(1230))).toHaveClass('font-mono', 'tabular-nums');
    expect(within(rui).getByText('15%')).toHaveClass('font-mono', 'tabular-nums');
    expect(within(rui).getByText('Pendente')).toHaveClass('app:rounded-full', 'font-semibold');
    expect(within(rui).getByRole('button', { name: 'Editar salário - Rui Lopes' })).toHaveClass('min-h-11', 'min-w-11', 'rounded-full');
  });

  it('as_caixas_do_formulario_e_do_pagamento_sao_interiores_Mare', async () => {
    await montarSalarios();
    fireEvent.click(within(linha('Rui Lopes')).getByRole('button', { name: 'Editar salário - Rui Lopes' }));
    const total = screen.getByText('Custo total mensal').parentElement;
    expect(total).toHaveClass('rounded-[14px]', 'border-mare-card', 'bg-mare-head');
    expect(within(total).getByText(eur(1230))).toHaveClass('font-mono', 'tabular-nums');
    cleanup();
    await montarSalarios();
    fireEvent.click(within(linha('Rui Lopes')).getByRole('button', { name: 'Pagar salário - Rui Lopes' }));
    const calculado = within(screen.getByRole('dialog')).getByText(eur(1230)).parentElement;
    expect(calculado).toHaveClass('rounded-[14px]', 'border-mare-card', 'bg-mare-head');
  });
});

describe('Salarios: acertos finais', () => {
  it('os_quadros_passam_a_uma_coluna_abaixo_de_420px', async () => {
    await montarSalarios();
    const grelha = tileDe('Colaboradores activos').parentElement;
    expect(grelha).toHaveClass('grid-cols-1', 'min-[420px]:grid-cols-2', 'lg:grid-cols-4');
    expect(grelha).not.toHaveClass('grid-cols-2');
  });
});

describe('Comissões no estilo Mare', () => {
  it('cada_vendedor_e_um_cartao_Mare_e_os_numeros_sao_mono', async () => {
    await montarComissoes();
    const cartao = screen.getByText('Vera Mendes').closest('.border-mare-card');
    expect(cartao).toHaveClass('bg-white', 'rounded-[18px]', 'p-[22px]');
    const total = within(cartao).getByText(eur(50));
    expect(total).toHaveClass('font-mono', 'tabular-nums');
    expect(within(cartao).getAllByText(eur(30))[0]).toHaveClass('font-mono', 'tabular-nums');
  });

  it('o_estado_e_Badge_o_pagamento_tem_altura_de_toque_e_o_vazio_e_um_cartao', async () => {
    await montarComissoes();
    const cartao = screen.getByText('Vera Mendes').closest('.border-mare-card');
    expect(within(cartao).getAllByText('Pago').find(e => e.className.includes('app:rounded-full'))).toHaveClass('font-semibold');
    expect(within(cartao).getByRole('button', { name: 'Pagar comissão - Tour Ilha' })).toHaveClass('min-h-11', 'md:min-h-9', 'focus-visible:ring-sand-500');
    expect(within(cartao).getByRole('button', { name: 'Registar pag.' })).toHaveClass('min-h-11', 'md:min-h-0');
    cleanup();
    listStaff.mockResolvedValue([]);
    await montarComissoes();
    expect(screen.getByText('Sem vendedores de praia activos.').closest('.border-mare-card')).toHaveClass('rounded-[18px]');
  });

  it('a_caixa_do_valor_pendente_do_modal_e_interior_Mare', async () => {
    await montarComissoes();
    fireEvent.click(screen.getByRole('button', { name: 'Registar pag.' }));
    const caixa = within(screen.getByRole('dialog')).getByText(eur(20)).closest('div');
    expect(caixa).toHaveClass('rounded-[14px]');
  });
});
