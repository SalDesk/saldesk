import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Staff from '../pages/Staff';
import useAuthStore from '../store/authStore';
import useToastStore from '../store/toastStore';
import useUiStore from '../store/uiStore';
import { listUnits } from '../services/unitsService';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';
import { io } from 'socket.io-client';
import { listStaff, createStaff, updateStaff, deleteStaff, createStaffAccount } from '../services/staffService';
import { listSellerCommissions } from '../services/sellerService';
import { listAssignments } from '../services/assignmentService';
import { listReservations } from '../services/reservationsService';
import { listGroups, getUnreadCount } from '../services/messageService';
import { FUTURE, COLABORADORES, ATRIBUICOES, RESERVAS, GRUPOS } from './helpers/staffFixtures';

/* Sem rede nem tempo real: o socket e uma maquina de eventos que o teste dispara */
const sock = vi.hoisted(() => ({ handlers: {}, emit: vi.fn(), disconnect: vi.fn() }));
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: (evento, cb) => { sock.handlers[evento] = cb; },
    emit: sock.emit,
    disconnect: sock.disconnect,
  })),
}));
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

let spyErr; let spyWarn;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  sock.handlers = {};
  sock.emit.mockClear();
  sock.disconnect.mockClear();
  useToastStore.setState({ toasts: [] });
  useAuthStore.setState({ token: 'tok', operator: { id: 'op1', operator_type: 'activity', plan: 'business' } });
  listStaff.mockReset().mockResolvedValue(COLABORADORES);
  listSellerCommissions.mockReset().mockResolvedValue([]);
  listAssignments.mockReset().mockResolvedValue(ATRIBUICOES);
  listReservations.mockReset().mockResolvedValue(RESERVAS);
  listGroups.mockReset().mockResolvedValue(GRUPOS);
  getUnreadCount.mockReset().mockResolvedValue(0);
  createStaff.mockReset();
  updateStaff.mockReset();
  deleteStaff.mockReset().mockResolvedValue();
  createStaffAccount.mockReset();
  io.mockClear();
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

async function montar() {
  const r = render(<MemoryRouter future={FUTURE}><Staff /></MemoryRouter>);
  await screen.findByText('Rui Lopes');
  return r;
}
/* separadores: antes botoes, depois role=tab; o texto e o mesmo */
function abrir(rotulo) {
  const el = screen.getAllByText(rotulo).find(e => e.closest('button, [role="tab"]'));
  fireEvent.click(el.closest('button, [role="tab"]'));
}
/* o cartao de um colaborador: a raiz com flex-col que contem o nome */
const cartao = (nome) => screen.getAllByText(nome, { selector: 'p' })[0].closest('div.flex-col');
const toasts = () => useToastStore.getState().toasts.map(t => `${t.type}:${t.message}`);

describe('Staff: página inteira', () => {
  it('lista_os_colaboradores_com_o_subtitulo_e_o_contador', async () => {
    await montar();
    expect(screen.getByText('2 activo(s) · 3 total')).toBeInTheDocument();
    ['Rui Lopes', 'Ana Tavares', 'Vera Mendes'].forEach(n => expect(screen.getAllByText(n).length).toBeGreaterThan(0));
    expect(screen.getByRole('heading', { name: 'Colaboradores' })).toBeInTheDocument();
  });

  it('abre_cada_separador_sem_rebentar', async () => {
    await montar();
    abrir('Checklist');
    expect(await screen.findByText('Checklist do dia')).toBeInTheDocument();
    abrir('Tarefas');
    expect(await screen.findByText('Nova tarefa')).toBeInTheDocument();
    expect(await screen.findByText('Briefing')).toBeInTheDocument();
    abrir('Chat');
    expect(await screen.findByText('Seleccionar uma conversa')).toBeInTheDocument();
    expect(await screen.findByText('Equipa Campo')).toBeInTheDocument();
    abrir('Colaboradores');
    expect(await screen.findByText('Ana Tavares')).toBeInTheDocument();
  });

  it('novo_colaborador_abre_o_formulario_e_cria_com_createStaff', async () => {
    createStaff.mockResolvedValue({ id: 's9', name: 'Novo Guia', role: 'Guia', status: 'active' });
    await montar();
    fireEvent.click(screen.getByRole('button', { name: /Novo colaborador/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Novo colaborador');
    fireEvent.change(screen.getByPlaceholderText('Nome e apelido'), { target: { value: 'Novo Guia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar colaborador' }));
    await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
    expect(createStaff).toHaveBeenCalledWith(expect.objectContaining({ name: 'Novo Guia', role: 'Guia', commission_pct: null, create_access: false }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Novo Guia')).toBeInTheDocument();
  });

  it('editar_abre_o_formulario_com_os_valores_e_guarda_com_updateStaff', async () => {
    updateStaff.mockResolvedValue({ ...COLABORADORES[0], name: 'Rui L. Lopes' });
    await montar();
    fireEvent.click(within(cartao('Rui Lopes')).getAllByRole('button')[1]);
    expect(screen.getByRole('dialog')).toHaveTextContent('Editar: Rui Lopes');
    const nome = screen.getByPlaceholderText('Nome e apelido');
    expect(nome).toHaveValue('Rui Lopes');
    fireEvent.change(nome, { target: { value: 'Rui L. Lopes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar alterações' }));
    await waitFor(() => expect(updateStaff).toHaveBeenCalledWith('s1', expect.objectContaining({ name: 'Rui L. Lopes', skills: [], schedule: [] })));
    expect(await screen.findByText('Rui L. Lopes')).toBeInTheDocument();
  });

  it('eliminar_pede_confirmacao_e_chama_deleteStaff', async () => {
    await montar();
    fireEvent.click(within(cartao('Rui Lopes')).getAllByRole('button')[2]);
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Eliminar o colaborador "Rui Lopes"?');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(deleteStaff).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(screen.queryByText('Rui Lopes')).toBeNull());
  });

  it('no_plano_starter_com_2_colaboradores_mostra_o_aviso_e_o_upgrade', async () => {
    useAuthStore.setState({ operator: { id: 'op1', operator_type: 'activity', plan: 'starter' } });
    await montar();
    expect(screen.getByText('2 activo(s) · 3/2 no plano Starter')).toBeInTheDocument();
    expect(screen.getByText('Atingiu o limite de 2 colaboradores do plano Starter.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Novo colaborador/ }));
    expect(await screen.findByText('Ver planos de subscrição')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull(); /* nao abre o formulario */
  });

  it('criar_conta_do_cartao_chama_createStaffAccount_e_avisa', async () => {
    createStaffAccount.mockResolvedValue({ user_id: 'u3' });
    await montar();
    expect(within(cartao('Rui Lopes')).getByText('Conta activa')).toBeInTheDocument();
    expect(within(cartao('Ana Tavares')).queryByText('Criar conta')).toBeNull(); /* sem email */
    fireEvent.click(within(cartao('Vera Mendes')).getByText('Criar conta'));
    await waitFor(() => expect(createStaffAccount).toHaveBeenCalledWith('s3'));
    expect(await within(cartao('Vera Mendes')).findByText('Conta activa')).toBeInTheDocument();
    expect(toasts()).toContain('success:Conta criada e email enviado ao colaborador');
  });

  it('a_seccao_vendedores_de_praia_aparece_so_com_vendedores', async () => {
    await montar();
    expect(screen.getByText('Vendedores de Praia')).toBeInTheDocument();
    expect(screen.getByText('Espargos')).toBeInTheDocument();
    cleanup();
    listStaff.mockResolvedValue([COLABORADORES[0]]);
    await montar();
    expect(screen.queryByText('Vendedores de Praia')).toBeNull();
  });

  it('sem_colaboradores_mostra_o_vazio', async () => {
    listStaff.mockResolvedValue([]);
    render(<MemoryRouter future={FUTURE}><Staff /></MemoryRouter>);
    expect(await screen.findByText('Sem colaboradores registados')).toBeInTheDocument();
  });

  it('o_contador_de_nao_lidas_aparece_no_separador_chat', async () => {
    getUnreadCount.mockResolvedValue(3);
    await montar();
    await waitFor(() => {
      const chat = screen.getAllByText('Chat').find(e => e.closest('button, [role="tab"]')).closest('button, [role="tab"]');
      expect(chat).toHaveTextContent('3');
    });
  });

  it('o_socket_liga_ao_abrir_o_chat_e_desliga_ao_sair', async () => {
    await montar();
    expect(io).not.toHaveBeenCalled();
    abrir('Chat');
    await screen.findByText('Seleccionar uma conversa');
    expect(io).toHaveBeenCalledTimes(1);
    expect(io.mock.calls[0][1]).toMatchObject({ auth: { token: 'tok' }, transports: ['websocket'] });
    abrir('Colaboradores');
    await waitFor(() => expect(sock.disconnect).toHaveBeenCalledTimes(1));
  });
});

describe('Staff: criar colaborador com conta de acesso', () => {
  const interruptor = () => screen.getByText('Criar conta /staff').parentElement.parentElement.querySelector('button');
  async function abrirFormulario(email) {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: /Novo colaborador/ }));
    fireEvent.change(screen.getByPlaceholderText('Nome e apelido'), { target: { value: 'Novo Guia' } });
    if (email) fireEvent.change(screen.getByPlaceholderText('nome@email.com'), { target: { value: email } });
    fireEvent.click(interruptor());
  }

  it('com_email_cria_a_conta_avisa_e_o_cartao_mostra_Conta_activa', async () => {
    createStaff.mockResolvedValue({ id: 's9', name: 'Novo Guia', role: 'Guia', status: 'active', email: 'n@x.cv' });
    createStaffAccount.mockResolvedValue({ user_id: 'u9' });
    await abrirFormulario('n@x.cv');
    fireEvent.click(screen.getByRole('button', { name: 'Criar colaborador' }));
    await waitFor(() => expect(createStaffAccount).toHaveBeenCalledWith('s9'));
    expect(createStaff).toHaveBeenCalledWith(expect.objectContaining({ create_access: true, email: 'n@x.cv' }));
    await waitFor(() => expect(toasts()).toContain('success:Colaborador criado e conta de acesso enviada por email'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(cartao('Novo Guia')).getByText('Conta activa')).toBeInTheDocument();
  });

  it('a_conta_a_falhar_avisa_mas_o_colaborador_fica_criado', async () => {
    createStaff.mockResolvedValue({ id: 's9', name: 'Novo Guia', role: 'Guia', status: 'active', email: 'n@x.cv' });
    createStaffAccount.mockRejectedValue(new Error('x'));
    await abrirFormulario('n@x.cv');
    fireEvent.click(screen.getByRole('button', { name: 'Criar colaborador' }));
    await waitFor(() => expect(toasts()).toContain('error:Colaborador criado, mas a conta de acesso falhou — tente novamente no cartão do colaborador'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(cartao('Novo Guia')).getByText('Criar conta')).toBeInTheDocument(); /* sem user_id */
  });

  it('sem_email_o_interruptor_nao_cria_conta', async () => {
    createStaff.mockResolvedValue({ id: 's9', name: 'Novo Guia', role: 'Guia', status: 'active' });
    await abrirFormulario(null);
    fireEvent.click(screen.getByRole('button', { name: 'Criar colaborador' }));
    await waitFor(() => expect(createStaff).toHaveBeenCalledWith(expect.objectContaining({ create_access: true })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(createStaffAccount).not.toHaveBeenCalled();
    expect(toasts()).toEqual([]);
  });

  it('erro_do_servidor_aparece_no_formulario_que_fica_aberto', async () => {
    createStaff.mockRejectedValueOnce({ response: { data: { error: 'Nome duplicado' } } });
    await abrirFormulario(null);
    fireEvent.click(screen.getByRole('button', { name: 'Criar colaborador' }));
    expect(await within(screen.getByRole('dialog')).findByText('Nome duplicado')).toBeInTheDocument();
    createStaff.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(screen.getByRole('button', { name: 'Criar colaborador' }));
    expect(await within(screen.getByRole('dialog')).findByText('Erro ao guardar')).toBeInTheDocument();
  });
});

/* ───────────────────────── Painel em ingles ───────────────────────── */

describe('Staff em inglês', () => {
  /* dados dos testes que ficam como estao em qualquer lingua */
  const DADOS = ['Rui Lopes', 'Ana Tavares', 'Vera Mendes', 'Espargos', 'Briefing', 'Levar equipamento', 'Texto simples sem JSON',
    'Tarefa', 'Equipa Campo', 'Material', 'Agua', 'rui@x.cv', 'vera@x.cv', '+238', 'Novo Hotel'];
  beforeEach(() => { useUiStore.setState({ lang: 'en' }); });
  afterEach(() => { cleanup(); useUiStore.setState({ lang: 'pt' }); });

  it('lista_separadores_cartoes_e_vendedores_em_ingles_sem_portugues', async () => {
    await montar();
    expect(screen.getByRole('heading', { name: 'Staff' })).toBeInTheDocument();
    expect(screen.getByText('2 active · 3 total')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New staff member/ })).toBeInTheDocument();
    ['Staff', 'Checklist', 'Tasks', 'Chat'].forEach(r => expect(screen.getAllByText(r).some(e => e.closest('[role="tab"], button'))).toBe(true));
    /* cargos gravados em portugues, mostrados em ingles */
    expect(within(cartao('Rui Lopes')).getByText('Guide')).toBeInTheDocument();
    expect(within(cartao('Ana Tavares')).getByText('Instructor')).toBeInTheDocument();
    expect(within(cartao('Rui Lopes')).getByText('Active account')).toBeInTheDocument();
    expect(within(cartao('Rui Lopes')).getByText('12 jobs')).toBeInTheDocument();
    expect(within(cartao('Vera Mendes')).getByText('Create account')).toBeInTheDocument();
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Beach Sellers')).toBeInTheDocument();
    expect(screen.getByText('Commissions this month')).toBeInTheDocument();
    expect(screen.getByText('Unpaid')).toBeInTheDocument();
    expect(screen.getByText('12% commission')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Rui Lopes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave, documents and certifications for Rui Lopes' })).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['staff', 'hr', 'common'])).toEqual([]);
  });

  it('checklist_tarefas_e_chat_em_ingles', async () => {
    await montar();
    abrir('Checklist');
    expect(await screen.findByText("Today's checklist")).toBeInTheDocument();
    expect(screen.getByText('Team briefing')).toBeInTheDocument();
    expect(screen.getByText(/0\/5 done/)).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    abrir('Tasks');
    expect(await screen.findByText('New task')).toBeInTheDocument();
    ['Pending', 'In progress', 'Done', 'Blocked'].forEach(c => expect(screen.getAllByText(c).length).toBeGreaterThan(0));
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Move to In progress').length).toBeGreaterThan(0);
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    abrir('Chat');
    expect(await screen.findByText('Select a conversation')).toBeInTheDocument();
    expect(screen.getByText('Groups')).toBeInTheDocument();
    expect(screen.getByText('Direct')).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['staff', 'hr', 'common'])).toEqual([]);
  });

  it('num_hotel_escolher_Maintenance_grava_o_cargo_Manutencao_e_Mon_grava_Seg', async () => {
    useAuthStore.setState({ operator: { id: 'op1', operator_type: 'hotel', plan: 'business' } });
    createStaff.mockResolvedValue({ id: 's9', name: 'Novo Hotel', role: 'Manutencao', status: 'active' });
    await montar();
    fireEvent.click(screen.getByRole('button', { name: /New staff member/ }));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('New staff member');
    fireEvent.change(within(dlg).getByPlaceholderText('First and last name'), { target: { value: 'Novo Hotel' } });
    const cargo = within(dlg).getByLabelText('Role');
    const opcao = within(cargo).getByRole('option', { name: 'Maintenance' });
    expect(opcao.value).toBe('Manutencao');
    fireEvent.change(cargo, { target: { value: opcao.value } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Mon' }));
    expect(portuguesNoEcra(DADOS, dlg)).toEqual([]);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Create staff member' }));
    await waitFor(() => expect(createStaff).toHaveBeenCalledWith(expect.objectContaining({ role: 'Manutencao', schedule: ['Seg'] })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(cartao('Novo Hotel')).getByText('Maintenance')).toBeInTheDocument();
  });

  it('o_erro_sem_texto_do_servidor_cai_no_texto_ingles', async () => {
    createStaff.mockRejectedValueOnce(new Error('x'));
    await montar();
    fireEvent.click(screen.getByRole('button', { name: /New staff member/ }));
    fireEvent.change(screen.getByPlaceholderText('First and last name'), { target: { value: 'Novo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create staff member' }));
    expect(await within(screen.getByRole('dialog')).findByText('Could not save')).toBeInTheDocument();
  });

  it('o_vendedor_de_praia_e_a_zona_aparecem_traduzidos_no_formulario', async () => {
    listUnits.mockResolvedValue([]);
    await montar();
    fireEvent.click(screen.getByRole('button', { name: /New staff member/ }));
    const dlg = screen.getByRole('dialog');
    const cargo = within(dlg).getByLabelText('Role');
    const opcao = within(cargo).getByRole('option', { name: 'Beach Seller' });
    expect(opcao.value).toBe('Vendedor de Praia');
    fireEvent.change(cargo, { target: { value: opcao.value } });
    expect(await within(dlg).findByText('Beach Seller settings')).toBeInTheDocument();
    const zona = within(dlg).getByLabelText('Working zone');
    expect(within(zona).getByRole('option', { name: 'Airport' }).value).toBe('Aeroporto');
    expect(within(zona).getByRole('option', { name: 'All zones' }).value).toBe('');
    await waitFor(() => expect(listUnits).toHaveBeenCalled());
  });

  it('a_pesquisa_encontra_o_cargo_pelo_rotulo_ingles_e_pelo_valor_gravado', async () => {
    listStaff.mockResolvedValue([...COLABORADORES, { id: 's4', name: 'Pedro Praia', role: 'Guia', status: 'active' }]);
    await montar();
    const pesquisa = screen.getByPlaceholderText('Search...');
    fireEvent.change(pesquisa, { target: { value: 'instructor' } });
    expect(screen.getByText('Ana Tavares')).toBeInTheDocument();
    expect(screen.queryByText('Pedro Praia')).toBeNull();
    fireEvent.change(pesquisa, { target: { value: 'instrutor' } });
    expect(screen.getByText('Ana Tavares')).toBeInTheDocument();
  });
});
