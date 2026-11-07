import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ChatTab from '../pages/staff/ChatTab';
import useAuthStore from '../store/authStore';
import { io } from 'socket.io-client';
import { listMessages, sendMessage, listGroups, createGroup } from '../services/messageService';
import { COLABORADORES, GRUPOS, MENSAGENS, AGORA } from './helpers/staffFixtures';

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
  listMessages: vi.fn(), sendMessage: vi.fn(), getUnreadCount: vi.fn(), listGroups: vi.fn(), createGroup: vi.fn(),
}));

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;

let spyErr; let spyWarn; let errosEsperados;
beforeEach(() => {
  errosEsperados = false;
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  sock.handlers = {};
  sock.disconnect.mockClear();
  io.mockClear();
  useAuthStore.setState({ token: 'tok', operator: { id: 'op1' } });
  listGroups.mockReset().mockResolvedValue(GRUPOS);
  listMessages.mockReset().mockResolvedValue({ data: MENSAGENS });
  sendMessage.mockReset().mockImplementation(async (d) => ({ id: `n-${d.content}`, sender_id: 'op1', content: d.content, created_at: AGORA }));
  createGroup.mockReset().mockImplementation(async (d) => ({ id: 'g2', name: d.name }));
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  useAuthStore.setState({ token: null, operator: null });
  vi.restoreAllMocks();
  if (!errosEsperados) expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

async function montar() {
  const r = render(<ChatTab staffList={COLABORADORES} />);
  await screen.findByText('Equipa Campo');
  return r;
}
async function abrir(nome) {
  fireEvent.click(screen.getAllByText(nome, { selector: 'span' }).find(e => e.closest('button')));
  await waitFor(() => expect(listMessages).toHaveBeenCalled());
}
/* o texto de uma mensagem que tambem aparece no contexto de uma resposta: so o paragrafo da bolha */
const esperaMsg = async (t) => (await screen.findAllByText(t, { selector: 'p' }))[0];
const chegou = (msg) => act(() => { sock.handlers['message:new'](msg); });
const escrever = (texto) => fireEvent.change(screen.getByPlaceholderText('Escrever mensagem...'), { target: { value: texto } });
const enviar = () => fireEvent.submit(screen.getByPlaceholderText('Escrever mensagem...').closest('form'));
const preview = () => [...document.querySelectorAll('div')].find(d => d.className.includes('border-t') && d.className.includes('bg-ocean-50'));

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Chat: conversas', () => {
  it('lista_grupos_e_colaboradores_e_pede_listGroups', async () => {
    await montar();
    expect(listGroups).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Grupos')).toBeInTheDocument();
    expect(screen.getByText('Direto')).toBeInTheDocument();
    ['Rui', 'Ana', 'Vera'].forEach(n => expect(screen.getByText(n, { selector: 'span' })).toBeInTheDocument());
    expect(screen.getByText('Seleccionar uma conversa')).toBeInTheDocument();
    expect(screen.getByText('Mensagens')).toBeInTheDocument();
  });

  it('escolher_uma_conversa_pede_as_mensagens_com_group_id_ou_recipient_id', async () => {
    await montar();
    await abrir('Equipa Campo');
    expect(listMessages).toHaveBeenLastCalledWith({ group_id: 'g1' });
    expect(await esperaMsg('Ola equipa')).toBeInTheDocument();
    expect(screen.getByText('Bom dia')).toBeInTheDocument();
    await abrir('Rui');
    expect(listMessages).toHaveBeenLastCalledWith({ recipient_id: 's1' });
  });

  it('mensagens_proprias_e_alheias_com_nome_hora_e_resposta', async () => {
    await montar();
    await abrir('Rui');
    const alheia = (await esperaMsg('Ola equipa')).closest('div.rounded-lg');
    expect(alheia).toHaveTextContent('Rui'); /* primeiro nome do remetente */
    expect(alheia).toHaveTextContent(/\d{2}:\d{2}/);
    const propria = screen.getByText('Bom dia').closest('div.rounded-lg');
    expect(propria).not.toHaveTextContent('Rui');
    /* a resposta mostra o remetente e o inicio da mensagem original */
    const contexto = propria.parentElement.querySelector('div.border-l-2');
    expect(contexto).toHaveTextContent('Rui');
    expect(contexto).toHaveTextContent('Ola equipa');
  });

  it('sem_mensagens_e_listMessages_a_falhar_mostram_Sem_mensagens_ainda', async () => {
    listMessages.mockResolvedValue({ data: [] });
    await montar();
    await abrir('Rui');
    expect(await screen.findByText('Sem mensagens ainda')).toBeInTheDocument();
    listMessages.mockRejectedValue(new Error('x'));
    await abrir('Ana');
    expect(await screen.findByText('Sem mensagens ainda')).toBeInTheDocument();
  });
});

describe('Chat: enviar e tempo real', () => {
  it('enviar_directo_chama_sendMessage_com_o_payload_e_nao_duplica_com_o_socket', async () => {
    await montar();
    await abrir('Rui');
    await esperaMsg('Ola equipa');
    const botao = screen.getByPlaceholderText('Escrever mensagem...').closest('form').querySelector('button[type="submit"]');
    expect(botao).toBeDisabled();
    escrever('Ola de novo');
    expect(botao).not.toBeDisabled();
    enviar();
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith({
      content: 'Ola de novo', message_type: 'direct', reply_to_id: undefined, recipient_id: 's1', recipient_type: 'staff',
    }));
    expect(await screen.findByText('Ola de novo')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Escrever mensagem...')).toHaveValue('');
    chegou({ id: 'n-Ola de novo', sender_id: 'op1', recipient_id: 's1', content: 'Ola de novo', created_at: AGORA });
    expect(screen.getAllByText('Ola de novo')).toHaveLength(1);
  });

  it('enviar_para_grupo_e_a_responder_leva_group_id_e_reply_to_id', async () => {
    await montar();
    await abrir('Equipa Campo');
    await esperaMsg('Ola equipa');
    fireEvent.click(screen.getAllByTitle('Responder')[0]);
    expect(preview()).toHaveTextContent('Ola equipa');
    escrever('Resposta');
    enviar();
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith({
      content: 'Resposta', message_type: 'group', reply_to_id: 'm1', group_id: 'g1',
    }));
    await waitFor(() => expect(preview()).toBeUndefined());
  });

  it('responder_mostra_a_pre_visualizacao_e_o_botao_x_limpa', async () => {
    await montar();
    await abrir('Rui');
    await esperaMsg('Ola equipa');
    fireEvent.click(screen.getAllByTitle('Responder')[0]);
    expect(preview()).toBeTruthy();
    fireEvent.click(preview().querySelector('button'));
    expect(preview()).toBeUndefined();
  });

  it('message_new_so_entra_se_for_da_conversa_aberta', async () => {
    await montar();
    chegou({ id: 'x0', sender_id: 's1', content: 'Sem conversa', created_at: AGORA });
    await abrir('Equipa Campo');
    await esperaMsg('Ola equipa');
    chegou({ id: 'x1', group_id: 'g1', sender_id: 's1', content: 'Do grupo', created_at: AGORA });
    chegou({ id: 'x2', group_id: 'g2', sender_id: 's1', content: 'Outro grupo', created_at: AGORA });
    chegou({ id: 'x3', sender_id: 's1', content: 'Directa solta', created_at: AGORA });
    expect(screen.getByText('Do grupo')).toBeInTheDocument();
    expect(screen.queryByText('Sem conversa')).toBeNull();
    expect(screen.queryByText('Outro grupo')).toBeNull();
    expect(screen.queryByText('Directa solta')).toBeNull();
    chegou({ id: 'x1', group_id: 'g1', sender_id: 's1', content: 'Do grupo', created_at: AGORA }); /* repetida */
    expect(screen.getAllByText('Do grupo')).toHaveLength(1);
    await abrir('Rui');
    await esperaMsg('Ola equipa');
    chegou({ id: 'd1', sender_id: 's1', content: 'Do Rui', created_at: AGORA });
    chegou({ id: 'd2', sender_id: 'op1', recipient_id: 's1', content: 'Para o Rui', created_at: AGORA });
    chegou({ id: 'd3', sender_id: 's2', content: 'Da Ana', created_at: AGORA });
    chegou({ id: 'd4', group_id: 'g1', sender_id: 's1', content: 'De grupo', created_at: AGORA });
    expect(screen.getByText('Do Rui')).toBeInTheDocument();
    expect(screen.getByText('Para o Rui')).toBeInTheDocument();
    expect(screen.queryByText('Da Ana')).toBeNull();
    expect(screen.queryByText('De grupo')).toBeNull();
  });

  it('o_socket_e_criado_com_o_token_e_desliga_ao_desmontar', async () => {
    const { unmount } = await montar();
    expect(io).toHaveBeenCalledTimes(1);
    expect(io.mock.calls[0][1]).toMatchObject({ auth: { token: 'tok' }, transports: ['websocket'], reconnectionAttempts: 3 });
    unmount();
    expect(sock.disconnect).toHaveBeenCalledTimes(1);
  });

  it('falhas_de_envio_nao_rebentam', async () => {
    errosEsperados = true;
    sendMessage.mockRejectedValue(new Error('x'));
    await montar();
    await abrir('Rui');
    escrever('Falha');
    enviar();
    await waitFor(() => expect(sendMessage).toHaveBeenCalled());
    expect(screen.getByPlaceholderText('Escrever mensagem...')).toHaveValue('Falha'); /* nao limpa */
  });
});

describe('Chat: fixar, grupos e broadcast', () => {
  it('fixar_grava_em_localStorage_mostra_a_barra_e_o_contador_e_desafixar_remove', async () => {
    await montar();
    await abrir('Equipa Campo');
    await esperaMsg('Ola equipa');
    fireEvent.click(screen.getAllByTitle('Fixar')[0]);
    expect(JSON.parse(localStorage.getItem('saldesk_pins_g1'))).toEqual(['m1']);
    expect(screen.getByText('1 fixada(s)')).toBeInTheDocument();
    expect(screen.getAllByTitle('Desafixar').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByTitle('Desafixar')[0]);
    expect(JSON.parse(localStorage.getItem('saldesk_pins_g1'))).toEqual([]);
    expect(screen.queryByText('1 fixada(s)')).toBeNull();
  });

  it('ao_abrir_a_conversa_restaura_as_fixadas', async () => {
    localStorage.setItem('saldesk_pins_g1', JSON.stringify(['m2']));
    await montar();
    await abrir('Equipa Campo');
    expect(await screen.findByText('1 fixada(s)')).toBeInTheDocument();
  });

  it('novo_grupo_chama_createGroup_e_acrescenta_e_nome_vazio_nao_faz_nada', async () => {
    await montar();
    fireEvent.click(screen.getByTitle('Novo grupo'));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Novo grupo');
    fireEvent.submit(dlg.querySelector('form'));
    expect(createGroup).not.toHaveBeenCalled();
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: Equipa de campo'), { target: { value: ' Equipa Mar ' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar grupo' }));
    await waitFor(() => expect(createGroup).toHaveBeenCalledWith({ name: 'Equipa Mar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Equipa Mar')).toBeInTheDocument();
  });

  it('broadcast_envia_uma_mensagem_directa_por_colaborador_e_fecha', async () => {
    await montar();
    fireEvent.click(screen.getByTitle('Broadcast'));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Broadcast — enviar a todos');
    expect(dlg).toHaveTextContent('enviada individualmente para 3 colaborador(es) activo(s)');
    fireEvent.change(within(dlg).getByPlaceholderText('Escrever mensagem de broadcast...'), { target: { value: ' Reuniao as 9 ' } });
    fireEvent.click(within(dlg).getByRole('button', { name: /Enviar/ }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(3));
    expect(sendMessage.mock.calls.map(c => c[0])).toEqual(['s1', 's2', 's3'].map(id => ({
      content: 'Reuniao as 9', message_type: 'direct', recipient_id: id, recipient_type: 'staff',
    })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('falhas_de_grupo_e_de_broadcast_nao_rebentam', async () => {
    errosEsperados = true;
    createGroup.mockRejectedValue(new Error('x'));
    sendMessage.mockRejectedValue(new Error('x'));
    await montar();
    fireEvent.click(screen.getByTitle('Novo grupo'));
    fireEvent.change(screen.getByPlaceholderText('Ex: Equipa de campo'), { target: { value: 'G' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar grupo' }));
    await waitFor(() => expect(createGroup).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByTitle('Broadcast'));
    fireEvent.change(screen.getByPlaceholderText('Escrever mensagem de broadcast...'), { target: { value: 'M' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar/ }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

/* ───────────────────────── design system ───────────────────────── */

describe('Chat com o design system', () => {
  it('os_botoes_de_icone_e_a_caixa_de_mensagem_tem_nome_acessivel', async () => {
    await montar();
    expect(screen.getByRole('button', { name: 'Broadcast' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo grupo' })).toBeInTheDocument();
    await abrir('Equipa Campo');
    await esperaMsg('Ola equipa');
    expect(screen.getByLabelText('Escrever mensagem')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Responder' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Fixar' })[0]);
    expect(screen.getByRole('button', { name: 'Desafixar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desafixar mensagem fixada' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Responder' })[0]);
    expect(screen.getByRole('button', { name: 'Cancelar resposta' })).toBeInTheDocument();
  });

  it('o_vazio_e_os_campos_dos_modais_tem_o_design_system', async () => {
    await montar();
    expect(screen.getByText('Seleccionar uma conversa')).toHaveClass('font-display');
    fireEvent.click(screen.getByRole('button', { name: 'Novo grupo' }));
    expect(screen.getByLabelText('Nome do grupo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Broadcast' }));
    expect(screen.getByLabelText('Mensagem')).toBeInTheDocument();
  });

  it('sem_hexadecimais_cores_nomeadas_nem_classes_sand_inexistentes', async () => {
    const { container } = await montar();
    await abrir('Equipa Campo');
    await esperaMsg('Ola equipa');
    fireEvent.click(screen.getAllByTitle('Fixar')[0]);
    fireEvent.click(screen.getAllByTitle('Responder')[0]);
    fireEvent.click(screen.getByTitle('Broadcast'));
    const html = container.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html).not.toMatch(/sand-(?:700|200)/);
    expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  });
});
