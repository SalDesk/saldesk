import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Financial from '../pages/Financial';
import ReceitasManuaisTab from '../pages/financial/ReceitasManuaisTab';
import * as fin from '../services/financeiroService';
import * as exp from '../services/expensesService';
import * as seller from '../services/sellerService';
import { listStaff } from '../services/staffService';
import { MES, FUTURE, STAFF, RESUMO, RECEITA, UNIDADES, CLIENTES, CANAIS, TRANSACOES, eur, cve, fmtDate } from './helpers/financeFixtures';

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

const MES_ANT = (() => { const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth() - 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();

const RECEITAS = [
  { id: 'r1', category: 'Venda ao balcao', amount: 120, date: `${MES}-01`, notes: 'Feira' },
  { id: 'r2', category: 'Merchandising', amount: 80, date: `${MES}-10`, notes: '' },
  { id: 'r3', category: 'Venda ao balcao', amount: 40, date: `${MES}-15`, notes: 'Extra' },
  { id: 'r4', category: 'Patrocinio', amount: 500, date: `${MES_ANT}-20`, notes: '' },
];

let spyErr; let spyWarn;
beforeEach(() => {
  localStorage.clear();
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  fin.getReceitasManuais.mockResolvedValue(RECEITAS);
  fin.getResumo.mockResolvedValue(RESUMO);
  fin.getReceita.mockResolvedValue(RECEITA);
  fin.getUnidades.mockResolvedValue(UNIDADES);
  fin.getTopClientes.mockResolvedValue(CLIENTES);
  fin.getCanais.mockResolvedValue(CANAIS);
  fin.getTransacoes.mockResolvedValue(TRANSACOES);
  exp.listExpenses.mockResolvedValue([]);
  seller.listSellerCommissions.mockResolvedValue([]);
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

async function montar(props = {}) {
  const r = render(<ReceitasManuaisTab currency="EUR" onChange={() => {}} {...props} />);
  await screen.findByText('Registar receita');
  await waitFor(() => expect(screen.queryByText('Sem receitas manuais no periodo seleccionado.') || screen.queryByRole('table')).toBeTruthy());
  return r;
}
const linhas = () => screen.getAllByRole('row').slice(1);
const categoriasDaLista = () => linhas().map(l => within(l).getAllByRole('cell')[1].textContent);

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Receitas manuais: lista e filtros', () => {
  it('lista_so_o_mes_filtrado_ordenada_por_data_decrescente', async () => {
    await montar();
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Data', 'Categoria', 'Valor', 'Notas', '']);
    expect(categoriasDaLista()).toEqual(['Venda ao balcao', 'Merchandising', 'Venda ao balcao']); /* 15, 10, 01 */
    const feira = screen.getByText('Feira').closest('tr');
    expect(feira).toHaveTextContent(fmtDate(`${MES}-01`));
    expect(feira).toHaveTextContent(`+ ${eur(120)}`);
  });

  it('filtra_por_mes_e_por_categoria', async () => {
    await montar();
    const mes = document.querySelector('input[type="month"]');
    const categoria = screen.getAllByRole('combobox')[0];
    fireEvent.change(categoria, { target: { value: 'Merchandising' } });
    expect(categoriasDaLista()).toEqual(['Merchandising']);
    fireEvent.change(categoria, { target: { value: '' } });
    fireEvent.change(mes, { target: { value: MES_ANT } });
    expect(categoriasDaLista()).toEqual(['Patrocinio']);
    expect(Array.from(categoria.options).map(o => o.textContent).slice(0, 3)).toEqual(['Todas as categorias', 'Venda ao balcao', 'Comissao de parceiro']);
  });

  it('total_e_cartoes_por_categoria_na_moeda_escolhida', async () => {
    await montar();
    expect(screen.getByText(eur(240), { selector: 'span.font-bold' })).toBeInTheDocument(); /* 120 + 80 + 40 */
    expect(screen.getAllByText(eur(160)).length).toBeGreaterThan(0); /* Venda ao balcao 120 + 40 */
    cleanup();
    await montar({ currency: 'CVE' });
    expect(screen.getByText(cve(240), { selector: 'span.font-bold' })).toBeInTheDocument();
    expect(screen.getByText('Feira').closest('tr')).toHaveTextContent(`+ ${cve(120)}`);
  });

  it('sem_receitas_mostra_o_vazio', async () => {
    fin.getReceitasManuais.mockResolvedValue([]);
    await montar();
    expect(screen.getByText('Sem receitas manuais no periodo seleccionado.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('em_carga_mostra_o_spinner', () => {
    fin.getReceitasManuais.mockReturnValue(new Promise(() => {}));
    render(<ReceitasManuaisTab currency="EUR" />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('Sem receitas manuais no periodo seleccionado.')).toBeNull();
  });
});

describe('Receitas manuais: registar, editar e eliminar', () => {
  it('registar_chama_createReceitaManual_acrescenta_e_avisa_onChange', async () => {
    const onChange = vi.fn();
    fin.createReceitaManual.mockResolvedValue({ id: 'novo', category: 'Venda ao balcao', amount: 50, date: `${MES}-20`, notes: 'Nova' });
    await montar({ onChange });
    fireEvent.click(screen.getByText('Registar receita'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '50' } });
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: `${MES}-20` } });
    fireEvent.change(screen.getByRole('dialog').querySelector('textarea'), { target: { value: 'Nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registar' }));
    await waitFor(() => expect(fin.createReceitaManual).toHaveBeenCalledTimes(1));
    expect(fin.createReceitaManual).toHaveBeenCalledWith(expect.objectContaining({
      category: 'Venda ao balcao', amount: 50, currency: 'EUR', date: `${MES}-20`, notes: 'Nova', receipt_url: '',
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Nova')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('editar_chama_updateReceitaManual_com_o_id_substitui_e_avisa_onChange', async () => {
    const onChange = vi.fn();
    fin.updateReceitaManual.mockResolvedValue({ ...RECEITAS[0], amount: 150 });
    await montar({ onChange });
    fireEvent.click(within(screen.getByText('Feira').closest('tr')).getAllByRole('button')[0]);
    expect(screen.getByText('Editar receita', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(120);
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(fin.updateReceitaManual).toHaveBeenCalledWith('r1', expect.objectContaining({ id: 'r1', category: 'Venda ao balcao', amount: 150 })));
    expect(await screen.findByText(`+ ${eur(150)}`)).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('eliminar_pede_confirmacao_chama_deleteReceitaManual_e_avisa_onChange', async () => {
    const onChange = vi.fn();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fin.deleteReceitaManual.mockResolvedValue();
    await montar({ onChange });
    const botoes = () => within(screen.getByText('Feira').closest('tr')).getAllByRole('button');
    fireEvent.click(botoes()[1]);
    expect(confirmar).toHaveBeenCalledWith('Eliminar esta receita?');
    expect(fin.deleteReceitaManual).not.toHaveBeenCalled();
    confirmar.mockReturnValue(true);
    fireEvent.click(botoes()[1]);
    await waitFor(() => expect(fin.deleteReceitaManual).toHaveBeenCalledWith('r1'));
    await waitFor(() => expect(screen.queryByText('Feira')).toBeNull());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('cancelar_fecha_sem_gravar', async () => {
    await montar();
    fireEvent.click(screen.getByText('Registar receita'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fin.createReceitaManual).not.toHaveBeenCalled();
  });

  it('na_pagina_um_CRUD_repete_getResumo_e_a_receita_do_ano', async () => {
    fin.createReceitaManual.mockResolvedValue({ id: 'novo', category: 'Venda ao balcao', amount: 5, date: `${MES}-20`, notes: '' });
    render(<MemoryRouter future={FUTURE}><Financial /></MemoryRouter>);
    await screen.findByText('Carla Dias');
    fireEvent.click(screen.getAllByText('Receitas Manuais')[0]);
    fireEvent.click(await screen.findByText('Registar receita'));
    expect(fin.getResumo).toHaveBeenCalledTimes(1);
    const anual = () => fin.getReceita.mock.calls.filter(c => c[2] === 'month').length;
    expect(anual()).toBe(1);
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registar' }));
    await waitFor(() => expect(fin.getResumo).toHaveBeenCalledTimes(2));
    expect(anual()).toBe(2);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await screen.findByText('Registar receita');
  });
});

/* ───────────────────────── design system ───────────────────────── */

describe('Receitas manuais com o design system', () => {
  it('a_tabela_tem_role_table_e_as_accoes_tem_nome_acessivel', async () => {
    await montar();
    expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Editar receita - Merchandising' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar receita - Merchandising' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Eliminar receita - / })).toHaveLength(3);
  });

  it('os_filtros_e_os_campos_do_modal_tem_nome_acessivel', async () => {
    await montar();
    expect(screen.getByLabelText('Mes')).toHaveAttribute('type', 'month');
    expect(screen.getByLabelText('Categoria').tagName).toBe('SELECT');
    fireEvent.click(screen.getByText('Registar receita'));
    const modal = within(screen.getByRole('dialog'));
    ['Categoria', 'Moeda', 'Valor', 'Data', 'Notas', 'URL do comprovativo'].forEach(r => expect(modal.getByLabelText(r)).toBeInTheDocument());
  });

  it('valores_a_verde_e_vazio_com_EmptyState', async () => {
    await montar();
    const feira = screen.getByText('Feira').closest('tr');
    expect(within(feira).getByText(`+ ${eur(120)}`).className).toContain('var(--success)');
    cleanup();
    fin.getReceitasManuais.mockResolvedValue([]);
    await montar();
    expect(screen.getByText('Sem receitas manuais no periodo seleccionado.')).toHaveClass('font-display');
  });

  it('cores_dos_cartoes_de_categoria_sao_tokens_e_sem_hexadecimais_ou_nomeadas', async () => {
    await montar();
    const bolas = [...document.querySelectorAll('div.rounded-full[style]')];
    expect(bolas.length).toBe(2);
    bolas.forEach(b => expect(b.getAttribute('style')).toContain('var(--'));
    fireEvent.click(screen.getByText('Registar receita'));
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/);
    expect(html).not.toMatch(/(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border)-(?:green|yellow|blue|red)-\d/);
    expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/text-error/);
  });
});
