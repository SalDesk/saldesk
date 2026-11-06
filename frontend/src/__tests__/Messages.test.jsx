import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Messages from '../pages/Messages';
import useAuthStore from '../store/authStore';
import { listMessages, sendMessage, markRead, listGroups, createGroup, getLastActivity } from '../services/messageService';
import { listStaff } from '../services/staffService';
import { listCustomers } from '../services/customersService';

/* Sem rede nem tempo real: o socket e uma maquina de eventos que o teste dispara */
const sock = vi.hoisted(() => ({ handlers: {}, emit: vi.fn(), disconnect: vi.fn() }));
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: (evento, cb) => { sock.handlers[evento] = cb; },
    emit: sock.emit,
    disconnect: sock.disconnect,
  })),
}));
vi.mock('../services/messageService', () => ({
  listMessages: vi.fn(), sendMessage: vi.fn(), markRead: vi.fn(),
  listGroups: vi.fn(), createGroup: vi.fn(), getLastActivity: vi.fn(),
}));
vi.mock('../services/staffService', () => ({ listStaff: vi.fn() }));
vi.mock('../services/customersService', () => ({ listCustomers: vi.fn() }));
vi.mock('../services/api', () => ({ default: { post: vi.fn() } }));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const AGORA = new Date().toISOString();

const COLABORADORES = [{ id: 's1', name: 'Rui', role: 'Guia' }, { id: 's2', name: 'Ana', role: 'Motorista' }];
const GRUPOS = [{ id: 'g1', name: 'Equipa Kite', members: ['s1', 's2'] }];
const CLIENTES = [
  { id: 'c1', name: 'Maria Cliente', email: 'maria@x.cv', phone: '+238 99' },
  { id: 'c2', name: 'Joao Sem Contacto', email: null, phone: null },
];
const ACTIVIDADE = { c1: '2026-03-12T10:00:00Z', s2: '2026-03-13T10:00:00Z' };

describe('Messages', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    sock.handlers = {};
    sock.emit.mockClear();
    sock.disconnect.mockClear();
    useAuthStore.setState({ token: 'tok', operator: { id: 'op1' } });
    listStaff.mockReset().mockResolvedValue(COLABORADORES);
    listGroups.mockReset().mockResolvedValue(GRUPOS);
    listCustomers.mockReset().mockResolvedValue(CLIENTES);
    getLastActivity.mockReset().mockResolvedValue(ACTIVIDADE);
    listMessages.mockReset().mockResolvedValue([]);
    markRead.mockReset().mockResolvedValue({});
    sendMessage.mockReset().mockImplementation(async (d) => ({ id: `n-${d.content}`, sender_type: 'manager', content: d.content, created_at: AGORA, channel: d.channel || 'internal', is_read: false }));
    createGroup.mockReset().mockImplementation(async (d) => ({ id: 'g2', name: d.name, members: d.members }));
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ token: null, operator: null });
    /* a guarda conta ANTES de restaurar os espioes */
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    errSpy.mockRestore();
    warnSpy.mockRestore();
    expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  async function abre() {
    render(
      <MemoryRouter future={FUTURE}>
        <Messages />
      </MemoryRouter>
    );
    await screen.findByText('Rui');
  }
  function contacto(nome) {
    return screen.getByText(nome).closest('button');
  }
  async function abreConversa(nome, mensagens = []) {
    listMessages.mockResolvedValue(mensagens);
    fireEvent.click(contacto(nome));
    await waitFor(() => expect(listMessages).toHaveBeenCalled());
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());
  }
  function evento(nome, dados) {
    act(() => { sock.handlers[nome](dados); });
  }
  function nomesDaBarra() {
    return screen.getAllByRole('button')
      .filter(b => b.querySelector('p.font-body.truncate'))
      .map(b => b.querySelector('p.font-body.truncate').textContent);
  }
  function caixa(texto = 'Escrever mensagem...') {
    return screen.getByPlaceholderText(texto);
  }
  function botaoEnviar() {
    return screen.getByRole('button', { name: 'Enviar' });
  }

  it('lista colaboradores e conversas (grupos e clientes) por actividade mais recente', async () => {
    await abre();
    expect(screen.getByText('Colaboradores')).toBeInTheDocument();
    expect(screen.getByText('Conversas')).toBeInTheDocument();
    expect(nomesDaBarra()).toEqual(['Ana', 'Rui', 'Maria Cliente', 'Equipa Kite', 'Joao Sem Contacto']);
    expect(screen.getByText('Guia')).toBeInTheDocument();
    expect(screen.getByText('Grupo · 2 membros')).toBeInTheDocument();
    expect(screen.getByText('maria@x.cv')).toBeInTheDocument();
    expect(screen.getByText('Cliente')).toBeInTheDocument();
    expect(screen.getByText('Seleccione uma conversa')).toBeInTheDocument();
  });

  it('a pesquisa filtra os contactos e diz quando nao ha resultados', async () => {
    await abre();
    const pesquisa = screen.getByPlaceholderText('Pesquisar...');
    fireEvent.change(pesquisa, { target: { value: 'ANA' } });
    expect(nomesDaBarra()).toEqual(['Ana']);
    fireEvent.change(pesquisa, { target: { value: 'zzz' } });
    expect(screen.getByText('Sem resultados')).toBeInTheDocument();
  });

  it('sem contactos mostra o aviso; servicos a falhar nao rebentam', async () => {
    listStaff.mockRejectedValue(new Error('rede'));
    listGroups.mockRejectedValue(new Error('rede'));
    listCustomers.mockRejectedValue(new Error('rede'));
    getLastActivity.mockRejectedValue(new Error('rede'));
    render(
      <MemoryRouter future={FUTURE}>
        <Messages />
      </MemoryRouter>
    );
    expect(await screen.findByText('Sem colaboradores, grupos ou clientes')).toBeInTheDocument();
  });

  it('abrir uma conversa pede as mensagens ao destinatario certo e marca as nao lidas', async () => {
    await abre();
    await abreConversa('Rui', [
      { id: 'm1', sender_type: 'staff', sender_name: 'Rui', content: 'Ola chefe', created_at: AGORA, is_read: false },
      { id: 'm2', sender_type: 'manager', content: 'Bom dia', created_at: AGORA, is_read: true, channel: 'internal' },
    ]);
    expect(listMessages).toHaveBeenLastCalledWith({ recipient_id: 's1' });
    expect(screen.getByText('Ola chefe')).toBeInTheDocument();
    expect(screen.getByText('Bom dia')).toBeInTheDocument();
    expect(markRead).toHaveBeenCalledTimes(1);
    expect(markRead).toHaveBeenCalledWith('m1');
    cleanup();
    await abre();
    await abreConversa('Equipa Kite');
    expect(listMessages).toHaveBeenLastCalledWith({ group_id: 'g1' });
    await abreConversa('Maria Cliente');
    expect(listMessages).toHaveBeenLastCalledWith({ recipient_id: 'c1' });
  });

  it('uma conversa sem mensagens convida a comecar', async () => {
    await abre();
    await abreConversa('Rui');
    expect(screen.getByText('Sem mensagens ainda. Comece a conversa.')).toBeInTheDocument();
  });

  it('uma mensagem nova de outro contacto incrementa o contador e o titulo', async () => {
    await abre();
    expect(screen.getByRole('heading', { name: 'Mensagens' })).toBeInTheDocument();
    evento('message:new', { id: 'x1', sender_type: 'staff', sender_id: 's2', recipient_id: 'op1', content: 'Nova', created_at: AGORA });
    expect(within(contacto('Ana')).getByText('1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mensagens (1)' })).toBeInTheDocument();
    for (let i = 0; i < 10; i++) {
      evento('message:new', { id: `y${i}`, sender_type: 'staff', sender_id: 's2', recipient_id: 'op1', content: 'x', created_at: AGORA });
    }
    expect(within(contacto('Ana')).getByText('9+')).toBeInTheDocument();
  });

  it('uma mensagem na conversa aberta aparece uma vez so e e marcada como lida', async () => {
    await abre();
    await abreConversa('Ana');
    const msg = { id: 'x1', sender_type: 'staff', sender_id: 's2', recipient_id: 'op1', content: 'Chegou', created_at: AGORA };
    evento('message:new', msg);
    evento('message:new', msg);
    expect(screen.getAllByText('Chegou')).toHaveLength(1);
    expect(markRead).toHaveBeenCalledWith('x1');
    /* com a conversa aberta o nome tambem esta no cabecalho; o contador de nao lidas nao aparece */
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('um visitante desconhecido volta a pedir a lista de clientes', async () => {
    await abre();
    expect(listCustomers).toHaveBeenCalledTimes(1);
    evento('message:new', { id: 'v1', sender_type: 'guest', sender_id: 'c9', recipient_id: 'op1', content: 'Ola', created_at: AGORA });
    await waitFor(() => expect(listCustomers).toHaveBeenCalledTimes(2));
  });

  it('colaborador online mostra "Online" e a escrever mostra o aviso', async () => {
    await abre();
    evento('user:online', { userId: 's1' });
    expect(within(contacto('Rui')).getByText('Online')).toBeInTheDocument();
    evento('user:offline', { userId: 's1' });
    expect(within(contacto('Rui')).queryByText('Online')).not.toBeInTheDocument();
    await abreConversa('Rui');
    evento('typing:start', { from: 's1' });
    expect(screen.getByText('esta a escrever...')).toBeInTheDocument();
    evento('typing:stop', { from: 's1' });
    expect(screen.queryByText('esta a escrever...')).not.toBeInTheDocument();
  });

  it('escrever emite typing:start uma vez e enviar para um colaborador usa o objeto certo', async () => {
    await abre();
    await abreConversa('Rui');
    fireEvent.change(caixa(), { target: { value: 'O' } });
    fireEvent.change(caixa(), { target: { value: 'Ol' } });
    expect(sock.emit.mock.calls.filter(c => c[0] === 'typing:start')).toEqual([['typing:start', { to: 's1' }]]);
    fireEvent.change(caixa(), { target: { value: 'Ola' } });
    fireEvent.click(botaoEnviar());
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith({
      content: 'Ola', recipient_id: 's1', recipient_type: 'staff', message_type: 'direct',
    }));
    expect(await screen.findByText('Ola')).toBeInTheDocument();
    await waitFor(() => expect(caixa().value).toBe(''));
  });

  it('enviar para um grupo usa group_id e message_type group', async () => {
    await abre();
    await abreConversa('Equipa Kite');
    fireEvent.change(caixa(), { target: { value: 'Pessoal' } });
    fireEvent.click(botaoEnviar());
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith({
      content: 'Pessoal', group_id: 'g1', message_type: 'group', recipient_type: 'group',
    }));
  });

  it('enviar para um cliente leva o canal; o alternador activa email e WhatsApp so com esses dados', async () => {
    await abre();
    await abreConversa('Maria Cliente');
    fireEvent.change(caixa(), { target: { value: 'Ola cliente' } });
    fireEvent.click(botaoEnviar());
    await waitFor(() => expect(sendMessage).toHaveBeenLastCalledWith({
      content: 'Ola cliente', recipient_id: 'c1', recipient_type: 'guest', message_type: 'direct', channel: 'internal',
    }));
    expect(screen.getByRole('button', { name: 'Chat' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Email' }));
    expect(caixa('Escrever mensagem por email...')).toBeInTheDocument();
    fireEvent.change(caixa('Escrever mensagem por email...'), { target: { value: 'Por email' } });
    fireEvent.click(botaoEnviar());
    await waitFor(() => expect(sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({ content: 'Por email', channel: 'email' })));
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(caixa('Escrever mensagem por WhatsApp...')).toBeInTheDocument();
    cleanup();
    await abre();
    await abreConversa('Joao Sem Contacto');
    expect(screen.getByRole('button', { name: 'Email' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'WhatsApp' })).toBeDisabled();
  });

  it('as mensagens por email ou WhatsApp mostram o canal e a falha de entrega', async () => {
    await abre();
    await abreConversa('Maria Cliente', [
      { id: 'a', sender_type: 'manager', content: 'Falhou', channel: 'email', delivery_status: 'failed', created_at: AGORA },
      { id: 'b', sender_type: 'manager', content: 'Foi', channel: 'whatsapp', created_at: AGORA },
    ]);
    expect(screen.getByText('Falha ao entregar')).toBeInTheDocument();
    expect(screen.getByText('Enviado por WhatsApp')).toBeInTheDocument();
  });

  it('o botao de enviar fica desactivado sem texto', async () => {
    await abre();
    await abreConversa('Rui');
    expect(botaoEnviar()).toBeDisabled();
    fireEvent.change(caixa(), { target: { value: 'x' } });
    expect(botaoEnviar()).not.toBeDisabled();
  });

  it('um anexo junta o nome ao conteudo e so existe para colaboradores e grupos', async () => {
    await abre();
    await abreConversa('Rui');
    const ficheiro = new File(['x'], 'foto.png', { type: 'image/png' });
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [ficheiro] } });
    expect(screen.getByText('foto.png')).toBeInTheDocument();
    fireEvent.change(caixa(), { target: { value: 'Veja' } });
    fireEvent.click(botaoEnviar());
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ content: 'Veja\n[Anexo: foto.png]' })));
    await waitFor(() => expect(screen.queryByText('foto.png')).not.toBeInTheDocument());
    cleanup();
    await abre();
    await abreConversa('Maria Cliente');
    expect(screen.queryByTitle('Anexar ficheiro')).not.toBeInTheDocument();
  });

  it('novo grupo cria com o nome e os membros escolhidos e entra nas conversas', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Novo grupo' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Novo grupo')).toBeInTheDocument();
    const nome = within(dialogo).getAllByText('Nome do grupo').find(e => e.tagName === 'LABEL').nextElementSibling;
    fireEvent.change(nome, { target: { value: 'Praia' } });
    fireEvent.click(within(dialogo).getByText(/Rui/).closest('label').querySelector('input'));
    fireEvent.submit(dialogo.querySelector('form'));
    await waitFor(() => expect(createGroup).toHaveBeenCalledWith({ name: 'Praia', members: ['s1'] }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Praia')).toBeInTheDocument();
  });

  it('o alternador de canal tem aria-pressed', async () => {
    await abre();
    await abreConversa('Maria Cliente');
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Email' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Email' }));
    expect(screen.getByRole('button', { name: 'Email' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(screen.getByRole('button', { name: 'WhatsApp' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('nenhuma cor em hexadecimal, verde ou vermelha solta sobra no HTML (online, falha de entrega)', async () => {
    await abre();
    const limpo = () => {
      expect(document.body.innerHTML).not.toContain('[#');
      expect(document.body.innerHTML).not.toMatch(/(?:bg|text|border)-(?:green|red)-\d/);
    };
    evento('user:online', { userId: 's1' });
    expect(within(contacto('Rui')).getByText('Online')).toBeInTheDocument();
    limpo();
    await abreConversa('Maria Cliente', [
      { id: 'a', sender_type: 'manager', content: 'Falhou', channel: 'email', delivery_status: 'failed', created_at: AGORA },
    ]);
    expect(screen.getByText('Falha ao entregar')).toBeInTheDocument();
    limpo();
  });

  it('desliga o socket ao sair', async () => {
    await abre();
    cleanup();
    expect(sock.disconnect).toHaveBeenCalled();
  });
});
