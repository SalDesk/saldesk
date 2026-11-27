import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Staff from '../pages/Staff';
import useAuthStore from '../store/authStore';
import useToastStore from '../store/toastStore';
import { listStaff, createStaffAccount, deleteStaff } from '../services/staffService';
import { listSellerCommissions, markCommissionPaid } from '../services/sellerService';
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
    listStaff.mockResolvedValue([{ id: 's7', name: 'Só Nome', role: 'Guia', status: 'active', photo_url: 'http://x.test/f.png', average_rating: null }]);
    await montar('Só Nome');
    expect(screen.getByAltText('Só Nome')).toHaveAttribute('src', 'http://x.test/f.png');
    expect(cartao('Só Nome')).toHaveTextContent('0 trabalhos');
  });

  it('a_conta_a_criar_desactiva_o_botao_e_mostra_A_criar_conta', async () => {
    createStaffAccount.mockReturnValue(new Promise(() => {}));
    await montar();
    fireEvent.click(within(cartao('Vera Mendes')).getByText('Criar conta'));
    const botao = await within(cartao('Vera Mendes')).findByText('A criar conta...');
    expect(botao.closest('button')).toBeDisabled();
  });

  it('falha_ao_criar_conta_mostra_o_erro_do_servidor_ou_o_generico', async () => {
    createStaffAccount.mockRejectedValueOnce({ response: { data: { error: 'Email inválido' } } });
    await montar();
    fireEvent.click(within(cartao('Vera Mendes')).getByText('Criar conta'));
    await waitFor(() => expect(toasts()).toContain('error:Email inválido'));
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
    expect(await screen.findByText('Ver planos de subscrição')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByText('Ver planos de subscrição')).toBeNull());
  });

  it('eliminar_cancelar_fecha_sem_apagar', async () => {
    await montar();
    fireEvent.click(within(cartao('Rui Lopes')).getAllByRole('button')[2]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(deleteStaff).not.toHaveBeenCalled();
  });

  it('vendedores_mostram_zona_percentagem_e_sem_comissoes_os_totais_a_zero', async () => {
    listStaff.mockResolvedValue([...COLABORADORES, { id: 's5', name: 'Zeca Praia', role: 'Vendedor de Praia', status: 'active' }]);
    await montar();
    const seccao = screen.getByText('Vendedores de Praia').closest('div.mt-6');
    expect(within(seccao).getByText('Espargos')).toBeInTheDocument();
    expect(within(seccao).getByText('Sem zona definida')).toBeInTheDocument();
    expect(within(seccao).getByText('12% comissão')).toBeInTheDocument();
    expect(within(seccao).getByText('10% comissão')).toBeInTheDocument(); /* por omissao */
    await waitFor(() => expect(listSellerCommissions).toHaveBeenCalledTimes(2));
    expect(within(seccao).getAllByText('€0')).toHaveLength(4); /* mes e por pagar, dois vendedores */
    expect(within(seccao).queryByText('Registar pagamento')).toBeNull();
    expect(listSellerCommissions).toHaveBeenCalledWith('s3');
    expect(listSellerCommissions).toHaveBeenCalledWith('s5');
  });

  it('o_pedido_das_comissoes_e_feito_uma_vez_por_vendedor_e_nao_a_cada_render', async () => {
    listStaff.mockResolvedValue([...COLABORADORES, { id: 's4', name: 'Pedro Praia', role: 'Guia', status: 'active' }]);
    await montar();
    await waitFor(() => expect(listSellerCommissions).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByPlaceholderText('Pesquisar...'), { target: { value: 'Rui' } });
    fireEvent.change(screen.getByPlaceholderText('Pesquisar...'), { target: { value: '' } });
    await new Promise(r => setTimeout(r, 20));
    expect(listSellerCommissions).toHaveBeenCalledTimes(1);
  });

  it('os_totais_do_mes_e_por_pagar_vem_das_comissoes_do_vendedor', async () => {
    const agora = new Date().toISOString();
    listSellerCommissions.mockResolvedValue([
      { id: 'c1', amount: 30.4, status: 'pending', created_at: agora },
      { id: 'c2', amount: 20, status: 'paid', created_at: agora },
      { id: 'c3', amount: 100, status: 'pending', created_at: '2020-01-15T10:00:00Z' }, /* outro mês: não conta */
    ]);
    await montar();
    const seccao = screen.getByText('Vendedores de Praia').closest('div.mt-6');
    await waitFor(() => expect(within(seccao).getByText('€50').nextSibling.textContent).toBe('Comissões mês'));
    expect(within(seccao).getByText('€30').nextSibling.textContent).toBe('Por pagar');
    expect(within(seccao).getByText('Registar pagamento')).toBeInTheDocument();
  });

  it('registar_pagamento_pede_confirmacao_e_paga_so_as_pendentes_do_mes', async () => {
    const agora = new Date().toISOString();
    listSellerCommissions.mockResolvedValue([
      { id: 'c1', amount: 30, status: 'pending', created_at: agora },
      { id: 'c2', amount: 20, status: 'paid', created_at: agora },
      { id: 'c3', amount: 100, status: 'pending', created_at: '2020-01-15T10:00:00Z' },
    ]);
    markCommissionPaid.mockResolvedValue({});
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    await montar();
    const seccao = screen.getByText('Vendedores de Praia').closest('div.mt-6');
    const botao = await within(seccao).findByText('Registar pagamento');
    fireEvent.click(botao);
    expect(confirmar).toHaveBeenCalledWith('Registar pagamento de €30 ao vendedor Vera Mendes?');
    expect(markCommissionPaid).not.toHaveBeenCalled();
    fireEvent.click(within(seccao).getByText('Registar pagamento'));
    await waitFor(() => expect(markCommissionPaid).toHaveBeenCalledTimes(1));
    expect(markCommissionPaid).toHaveBeenCalledWith('c1');
    await waitFor(() => expect(within(seccao).queryByText('Registar pagamento')).toBeNull());
    expect(within(seccao).getByText('€50').nextSibling.textContent).toBe('Comissões mês');
    expect(within(seccao).getByText('€0').nextSibling.textContent).toBe('Por pagar');
  });

  it('listSellerCommissions_a_falhar_deixa_os_totais_a_zero_sem_rebentar', async () => {
    listSellerCommissions.mockRejectedValue(new Error('x'));
    await montar();
    const seccao = screen.getByText('Vendedores de Praia').closest('div.mt-6');
    await waitFor(() => expect(listSellerCommissions).toHaveBeenCalled());
    expect(within(seccao).getAllByText('€0')).toHaveLength(2);
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
    expect(screen.getAllByRole('button', { name: /^Férias, documentos e certificações/ })).toHaveLength(4);
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
    /* o realce do botao de eliminar vem do IconBtn partilhado (hover:text-error) e fica como esta */
    expect(html.replace(/hover:text-error/g, '')).not.toMatch(/(?:text|bg|border)-error/);
    expect(html).not.toMatch(/sand-(?:700|200)/);
  });
});

/* ───────────────────────── estilo Mare ───────────────────────── */

describe('Colaboradores no estilo Mare', () => {
  it('mostra_o_sobretitulo_da_area_Gestao', async () => {
    await montar();
    expect(document.querySelector('[data-eyebrow]').textContent).toBe('Gestão');
  });

  it('os_cartoes_de_colaborador_e_de_vendedor_sao_cartoes_Mare', async () => {
    await montar();
    const cartoes = [
      cartao('Rui Lopes').closest('article'),
      cartao('Ana Tavares').closest('article'),
      ...screen.getAllByText('Vera Mendes', { selector: 'p' }).map(p => p.closest('article')),
    ];
    expect(cartoes).toHaveLength(4);
    for (const art of cartoes) {
      expect(art).not.toBeNull();
      expect(art.className).toContain('rounded-[18px]');
      expect(art.className).toContain('border-mare-card');
      expect(art.className).toContain('p-[22px]');
    }
  });

  it('estado_e_selo_de_vendedor_sao_Badge_com_o_mesmo_texto', async () => {
    await montar();
    expect(within(cartao('Rui Lopes')).getByText('Activo').className).toContain('app:rounded-full');
    expect(within(cartao('Ana Tavares')).getByText('Inactivo').className).toContain('app:rounded-full');
    expect(within(cartao('Vera Mendes')).getByText('Vendedor').className).toContain('app:rounded-full');
  });

  it('as_figuras_do_cartao_e_do_vendedor_sao_em_mono', async () => {
    await montar();
    expect(within(cartao('Rui Lopes')).getByText('12 trabalhos').className).toContain('tabular-nums');
    const seccao = screen.getByText('Vendedores de Praia').closest('div.mt-6');
    await waitFor(() => expect(listSellerCommissions).toHaveBeenCalled());
    expect(within(seccao).getAllByText('€0')[0].className).toContain('font-mono');
    expect(within(seccao).getByText('12% comissão').className).toContain('tabular-nums');
  });

  it('os_botoes_de_icone_do_cartao_tem_44px_no_telemovel', async () => {
    await montar();
    for (const nome of ['Editar Rui Lopes', 'Eliminar Rui Lopes']) {
      expect(screen.getByRole('button', { name: nome }).className).toContain('min-h-11');
    }
  });

  it('os_separadores_continuam_a_alternar', async () => {
    await montar();
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Colaboradores' }));
    expect(await screen.findByText('Rui Lopes')).toBeInTheDocument();
  });
});
