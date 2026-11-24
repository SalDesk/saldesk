import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WhatsAppSend from '../components/messaging/WhatsAppSend';
import WhatsAppPendentes from '../components/messaging/WhatsAppPendentes';
import useUiStore from '../store/uiStore';
import useToastStore from '../store/toastStore';
import { sendReservationMessage, markMessageOpened, listOutbox } from '../services/messagingService';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

/* Sem rede: a camada de mensagens e simulada; o texto do cliente vem do servidor dentro do endereco wa.me */
vi.mock('../services/messagingService', () => ({
  sendReservationMessage: vi.fn(),
  markMessageOpened: vi.fn(),
  listOutbox: vi.fn(),
}));

const URL_WA = 'https://wa.me/2389912233?text=Ol%C3%A1%20Ana!%20A%20sua%20reserva%20foi%20confirmada.';

function ultimoToast() {
  const toasts = useToastStore.getState().toasts;
  return toasts[toasts.length - 1];
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  sendReservationMessage.mockReset().mockResolvedValue({ id: 'm1', url: URL_WA, created: true });
  markMessageOpened.mockReset().mockResolvedValue({});
  listOutbox.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  useUiStore.setState({ lang: 'pt' });
  vi.restoreAllMocks();
});

/* abre a janela ja no clique; devolve o objecto onde o endereco entra depois */
function simulaJanela() {
  const janela = { opener: {}, location: { href: '' }, close: vi.fn() };
  vi.spyOn(window, 'open').mockImplementation(() => janela);
  return janela;
}

describe.each([
  ['pt', { confirmation: 'Confirmação', reminder: 'Lembrete', review: 'Pedir avaliação', opened: 'Confirmação: WhatsApp aberto', noPhone: 'O cliente não tem telefone registado.', erro: 'Não foi possível preparar a mensagem' }],
  ['en', { confirmation: 'Confirmation', reminder: 'Reminder', review: 'Request review', opened: 'Confirmation: WhatsApp opened', noPhone: 'The customer has no phone number on file.', erro: 'Could not prepare the message' }],
])('WhatsAppSend com o painel em %s', (lang, txt) => {
  beforeEach(() => { useUiStore.setState({ lang }); });

  it('os_botoes_seguem_o_estado_da_reserva_e_o_pedido_ao_servidor_e_igual_nas_duas_linguas', async () => {
    const janela = simulaJanela();
    render(<WhatsAppSend reservationId="r1" status="confirmed" hasPhone />);
    expect(screen.getByRole('button', { name: txt.confirmation })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: txt.reminder })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: txt.review })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: txt.confirmation }));
    await waitFor(() => expect(sendReservationMessage).toHaveBeenCalledWith('r1', 'booking_confirmed'));
    /* o texto da mensagem para o cliente (portugues) vai dentro do endereco que o servidor devolveu, intacto */
    await waitFor(() => expect(janela.location.href).toBe(URL_WA));
    expect(decodeURIComponent(janela.location.href)).toContain('Olá Ana! A sua reserva foi confirmada.');
    expect(markMessageOpened).toHaveBeenCalledWith('m1');
    expect(ultimoToast().message).toBe(txt.opened);
  });

  it('sem_telefone_avisa_e_desactiva_os_botoes', () => {
    render(<WhatsAppSend reservationId="r1" status="checked_out" hasPhone={false} />);
    expect(screen.getByText(txt.noPhone)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: txt.review })).toBeDisabled();
  });

  it('um_erro_ao_preparar_mostra_o_aviso_na_lingua_do_painel', async () => {
    simulaJanela();
    sendReservationMessage.mockRejectedValue(new Error('rede'));
    render(<WhatsAppSend reservationId="r1" status="confirmed" hasPhone />);
    fireEvent.click(screen.getByRole('button', { name: txt.reminder }));
    await waitFor(() => expect(ultimoToast()?.type).toBe('error'));
    expect(ultimoToast().message).toBe(txt.erro);
  });
});

describe('WhatsAppSend em ingles', () => {
  beforeEach(() => { useUiStore.setState({ lang: 'en' }); });

  it('o_navegador_a_bloquear_a_janela_mostra_a_ligacao_em_ingles_sem_portugues', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<WhatsAppSend reservationId="r1" status="confirmed" hasPhone />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmation' }));
    const ligacao = await screen.findByRole('link', { name: /The browser blocked the window: open WhatsApp/ });
    expect(ligacao).toHaveAttribute('href', URL_WA);
    expect(portuguesNoEcra()).toEqual([]);
    expect(chavesCruas(['whatsappMessages'])).toEqual([]);
  });

  it('o_canal_automatico_e_a_mensagem_ja_preparada_usam_os_avisos_em_ingles', async () => {
    const janela = simulaJanela();
    sendReservationMessage.mockResolvedValueOnce({ id: 'm2', automatico: true });
    render(<WhatsAppSend reservationId="r1" status="confirmed" hasPhone />);
    fireEvent.click(screen.getByRole('button', { name: 'Reminder' }));
    await waitFor(() => expect(ultimoToast()?.message).toBe('Reminder: sending by WhatsApp'));
    expect(janela.close).toHaveBeenCalled();
    sendReservationMessage.mockResolvedValueOnce({ id: 'm3', url: URL_WA, created: false });
    fireEvent.click(screen.getByRole('button', { name: 'Reminder' }));
    await waitFor(() => expect(ultimoToast()?.message).toBe('Reminder was already prepared: WhatsApp opened'));
  });
});

describe('WhatsAppPendentes', () => {
  const LINHAS = [
    { id: 'o1', trigger: 'booking_confirmed', handoff_url: 'https://wa.me/1?text=x', display: { customerName: 'Ana Cliente', tourName: 'Buggy Tour', date: '2026-03-10' } },
    { id: 'o2', trigger: 'review_request', handoff_url: 'https://wa.me/2?text=y', to_e164: '+2389900', display: {} },
    { id: 'o3', trigger: 'automation', handoff_url: 'https://wa.me/3?text=z', display: { customerName: 'Rui' } },
    { id: 'o4', trigger: 'outro', handoff_url: 'https://wa.me/4?text=w', display: { customerName: 'Vera' } },
    { id: 'o5', trigger: 'reminder_d1', handoff_url: 'https://wa.me/5?text=v', display: { customerName: 'Eva' } },
    { id: 'o6', trigger: 'reminder_d1', handoff_url: 'https://wa.me/6?text=u', display: { customerName: 'Tom' } },
  ];
  /* nomes de clientes e de tours sao dados do operador */
  const DADOS = ['Ana Cliente', 'Buggy Tour', 'Rui', 'Vera', 'Eva', 'Tom'];

  it('em_portugues_mostra_o_titulo_os_rotulos_a_data_e_o_que_falta', async () => {
    listOutbox.mockResolvedValue(LINHAS);
    render(<WhatsAppPendentes />);
    expect(await screen.findByText(/WhatsApp por enviar/)).toBeInTheDocument();
    expect(screen.getByText('Confirmação · Buggy Tour · 10/03/2026')).toBeInTheDocument();
    expect(screen.getByText('Avaliação')).toBeInTheDocument();
    expect(screen.getByText('Automação')).toBeInTheDocument();
    expect(screen.getByText('Mensagem')).toBeInTheDocument();
    expect(screen.getByText('+ 1 mensagem(ns) por enviar')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Abrir WhatsApp' })).toHaveLength(5);
  });

  it('em_ingles_traduz_titulo_rotulos_botao_e_o_que_falta_sem_portugues', async () => {
    useUiStore.setState({ lang: 'en' });
    listOutbox.mockResolvedValue(LINHAS);
    render(<WhatsAppPendentes />);
    expect(await screen.findByText(/WhatsApp to send/)).toBeInTheDocument();
    expect(screen.getByText('Confirmation · Buggy Tour · 10/03/2026')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Automation')).toBeInTheDocument();
    expect(screen.getByText('Message')).toBeInTheDocument();
    expect(screen.getByText('+ 1 message(s) to send')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Open WhatsApp' })).toHaveLength(5);
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['whatsappMessages'])).toEqual([]);
  });

  it('abrir_em_ingles_abre_o_endereco_do_servidor_e_regista_a_abertura', async () => {
    useUiStore.setState({ lang: 'en' });
    listOutbox.mockResolvedValue(LINHAS.slice(0, 2));
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<WhatsAppPendentes />);
    const botoes = await screen.findAllByRole('button', { name: 'Open WhatsApp' });
    fireEvent.click(botoes[0]);
    expect(abrir).toHaveBeenCalledWith('https://wa.me/1?text=x', '_blank', 'noopener,noreferrer');
    await waitFor(() => expect(markMessageOpened).toHaveBeenCalledWith('o1'));
    expect(screen.getAllByRole('button', { name: 'Open WhatsApp' })).toHaveLength(1);
  });

  it('sem_nada_por_enviar_nao_aparece', async () => {
    const { container } = render(<WhatsAppPendentes />);
    await waitFor(() => expect(listOutbox).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
