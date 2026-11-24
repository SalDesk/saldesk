import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StaffChat from '../components/shared/StaffChat';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';
import { listStaff, getMyProfile } from '../services/staffService';
import { listGroups, listMessages, sendMessage } from '../services/messageService';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

/* Chat de equipa do portal do pessoal e do vendedor de praia (components/shared/StaffChat.jsx).
   O ChatTab do painel tem os seus proprios testes em StaffChat.test.jsx. */
const sock = vi.hoisted(() => ({ handlers: {}, disconnect: vi.fn() }));
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: (evento, cb) => { sock.handlers[evento] = cb; },
    emit: vi.fn(),
    disconnect: sock.disconnect,
  })),
}));
vi.mock('../services/staffService', () => ({ listStaff: vi.fn(), getMyProfile: vi.fn() }));
vi.mock('../services/messageService', () => ({ listGroups: vi.fn(), listMessages: vi.fn(), sendMessage: vi.fn() }));

const EU = 'me';
const COLEGAS = [{ id: 'me', name: 'Eu Mesmo', role: 'Guia' }, { id: 's1', name: 'Rui', role: 'Motorista' }, { id: 's2', name: 'Vera', role: null }];
const GRUPOS = [{ id: 'g1', name: 'Equipa Praia', members: ['me', 's1'] }];
const AGORA = new Date().toISOString();
/* nomes de pessoas e de grupos, e o que elas escrevem, sao dados */
const DADOS = ['Rui', 'Vera', 'Eu Mesmo', 'Equipa Praia', 'Bom dia a todos', 'Ola'];

let errSpy;
let warnSpy;

beforeEach(() => {
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  Element.prototype.scrollIntoView = vi.fn();
  sock.handlers = {};
  useAuthStore.setState({ token: 'tok' });
  listStaff.mockReset().mockResolvedValue(COLEGAS);
  getMyProfile.mockReset().mockResolvedValue({ operator_id: 'op1', operator_name: null });
  listGroups.mockReset().mockResolvedValue(GRUPOS);
  listMessages.mockReset().mockResolvedValue({ data: [
    { id: 'a', sender_type: 'staff', sender_id: 's1', sender_name: null, content: 'Bom dia a todos', created_at: AGORA },
    { id: 'b', sender_type: 'manager', sender_id: 'op1', sender_name: null, content: 'Ola', created_at: AGORA },
  ] });
  sendMessage.mockReset().mockImplementation(async (d) => ({ id: `n-${d.content}`, sender_type: 'staff', sender_id: EU, content: d.content, created_at: AGORA }));
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ token: null });
  useUiStore.setState({ lang: 'pt' });
  const erros = errSpy.mock.calls.length;
  const avisos = warnSpy.mock.calls.length;
  errSpy.mockRestore();
  warnSpy.mockRestore();
  expect(erros).toBe(0);
  expect(avisos).toBe(0);
});

async function monta() {
  render(<StaffChat staffId={EU} />);
  await screen.findByText('Equipa Praia');
}

describe('StaffChat partilhado com o painel em portugues', () => {
  it('a_lista_mostra_gestao_grupos_e_equipa_como_sempre', async () => {
    useUiStore.setState({ lang: 'pt' });
    await monta();
    expect(screen.getByText('Gestão')).toBeInTheDocument();
    expect(screen.getByText('Grupos')).toBeInTheDocument();
    expect(screen.getByText('Equipa')).toBeInTheDocument();
    expect(screen.getByText('2 membros')).toBeInTheDocument();
    expect(screen.getByText('Motorista')).toBeInTheDocument();
    /* o gestor sem nome mostra a palavra "Gestor" nos dois sitios */
    expect(screen.getAllByText('Gestor')).toHaveLength(2);
  });

  it('a_conversa_do_grupo_mostra_o_remetente_e_o_gestor_como_sempre', async () => {
    useUiStore.setState({ lang: 'pt' });
    await monta();
    fireEvent.click(screen.getByText('Equipa Praia').closest('button'));
    expect(await screen.findByText('Bom dia a todos')).toBeInTheDocument();
    expect(screen.getAllByText('2 membros').length).toBeGreaterThan(0);
    expect(screen.getByText('Equipa')).toBeInTheDocument();
    expect(screen.getByText('Gestor')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Escreva uma mensagem...')).toBeInTheDocument();
  });
});

describe('StaffChat partilhado com o painel em ingles', () => {
  beforeEach(() => { useUiStore.setState({ lang: 'en' }); });

  it('a_lista_em_ingles_traduz_titulos_cargos_e_contagens_sem_portugues', async () => {
    await monta();
    expect(screen.getByText('Management')).toBeInTheDocument();
    expect(screen.getByText('Groups')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('2 members')).toBeInTheDocument();
    /* o cargo gravado e 'Motorista'; o rotulo e o do glossario */
    expect(screen.getByText('Driver')).toBeInTheDocument();
    expect(screen.getAllByText('Manager')).toHaveLength(2);
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['staffChat'])).toEqual([]);
  });

  it('a_conversa_em_ingles_traduz_cabecalho_remetentes_e_caixa_e_envia_o_texto_como_escrito', async () => {
    await monta();
    fireEvent.click(screen.getByText('Equipa Praia').closest('button'));
    expect(await screen.findByText('Bom dia a todos')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
    const caixa = screen.getByPlaceholderText('Write a message...');
    fireEvent.change(caixa, { target: { value: 'Ola equipa' } });
    fireEvent.keyDown(caixa, { key: 'Enter' });
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith({
      content: 'Ola equipa', group_id: 'g1', message_type: 'group', recipient_type: 'group',
    }));
    expect(portuguesNoEcra([...DADOS, 'Ola equipa'])).toEqual([]);
  });

  it('a_conversa_com_um_colega_em_ingles_mostra_o_cargo_traduzido_ou_o_texto_de_colaborador', async () => {
    await monta();
    fireEvent.click(screen.getByText('Rui').closest('button'));
    await waitFor(() => expect(listMessages).toHaveBeenCalledWith({ recipient_id: 's1' }));
    expect((await screen.findAllByText('Driver')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByText('Vera').closest('button'));
    await waitFor(() => expect(listMessages).toHaveBeenCalledWith({ recipient_id: 's2' }));
    expect(await screen.findByText('Staff member')).toBeInTheDocument();
  });
});
