import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FounderChat from '../pages/FounderChat';
import { getFounderConversation, sendFounderMessage } from '../services/founderChatService';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

/* Sem rede: so os servicos da pagina sao simulados */
vi.mock('../services/founderChatService', () => ({
  getFounderConversation: vi.fn(),
  sendFounderMessage: vi.fn(),
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

const MENSAGENS = [
  { id: 'm1', sender_type: 'operator', content: 'Ola equipa', created_at: new Date().toISOString() },
  { id: 'm2', sender_type: 'team', content: 'Em que podemos ajudar?', created_at: new Date().toISOString() },
];

describe('FounderChat', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    getFounderConversation.mockReset().mockResolvedValue(MENSAGENS);
    sendFounderMessage.mockReset().mockImplementation(async (texto) => ({ id: `n-${texto}`, sender_type: 'operator', content: texto, created_at: new Date().toISOString() }));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    /* a guarda conta ANTES de restaurar os espioes */
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    errSpy.mockRestore();
    warnSpy.mockRestore();
    expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  function renderPagina() {
    return render(
      <MemoryRouter future={FUTURE}>
        <FounderChat />
      </MemoryRouter>
    );
  }
  async function abre() {
    renderPagina();
    await screen.findByText('Ola equipa');
  }
  /* a pagina so tem um botao: o de enviar */
  function enviar() {
    return screen.getByRole('button');
  }
  function caixa() {
    return screen.getByPlaceholderText('Escreve uma mensagem...');
  }

  it('mostra as mensagens alinhadas pelo remetente', async () => {
    await abre();
    expect(screen.getByText('Ola equipa').closest('div').parentElement.className).toContain('justify-end');
    expect(screen.getByText('Em que podemos ajudar?').closest('div').parentElement.className).toContain('justify-start');
  });

  it('sem mensagens mostra o vazio', async () => {
    getFounderConversation.mockResolvedValue([]);
    renderPagina();
    expect(await screen.findByText('Sem mensagens ainda')).toBeInTheDocument();
    expect(screen.getByText('Escreve aqui se precisares de contactar a equipa SalDesk')).toBeInTheDocument();
  });

  it('enviar chama sendFounderMessage com o texto aparado, acrescenta a mensagem e limpa a caixa', async () => {
    await abre();
    fireEvent.change(caixa(), { target: { value: '  Preciso de ajuda  ' } });
    fireEvent.click(enviar());
    await waitFor(() => expect(sendFounderMessage).toHaveBeenCalledWith('Preciso de ajuda'));
    expect(await screen.findByText('Preciso de ajuda')).toBeInTheDocument();
    await waitFor(() => expect(caixa().value).toBe(''));
  });

  it('Enter envia e Shift+Enter nao', async () => {
    await abre();
    fireEvent.change(caixa(), { target: { value: 'Uma' } });
    fireEvent.keyDown(caixa(), { key: 'Enter', shiftKey: true });
    expect(sendFounderMessage).not.toHaveBeenCalled();
    fireEvent.keyDown(caixa(), { key: 'Enter' });
    await waitFor(() => expect(sendFounderMessage).toHaveBeenCalledWith('Uma'));
    await screen.findAllByText('Uma');
  });

  it('o botao fica desactivado sem texto e enquanto envia', async () => {
    let resolve;
    sendFounderMessage.mockReset().mockImplementation(() => new Promise((res) => { resolve = res; }));
    await abre();
    expect(enviar()).toBeDisabled();
    fireEvent.change(caixa(), { target: { value: '   ' } });
    expect(enviar()).toBeDisabled();
    fireEvent.change(caixa(), { target: { value: 'Ola' } });
    expect(enviar()).not.toBeDisabled();
    fireEvent.click(enviar());
    await waitFor(() => expect(enviar()).toBeDisabled());
    resolve({ id: 'n1', sender_type: 'operator', content: 'Ola', created_at: new Date().toISOString() });
    await waitFor(() => expect(caixa().value).toBe(''));
  });

  it('se o envio falhar mantem o texto e reactiva o botao', async () => {
    sendFounderMessage.mockReset().mockRejectedValue(new Error('rede'));
    await abre();
    fireEvent.change(caixa(), { target: { value: 'Ola' } });
    fireEvent.click(enviar());
    await waitFor(() => expect(sendFounderMessage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(enviar()).not.toBeDisabled());
    expect(caixa().value).toBe('Ola');
  });

  it('recarrega a conversa a cada 20 segundos', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    renderPagina();
    await act(async () => {});
    expect(getFounderConversation).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(getFounderConversation).toHaveBeenCalledTimes(2);
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(getFounderConversation).toHaveBeenCalledTimes(3);
  });

  it('o botao de enviar tem o nome Enviar', async () => {
    await abre();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
  });

  it('se carregar falhar nao rebenta e mostra o vazio', async () => {
    getFounderConversation.mockRejectedValue(new Error('rede'));
    renderPagina();
    expect(await screen.findByText('Sem mensagens ainda')).toBeInTheDocument();
  });
});

/* Painel em ingles: os rotulos mudam; o que as pessoas escreveram aparece como foi escrito */
describe('FounderChat em ingles', () => {
  const DADOS = ['Ola equipa', 'Em que podemos ajudar?'];
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    useUiStore.setState({ lang: 'en' });
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    getFounderConversation.mockReset().mockResolvedValue(MENSAGENS);
    sendFounderMessage.mockReset().mockImplementation(async (texto) => ({ id: `n-${texto}`, sender_type: 'operator', content: texto, created_at: new Date().toISOString() }));
  });

  afterEach(() => {
    cleanup();
    useUiStore.setState({ lang: 'pt' });
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    errSpy.mockRestore();
    warnSpy.mockRestore();
    expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  function renderEn() {
    return render(
      <MemoryRouter future={FUTURE}>
        <FounderChat />
      </MemoryRouter>
    );
  }

  it('mostra_titulo_subtitulo_placeholder_e_botao_em_ingles_sem_portugues', async () => {
    renderEn();
    await screen.findByText('Ola equipa');
    expect(screen.getByRole('heading', { name: 'SalDesk messages' })).toBeInTheDocument();
    expect(screen.getByText('Direct conversation with the SalDesk team')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Write a message...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    /* a hora de hoje usa o formato ingles (24 h, dois pontos) */
    const hora = new Date(MENSAGENS[0].created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    expect(screen.getAllByText(hora).length).toBeGreaterThan(0);
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['founderChat'])).toEqual([]);
  });

  it('sem_mensagens_em_ingles_mostra_o_vazio_traduzido', async () => {
    getFounderConversation.mockResolvedValue([]);
    renderEn();
    expect(await screen.findByText('No messages yet')).toBeInTheDocument();
    expect(screen.getByText('Write here if you need to contact the SalDesk team')).toBeInTheDocument();
    expect(portuguesNoEcra()).toEqual([]);
  });

  it('enviar_em_ingles_manda_o_texto_tal_como_foi_escrito', async () => {
    renderEn();
    await screen.findByText('Ola equipa');
    fireEvent.change(screen.getByPlaceholderText('Write a message...'), { target: { value: '  Preciso de ajuda  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(sendFounderMessage).toHaveBeenCalledWith('Preciso de ajuda'));
    expect(await screen.findByText('Preciso de ajuda')).toBeInTheDocument();
  });
});
