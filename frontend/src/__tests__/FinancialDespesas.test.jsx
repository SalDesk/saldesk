import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DespesasTab from '../pages/financial/DespesasTab';
import { CAT_COLORS } from '../pages/financial/shared';
import { listExpenses, addExpenseLocal, updateExpenseLocal, deleteExpenseLocal } from '../services/expensesService';
import { coresDosGraficos, dadosDoGrafico } from './helpers/rechartsMock';
import { MES, STAFF, eur, cve, fmtDate } from './helpers/financeFixtures';

vi.mock('../services/expensesService', () => ({
  listExpenses: vi.fn(), addExpenseLocal: vi.fn(), updateExpenseLocal: vi.fn(), deleteExpenseLocal: vi.fn(),
}));
vi.mock('recharts', async () => (await import('./helpers/rechartsMock')).makeRechartsMock());

const MES_ANT = (() => { const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth() - 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
const HOJE = new Date().toISOString().slice(0, 10);

const DESPESAS = [
  { id: 'e1', category: 'Renda', amount: 300, date: `${MES}-01`, staff_id: '', is_recurring: false, notes: 'Escritorio' },
  { id: 'e2', category: 'Combustivel', amount: 100, date: `${MES}-10`, staff_id: '', is_recurring: true, notes: '' },
  { id: 'e3', category: 'Salarios', amount: 200, date: `${MES}-05`, staff_id: 's1', is_recurring: false, notes: 'Julho' },
  { id: 'e4', category: 'Renda', amount: 250, date: `${MES_ANT}-20`, staff_id: '', is_recurring: false, notes: '' },
];

let spyErr; let spyWarn;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  listExpenses.mockResolvedValue(DESPESAS);
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
  const r = render(<DespesasTab currency="EUR" staff={STAFF} {...props} />);
  await screen.findByText('Registar despesa');
  await waitFor(() => expect(document.querySelector('[role="status"], .animate-spin')).toBeNull());
  return r;
}
const linhas = () => screen.getAllByRole('row').slice(1);
const categoriasDaLista = () => linhas().map(l => within(l).getAllByRole('cell')[1].textContent);
function filtros() {
  return {
    mes: document.querySelector('input[type="month"]'),
    categoria: screen.getAllByRole('combobox')[0],
  };
}
/* o interruptor funciona antes (botao + texto) e depois (Toggle) da migracao */
function interruptor() {
  const raiz = screen.getByText('Despesa recorrente mensal').parentElement.parentElement;
  return raiz.querySelector('button[type="button"]');
}
function campo(placeholderOuTipo) {
  return document.querySelector(placeholderOuTipo);
}

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Despesas: lista e filtros', () => {
  it('lista_so_o_mes_filtrado_ordenada_por_data_decrescente', async () => {
    await montar();
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Data', 'Categoria', 'Colaborador', 'Valor', 'Recorrente', 'Notas', '']);
    expect(categoriasDaLista()).toEqual(['Combustivel', 'Salarios', 'Renda']); /* 10, 05, 01 */
    const renda = screen.getByText('Escritorio').closest('tr');
    expect(renda).toHaveTextContent(fmtDate(`${MES}-01`));
    expect(renda).toHaveTextContent(`- ${eur(300)}`);
    expect(screen.getByText('Julho').closest('tr')).toHaveTextContent('Rui Lopes');
    expect(linhas().find(l => within(l).getAllByRole('cell')[1].textContent === 'Combustivel')).toHaveTextContent('Recorrente');
  });

  it('muda_de_mes_e_filtra_por_categoria', async () => {
    await montar();
    const { mes, categoria } = filtros();
    fireEvent.change(categoria, { target: { value: 'Renda' } });
    expect(categoriasDaLista()).toEqual(['Renda']);
    fireEvent.change(mes, { target: { value: MES_ANT } });
    expect(linhas()[0]).toHaveTextContent(fmtDate(`${MES_ANT}-20`));
    fireEvent.change(categoria, { target: { value: 'Seguro viatura' } });
    expect(screen.getByText('Sem despesas no periodo seleccionado.')).toBeInTheDocument();
    expect(Array.from(categoria.options).map(o => o.textContent).slice(0, 3)).toEqual(['Todas as categorias', 'Salarios', 'Comissoes vendedores']);
  });

  it('total_e_resumo_por_categoria_com_percentagens', async () => {
    await montar();
    expect(screen.getByText(eur(600), { selector: 'span.font-bold' })).toBeInTheDocument(); /* 300 + 100 + 200 */
    const resumo = screen.getAllByText('Renda', { selector: 'p' })[0].closest('div.bg-white, div');
    expect(resumo).toBeTruthy();
    /* detalhe: Renda 50.0%, Salarios 33.3%, Combustivel 16.7% */
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText('33.3%')).toBeInTheDocument();
    expect(screen.getByText('16.7%')).toBeInTheDocument();
    expect(screen.getByText('Despesas por categoria')).toBeInTheDocument();
    expect(screen.getByText('Detalhes')).toBeInTheDocument();
  });

  it('grafico_de_pizza_com_as_categorias_por_ordem_de_valor', async () => {
    await montar();
    expect(dadosDoGrafico('pie')).toEqual([
      { name: 'Renda', total: 300 }, { name: 'Salarios', total: 200 }, { name: 'Combustivel', total: 100 },
    ]);
  });

  it('o_total_fica_em_euro_e_as_linhas_seguem_a_moeda', async () => {
    await montar({ currency: 'CVE' });
    expect(screen.getByText(eur(600), { selector: 'span.font-bold' })).toBeInTheDocument();
    expect(screen.getByText('Escritorio').closest('tr')).toHaveTextContent(`- ${cve(300)}`);
  });

  it('alerta_de_recorrentes_em_falta_este_mes', async () => {
    await montar();
    expect(screen.getByText('Despesas recorrentes em falta este mes')).toBeInTheDocument();
    expect(within(screen.getByText('Despesas recorrentes em falta este mes').closest('div')).getByText('Combustivel')).toBeInTheDocument();
    /* com uma despesa normal da mesma categoria no mes o alerta desaparece */
    cleanup();
    listExpenses.mockResolvedValue([...DESPESAS, { id: 'e5', category: 'Combustivel', amount: 40, date: `${MES}-12`, is_recurring: false }]);
    await montar();
    expect(screen.queryByText('Despesas recorrentes em falta este mes')).toBeNull();
  });

  it('sem_despesas_mostra_o_vazio', async () => {
    listExpenses.mockResolvedValue([]);
    await montar();
    expect(screen.getByText('Sem despesas no periodo seleccionado.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('em_carga_mostra_o_spinner', async () => {
    listExpenses.mockReturnValue(new Promise(() => {}));
    render(<DespesasTab currency="EUR" staff={STAFF} />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('Sem despesas no periodo seleccionado.')).toBeNull();
    expect(screen.getByText('Registar despesa')).toBeInTheDocument();
  });
});

describe('Despesas: registar, editar e eliminar', () => {
  it('registar_chama_addExpenseLocal_com_valor_numerico_e_acrescenta', async () => {
    addExpenseLocal.mockResolvedValue({ id: 'novo', category: 'Salarios', amount: 50, date: `${MES}-15`, notes: 'Extra' });
    await montar();
    fireEvent.click(screen.getByText('Registar despesa'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '50' } });
    fireEvent.change(campo('input[type="date"]'), { target: { value: `${MES}-15` } });
    fireEvent.change(screen.getAllByRole('textbox').find(t => t.tagName === 'TEXTAREA'), { target: { value: 'Extra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registar' }));
    await waitFor(() => expect(addExpenseLocal).toHaveBeenCalledTimes(1));
    expect(addExpenseLocal).toHaveBeenCalledWith(expect.objectContaining({
      category: 'Salarios', amount: 50, currency: 'EUR', date: `${MES}-15`, staff_id: '', is_recurring: false, notes: 'Extra', receipt_url: '', id: expect.any(String),
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Extra')).toBeInTheDocument();
  });

  it('o_campo_colaborador_so_aparece_em_salarios_e_comissoes_com_staff', async () => {
    await montar();
    fireEvent.click(screen.getByText('Registar despesa'));
    expect(screen.getByText('Colaborador', { selector: 'label' })).toBeInTheDocument(); /* categoria por omissao: Salarios */
    const categoria = within(screen.getByRole('dialog')).getAllByRole('combobox')[0];
    fireEvent.change(categoria, { target: { value: 'Renda' } });
    expect(screen.queryByText('Colaborador', { selector: 'label' })).toBeNull();
    fireEvent.change(categoria, { target: { value: 'Comissoes vendedores' } });
    expect(screen.getByText('Colaborador', { selector: 'label' })).toBeInTheDocument();
  });

  it('sem_colaboradores_o_campo_colaborador_nao_aparece', async () => {
    await montar({ staff: [] });
    fireEvent.click(screen.getByText('Registar despesa'));
    expect(screen.queryByText('Colaborador', { selector: 'label' })).toBeNull();
  });

  it('o_interruptor_recorrente_vai_no_pedido', async () => {
    addExpenseLocal.mockResolvedValue({ id: 'novo', category: 'Salarios', amount: 7, date: `${MES}-15`, is_recurring: true });
    await montar();
    fireEvent.click(screen.getByText('Registar despesa'));
    fireEvent.click(interruptor());
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registar' }));
    await waitFor(() => expect(addExpenseLocal).toHaveBeenCalledWith(expect.objectContaining({ is_recurring: true, amount: 7 })));
  });

  it('cancelar_fecha_sem_gravar', async () => {
    await montar();
    fireEvent.click(screen.getByText('Registar despesa'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(addExpenseLocal).not.toHaveBeenCalled();
  });

  it('editar_chama_updateExpenseLocal_com_o_id_e_substitui_a_linha', async () => {
    updateExpenseLocal.mockResolvedValue({ ...DESPESAS[0], amount: 350 });
    await montar();
    const botoes = within(screen.getByText('Escritorio').closest('tr')).getAllByRole('button');
    fireEvent.click(botoes[0]);
    expect(screen.getByText('Editar despesa', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(300);
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '350' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateExpenseLocal).toHaveBeenCalledWith('e1', expect.objectContaining({ id: 'e1', category: 'Renda', amount: 350 })));
    expect(await screen.findByText(`- ${eur(350)}`)).toBeInTheDocument();
  });

  it('eliminar_pede_confirmacao_e_so_apaga_se_confirmar', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    deleteExpenseLocal.mockResolvedValue();
    await montar();
    const botoes = () => within(screen.getByText('Escritorio').closest('tr')).getAllByRole('button');
    fireEvent.click(botoes()[1]);
    expect(confirmar).toHaveBeenCalledWith('Eliminar esta despesa?');
    expect(deleteExpenseLocal).not.toHaveBeenCalled();
    expect(screen.getByText('Escritorio')).toBeInTheDocument();
    confirmar.mockReturnValue(true);
    fireEvent.click(botoes()[1]);
    await waitFor(() => expect(deleteExpenseLocal).toHaveBeenCalledWith('e1'));
    await waitFor(() => expect(screen.queryByText('Escritorio')).toBeNull());
  });
});

/* ───────────────────────── design system ───────────────────────── */

describe('Despesas com o design system', () => {
  it('a_tabela_tem_role_table_e_as_accoes_tem_nome_acessivel', async () => {
    await montar();
    expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Editar despesa - Renda' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar despesa - Renda' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Editar despesa - / })).toHaveLength(3);
  });

  it('os_filtros_tem_nome_acessivel', async () => {
    await montar();
    expect(screen.getByLabelText('Mes')).toHaveAttribute('type', 'month');
    expect(screen.getByLabelText('Categoria').tagName).toBe('SELECT');
  });

  it('os_campos_do_modal_tem_nome_acessivel', async () => {
    await montar();
    fireEvent.click(screen.getByText('Registar despesa'));
    const modal = within(screen.getByRole('dialog'));
    ['Categoria', 'Moeda', 'Valor', 'Data', 'Colaborador', 'Notas', 'URL do comprovativo'].forEach(r => expect(modal.getByLabelText(r)).toBeInTheDocument());
  });

  it('o_interruptor_recorrente_e_o_Toggle_do_design_system', async () => {
    await montar();
    fireEvent.click(screen.getByText('Registar despesa'));
    expect(screen.getByText('Despesa recorrente mensal')).toHaveClass('font-display');
  });

  it('as_cores_da_paleta_e_do_grafico_sao_tokens', async () => {
    expect(CAT_COLORS).toHaveLength(14);
    expect(CAT_COLORS.filter(c => !c.startsWith('var(--'))).toEqual([]);
    await montar();
    const cores = coresDosGraficos();
    expect(cores.length).toBe(3);
    expect(cores.filter(c => !c.startsWith('var(--'))).toEqual([]);
  });

  it('os_vazios_e_o_alerta_usam_tokens_e_EmptyState', async () => {
    await montar();
    const alerta = screen.getByText('Despesas recorrentes em falta este mes').closest('div').parentElement;
    expect(alerta.className).toContain('var(--warning-light)');
    cleanup();
    listExpenses.mockResolvedValue([]);
    await montar();
    expect(screen.getByText('Sem despesas no periodo seleccionado.')).toHaveClass('font-display');
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error_nem_com_o_modal_aberto', async () => {
    await montar();
    fireEvent.click(screen.getByText('Registar despesa'));
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/);
    expect(html).not.toMatch(/(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border)-(?:green|yellow|blue|red)-\d/);
    /* o asterisco de obrigatorio e do ui/Input (partilhado) */
    expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/text-error/);
  });
});
