import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Staff from '../pages/Staff';
import useAuthStore from '../store/authStore';
import useToastStore from '../store/toastStore';
import { listStaff, createStaffAccount, deleteStaff } from '../services/staffService';
import { listSellerCommissions } from '../services/sellerService';
import { listAssignments } from '../services/assignmentService';
import { listReservations } from '../services/reservationsService';
import { listGroups, getUnreadCount } from '../services/messageService';
import { FUTURE, COLABORADORES, ATRIBUICOES, RESERVAS, GRUPOS } from './helpers/staffFixtures';

vi.mock('socket.io-client', () => ({ io: vi.fn(() => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() })) }));
vi.mock('../services/staffService', () => ({
  listStaff: vi.fn(), createStaff: vi.fn(), updateStaff: vi.fn(), deleteStaff: vi.fn(), createStaffAccount: vi.fn(),
}));
vi.mock('../services/sellerService', () => ({ listSellerCommissions: vi.fn(), markCommissionPaid: vi.fn() }));
vi.mock('../services/assignmentService', () => ({
  listAssignments: vi.fn(), startAssignment: vi.fn(), completeAssignment: vi.fn(), cancelAssignment: vi.fn(), createAssignment: vi.fn(),
}));
vi.mock('../services/reservationsService', () => ({ listReservations: vi.fn() }));
vi.mock('../services/messageService', () => ({
  listMessages: vi.fn(), sendMessage: vi.fn(), getUnreadCount: vi.fn(), listGroups: vi.fn(), createGroup: vi.fn(),
}));
vi.mock('../services/unitsService', () => ({ listUnits: vi.fn() }));

const QUATRO = [...COLABORADORES, { id: 's4', name: 'Pedro Praia', role: 'Guia', status: 'active' }];
const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;

let spyErr; let spyWarn;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  useToastStore.setState({ toasts: [] });
  useAuthStore.setState({ token: 'tok', operator: { id: 'op1', operator_type: 'activity', plan: 'business' } });
  listStaff.mockReset().mockResolvedValue(COLABORADORES);
  createStaffAccount.mockReset();
  deleteStaff.mockReset().mockResolvedValue();
  listSellerCommissions.mockReset().mockResolvedValue([]);
  listAssignments.mockReset().mockResolvedValue(ATRIBUICOES);
  listReservations.mockReset().mockResolvedValue(RESERVAS);
  listGroups.mockReset().mockResolvedValue(GRUPOS);
  getUnreadCount.mockReset().mockResolvedValue(0);
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  useAuthStore.setState({ token: null, operator: null });
  vi.restoreAllMocks();
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

async function montar(primeiro = 'Rui Lopes') {
  const r = render(<MemoryRouter future={FUTURE}><Staff /></MemoryRouter>);
  await screen.findByText(primeiro);
  return r;
}
const cartao = (nome) => screen.getAllByText(nome, { selector: 'p' })[0].closest('div.flex-col');
const toasts = () => useToastStore.getState().toasts.map(t => `${t.type}:${t.message}`);

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Colaboradores: lista', () => {
  it('pesquisa_so_aparece_com_mais_de_3_colaboradores_e_filtra_por_nome_ou_cargo', async () => {
    await montar();
    expect(screen.queryByPlaceholderText('Pesquisar...')).toBeNull();
    cleanup();
    listStaff.mockResolvedValue(QUATRO);
    await montar();
    const pesquisa = screen.getByPlaceholderText('Pesquisar...');
    fireEvent.change(pesquisa, { target: { value: 'vera' } });
    expect(screen.queryByText('Rui Lopes')).toBeNull();
    expect(screen.getAllByText('Vera Mendes').length).toBeGreaterThan(0);
    fireEvent.change(pesquisa, { target: { value: 'INSTRUTOR' } });
    expect(screen.getByText('Ana Tavares')).toBeInTheDocument();
    expect(screen.queryByText('Pedro Praia')).toBeNull();
  });

  it('cartao_mostra_nome_cargo_contactos_trabalhos_avaliacao_e_estado', async () => {
    await montar();
    const rui = cartao('Rui Lopes');
    expect(rui).toHaveTextContent('Guia');
    expect(rui).toHaveTextContent('+238 991 1111');
    expect(rui).toHaveTextContent('rui@x.cv');
    expect(rui).toHaveTextContent('12 trabalhos');
    expect(rui).toHaveTextContent('4.5');
    expect(rui).toHaveTextContent('Activo');
    expect(rui).toHaveTextContent('RL'); /* iniciais sem foto */
    const ana = cartao('Ana Tavares');
    expect(ana).toHaveTextContent('Inactivo');
    expect(ana).toHaveTextContent('0 trabalhos');
    expect(ana).not.toHaveTextContent(/\d\.\d/); /* sem avaliacao */
  });

  it('com_foto_mostra_a_imagem_e_sem_dados_opcionais_nao_rebenta', async () => {
    listStaff.mockResolvedValue([{ id: 's7', name: 'So Nome', role: 'Guia', status: 'active', photo_url: 'http://x.test/f.png', average_rating: null }]);
    await montar('So Nome');
    expect(screen.getByAltText('So Nome')).toHaveAttribute('src', 'http://x.test/f.png');
    expect(cartao('So Nome')).toHaveTextContent('0 trabalhos');
  });

  it('a_conta_a_criar_desactiva_o_botao_e_mostra_A_criar_conta', async () => {
    createStaffAccount.mockReturnValue(new Promise(() => {}));
    await montar();
    fireEvent.click(within(cartao('Vera Mendes')).getByText('Criar conta'));
    const botao = await within(cartao('Vera Mendes')).findByText('A criar conta...');
    expect(botao.closest('button')).toBeDisabled();
  });

  it('falha_ao_criar_conta_mostra_o_erro_do_servidor_ou_o_generico', async () => {
    createStaffAccount.mockRejectedValueOnce({ response: { data: { error: 'Email invalido' } } });
    await montar();
    fireEvent.click(within(cartao('Vera Mendes')).getByText('Criar conta'));
    await waitFor(() => expect(toasts()).toContain('error:Email invalido'));
    createStaffAccount.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(within(cartao('Vera Mendes')).getByText('Criar conta'));
    await waitFor(() => expect(toasts()).toContain('error:Erro ao criar conta'));
  });

  it('subtitulo_e_aviso_so_no_starter_com_2_ou_mais', async () => {
    useAuthStore.setState({ operator: { id: 'op1', operator_type: 'activity', plan: 'starter' } });
    listStaff.mockResolvedValue([COLABORADORES[0]]);
    await montar();
    expect(screen.getByText('1 activo(s) · 1/2 no plano Starter')).toBeInTheDocument();
    expect(screen.queryByText(/Atingiu o limite/)).toBeNull();
    cleanup();
    listStaff.mockResolvedValue(COLABORADORES);
    await montar();
    expect(screen.getByText(/Atingiu o limite de 2 colaboradores/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Fazer upgrade'));
    expect(await screen.findByText('Ver planos de subscricao')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByText('Ver planos de subscricao')).toBeNull());
  });

  it('eliminar_cancelar_fecha_sem_apagar', async () => {
    await montar();
    fireEvent.click(within(cartao('Rui Lopes')).getAllByRole('button')[2]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(deleteStaff).not.toHaveBeenCalled();
  });

  it('vendedores_mostram_zona_percentagem_e_os_totais_a_zero', async () => {
    listStaff.mockResolvedValue([...COLABORADORES, { id: 's5', name: 'Zeca Praia', role: 'Vendedor de Praia', status: 'active' }]);
    await montar();
    const seccao = screen.getByText('Vendedores de Praia').closest('div.mt-6');
    expect(within(seccao).getByText('Espargos')).toBeInTheDocument();
    expect(within(seccao).getByText('Sem zona definida')).toBeInTheDocument();
    expect(within(seccao).getByText('12% comissao')).toBeInTheDocument();
    expect(within(seccao).getByText('10% comissao')).toBeInTheDocument(); /* por omissao */
    expect(within(seccao).getAllByText('€0')).toHaveLength(4); /* mes e por pagar, dois vendedores (decisao 7a) */
    expect(within(seccao).queryByText('Registar pagamento')).toBeNull();
    expect(listSellerCommissions).toHaveBeenCalledWith('s3');
    expect(listSellerCommissions).toHaveBeenCalledWith('s5');
  });

  it('getUnreadCount_a_falhar_nao_rebenta', async () => {
    getUnreadCount.mockRejectedValue(new Error('x'));
    await montar();
    expect(screen.getByRole('heading', { name: 'Colaboradores' })).toBeInTheDocument();
  });
});

/* ───────────────────────── design system ───────────────────────── */

describe('Colaboradores com o design system', () => {
  it('os_quatro_separadores_sao_tabs_com_aria_selected_e_contador_de_nao_lidas', async () => {
    getUnreadCount.mockResolvedValue(3);
    await montar();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'Colaboradores' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Chat/ })).toHaveTextContent('3'));
    fireEvent.click(screen.getByRole('tab', { name: 'Checklist' }));
    expect(await screen.findByText('Checklist do dia')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Checklist' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Colaboradores' })).toHaveAttribute('aria-selected', 'false');
  });

  it('o_contador_mostra_9_mais_acima_de_9_e_nada_a_zero', async () => {
    getUnreadCount.mockResolvedValue(12);
    await montar();
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Chat/ })).toHaveTextContent('9+'));
    cleanup();
    getUnreadCount.mockResolvedValue(0);
    await montar();
    expect(screen.getByRole('tab', { name: 'Chat' })).toBeInTheDocument();
  });

  it('os_botoes_de_icone_e_a_pesquisa_tem_nome_acessivel', async () => {
    listStaff.mockResolvedValue(QUATRO);
    await montar();
    expect(screen.getByRole('button', { name: 'Editar Rui Lopes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar Rui Lopes' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Ferias, documentos e certificacoes/ })).toHaveLength(4);
    expect(screen.getByLabelText('Pesquisar colaboradores')).toBeInTheDocument();
  });

  it('o_vazio_usa_o_EmptyState', async () => {
    listStaff.mockResolvedValue([]);
    render(<MemoryRouter future={FUTURE}><Staff /></MemoryRouter>);
    expect(await screen.findByText('Sem colaboradores registados')).toHaveClass('font-display');
  });

  it('selo_vendedor_e_bolinha_de_estado_usam_o_design_system', async () => {
    await montar();
    expect(within(cartao('Vera Mendes')).getByText('Vendedor').className).toContain('bg-sand-50');
    const rui = cartao('Rui Lopes');
    expect(rui.querySelector('span.rounded-full.border-white').className).toContain('var(--success)');
  });

  it('sem_hexadecimais_cores_nomeadas_text_error_nem_classes_sand_inexistentes', async () => {
    useAuthStore.setState({ operator: { id: 'op1', operator_type: 'activity', plan: 'starter' } });
    await montar();
    const html = document.body.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html).not.toMatch(/(?:text|bg|border)-error/);
    expect(html).not.toMatch(/sand-(?:700|200)/);
  });
});
