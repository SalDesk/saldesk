import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Settings from '../pages/Settings';
import api from '../services/api';
import { updateOperator, changePassword } from '../services/authService';
import { createSubscription, cancelSubscription, getBillingHistory, createSispCheckout } from '../services/billingService';
import { uploadImage, validateImageFile } from '../services/uploadService';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock('../services/authService', () => ({ updateOperator: vi.fn(), changePassword: vi.fn() }));
vi.mock('../services/billingService', () => ({
  createSubscription: vi.fn(), cancelSubscription: vi.fn(), getBillingHistory: vi.fn(), createSispCheckout: vi.fn(),
}));
vi.mock('../services/uploadService', () => ({
  uploadImage: vi.fn(), validateImageFile: vi.fn(), ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
}));
vi.mock('../components/messaging/TemplatesEditor', () => ({ default: () => <div>EDITOR MENSAGENS</div> }));

const norm = (t) => t.replace(/\s/g, ' ');
const dia = (n) => new Date(Date.now() + n * 86400000).toISOString();

const OPERADOR = {
  id: 'op1', name: 'Sal Aventura', email: 'a@x.test', phone: '+238 111', whatsapp: '+238 222', address: 'Rua 1',
  language: 'en', currency: 'EUR', timezone: 'Europe/Lisbon', slug: 'demo',
  plan: 'pro', plan_status: 'active', plan_paid_until: dia(20), paypal_subscription_id: 'I-1',
  description: 'Desc PT', cancellation_policy_pt: 'CP PT', cancellation_policy_en: 'CP EN',
  custom_faqs: [
    { question_pt: 'P1', question_en: 'Q1', answer_pt: 'R1', answer_en: 'A1' },
    { question_pt: 'P2', question_en: '', answer_pt: '', answer_en: '' },
  ],
  logo_url: null, notification_prefs: { new_booking: false }, notif_channel: 'push',
};
const PAGAMENTOS = { has_paypal: true, has_paypal_webhook: false, has_sisp: false, paypal_client_id: 'x', paypal_webhook_id: null, sisp_merchant_id: null };
const HISTORICO = [
  { id: 'h1', plan: 'pro', created_at: '2026-10-01T10:00:00Z', amount_eur: 69, status: 'completed' },
  { id: 'h2', plan: 'business', created_at: '2026-09-01T10:00:00Z', amount_eur: '79', status: 'failed' },
  { id: 'h3', plan: 'starter', created_at: '2026-08-01T10:00:00Z', amount_eur: 29, status: 'pending' },
];
const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');

let spyErr; let spyWarn; let writeText; let respostas; let origCreate; let origRevoke;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  writeText = vi.fn().mockResolvedValue();
  uploadImage.mockReset().mockImplementation(async (file) => ({ url: `https://cdn.test/${file.name}` }));
  validateImageFile.mockReset().mockReturnValue(null);
  origCreate = URL.createObjectURL; origRevoke = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  respostas = {
    '/marketing/booking-link': { data: { data: { url: 'https://saldesk.cv/book/demo' } } },
    '/marketing/widget-code': { data: { data: { html: '<script data-slug="demo"></script>' } } },
    '/marketing/payment-settings': { data: { data: PAGAMENTOS } },
    '/auth/me': { data: { data: { operator: { ...OPERADOR, plan_status: 'cancelled', paypal_subscription_id: null } } } },
  };
  api.get.mockReset().mockImplementation(async (url) => { if (url in respostas) return respostas[url]; throw new Error('sem rota ' + url); });
  api.put.mockReset().mockResolvedValue({});
  updateOperator.mockReset().mockImplementation(async (dados) => ({ ...OPERADOR, ...dados }));
  changePassword.mockReset().mockResolvedValue({});
  getBillingHistory.mockReset().mockResolvedValue(HISTORICO);
  [createSubscription, cancelSubscription, createSispCheckout].forEach(f => f.mockReset());
  useUiStore.setState({ tourForceStart: false });
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  vi.useRealTimers();
  cleanup();
  document.querySelectorAll('form[data-sisp]').forEach(f => f.remove());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  URL.createObjectURL = origCreate; URL.revokeObjectURL = origRevoke;
  useAuthStore.setState({ token: null, operator: null });
  useUiStore.setState({ tourForceStart: false });
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

function montar(url = '/definicoes', operador = OPERADOR) {
  useAuthStore.setState({ token: 'tok', operator: operador });
  return render(
    <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/definicoes" element={<Settings />} />
        <Route path="/" element={<div>HOME</div>} />
        <Route path="/editor-pagina" element={<div>EDITOR</div>} />
      </Routes>
    </MemoryRouter>,
  );
}
const separador = (rotulo) => screen.getAllByText(rotulo).find(e => e.closest('button')).closest('button');
const abrir = async (rotulo, ancora) => { fireEvent.click(separador(rotulo)); await screen.findAllByText(ancora); };
const campo = (etiqueta, tag = 'input', raiz = screen) => raiz.getByText(etiqueta).parentElement.querySelector(tag);
const cartao = (titulo) => {
  const h = screen.getByText(titulo, { selector: 'h2,h3' });
  return h.closest('section') || h.parentElement.parentElement;
};
const botao = (nome) => screen.getByRole('button', { name: nome });
const ultimoPut = () => updateOperator.mock.calls[updateOperator.mock.calls.length - 1][0];

/* ───────────────────────── caracterizacao: estrutura ───────────────────────── */

describe('Definições: estrutura', () => {
  it('abre_em_Conta_e_o_query_string_tab_escolhe_o_separador_inicial', async () => {
    montar();
    expect(screen.getByText('Definições')).toBeInTheDocument();
    expect(screen.getByText('Dados da empresa')).toBeInTheDocument();
    cleanup();
    montar('/definicoes?tab=notificacoes');
    expect(screen.getByText('Canal de notificações')).toBeInTheDocument();
    cleanup();
    montar('/definicoes?tab=nao-existe');
    expect(screen.getByText('Dados da empresa')).toBeInTheDocument();
  });

  it('os_sete_separadores_trocam_o_conteudo', async () => {
    montar();
    for (const [rotulo, ancora] of [
      ['Perfil Público', 'Logo'], ['Pagamentos', 'Guardar credenciais'], ['Facturação', 'Subscrição actual'],
      ['Notificações', 'Canal de notificações'], ['Mensagens', 'EDITOR MENSAGENS'], ['Segurança', 'Alterar password'], ['Conta', 'Dados da empresa'],
    ]) {
      await abrir(rotulo, ancora);
    }
    expect(screen.queryByText('EDITOR MENSAGENS')).not.toBeInTheDocument();
  });
});

/* ───────────────────────── caracterizacao: Conta ───────────────────────── */

describe('Definições: Conta', () => {
  it('mostra_os_valores_do_operador_e_os_por_omissao', () => {
    montar();
    expect(campo('Nome da empresa')).toHaveValue('Sal Aventura');
    expect(campo('Email')).toHaveValue('a@x.test');
    expect(campo('Telefone')).toHaveValue('+238 111');
    expect(campo('WhatsApp')).toHaveValue('+238 222');
    expect(campo('Morada')).toHaveValue('Rua 1');
    expect(campo('Idioma', 'select')).toHaveValue('en');
    expect(campo('Moeda', 'select')).toHaveValue('EUR');
    expect(campo('Fuso horário', 'select')).toHaveValue('Europe/Lisbon');
    cleanup();
    montar('/definicoes', { id: 'o', name: 'X', email: 'e@x.test' });
    expect(campo('Idioma', 'select')).toHaveValue('pt');
    expect(campo('Moeda', 'select')).toHaveValue('CVE');
    expect(campo('Fuso horário', 'select')).toHaveValue('Atlantic/Cape_Verde');
    expect(campo('Telefone')).toHaveValue('');
  });

  it('as_opcoes_de_idioma_moeda_e_fuso_horario', () => {
    montar();
    expect([...campo('Idioma', 'select').options].map(o => o.textContent)).toEqual(['PT', 'EN', 'DE', 'NL', 'FR', 'ES']);
    expect([...campo('Moeda', 'select').options].map(o => o.textContent)).toEqual(['CVE', 'EUR', 'USD', 'GBP']);
    expect([...campo('Fuso horário', 'select').options].map(o => o.textContent)).toEqual([
      'Atlantic/Cape Verde', 'Europe/Lisbon', 'Europe/London', 'America/New York', 'America/Sao_Paulo'.replace('_', ' '),
    ]);
  });

  it('guardar_envia_so_os_campos_alterados_e_setOperator_e_mostra_Guardado_com_sucesso', async () => {
    montar();
    fireEvent.change(campo('Nome da empresa'), { target: { value: 'Novo Nome' } });
    fireEvent.change(campo('Moeda', 'select'), { target: { value: 'USD' } });
    fireEvent.click(botao('Guardar alterações'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalledTimes(1));
    expect(ultimoPut()).toEqual({ name: 'Novo Nome', currency: 'USD' });
    expect(await screen.findByText('Guardado com sucesso')).toBeInTheDocument();
    expect(useAuthStore.getState().operator.name).toBe('Novo Nome');
  });

  it('o_aviso_de_guardado_desaparece_apos_3s', async () => {
    montar();
    vi.useFakeTimers();
    fireEvent.click(botao('Guardar alterações'));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText('Guardado com sucesso')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
    expect(screen.getByText('Guardado com sucesso')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByText('Guardado com sucesso')).not.toBeInTheDocument();
  });

  it('sem_alteracoes_nao_chama_o_servidor_e_mostra_Guardado', async () => {
    montar();
    fireEvent.click(botao('Guardar alterações'));
    expect(await screen.findByText('Guardado com sucesso')).toBeInTheDocument();
    expect(updateOperator).not.toHaveBeenCalled();
  });

  it('a_segunda_gravacao_so_envia_o_que_mudou_desde_a_primeira', async () => {
    montar();
    fireEvent.change(campo('Nome da empresa'), { target: { value: 'Novo Nome' } });
    fireEvent.click(botao('Guardar alterações'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalledTimes(1));
    fireEvent.change(campo('Morada'), { target: { value: 'Rua 2' } });
    fireEvent.click(botao('Guardar alterações'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalledTimes(2));
    expect(ultimoPut()).toEqual({ address: 'Rua 2' });
  });

  it('erro_do_servidor_ou_Erro ao guardar', async () => {
    updateOperator.mockRejectedValueOnce({ response: { data: { error: 'Email inválido' } } });
    montar();
    fireEvent.change(campo('Email'), { target: { value: 'mau@x' } });
    fireEvent.click(botao('Guardar alterações'));
    expect(await screen.findByText('Email inválido')).toBeInTheDocument();
    updateOperator.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(botao('Guardar alterações'));
    expect(await screen.findByText('Erro ao guardar')).toBeInTheDocument();
  });

  it('Rever_tour_inicia_o_tour_e_vai_para_a_raiz', async () => {
    montar();
    expect(screen.getByText('Tour de boas-vindas')).toBeInTheDocument();
    fireEvent.click(botao('Rever tour'));
    expect(useUiStore.getState().tourForceStart).toBe(true);
    expect(await screen.findByText('HOME')).toBeInTheDocument();
  });
});

/* ───────────────────────── caracterizacao: Perfil Publico ───────────────────────── */

const faq = (n) => screen.getByText(`Pergunta ${n}`).parentElement.parentElement;
const campoFaq = (n, etiqueta, tag = 'input') => within(faq(n)).getByText(etiqueta).parentElement.querySelector(tag);
const setas = (n) => within(faq(n).firstChild).getAllByRole('button');
async function abrirPerfil(op = OPERADOR) {
  const r = montar('/definicoes', op);
  await abrir('Perfil Público', 'Logo');
  await screen.findByText(/saldesk\.cv\/book\/demo|^\.\.\.$/);
  return r;
}
const arquivo = (nome, conteudo) => new File([conteudo], nome, { type: 'image/png' });

describe('Definições: Perfil Público', () => {
  it('mostra_os_valores_do_operador', async () => {
    await abrirPerfil();
    /* a descricao que o operador escreveu no registo e que os turistas lêem; nao ha descricao em ingles */
    expect(screen.getByLabelText('Descrição da empresa')).toHaveValue('Desc PT');
    expect(within(cartao('Descrição')).getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByText('Aparece na sua página pública e na lista de operadores do catálogo.')).toBeInTheDocument();
    expect(campo('Português', 'textarea', within(cartao('Política de cancelamento')))).toHaveValue('CP PT');
    expect(campo('Inglês (EN)', 'textarea', within(cartao('Política de cancelamento')))).toHaveValue('CP EN');
    expect(screen.getByText('Pergunta 1')).toBeInTheDocument();
    expect(campoFaq(1, 'Pergunta PT')).toHaveValue('P1');
    expect(campoFaq(2, 'Pergunta EN')).toHaveValue('');
  });

  it('escolher_o_logo_faz_upload_mostra_a_pre_visualizacao_e_guarda_o_url_e_nao_um_data_url', async () => {
    const { container } = await abrirPerfil();
    expect(screen.queryByAltText('Logo')).not.toBeInTheDocument();
    const ficheiro = arquivo('l.png', 'a');
    fireEvent.change(container.querySelector('input[type="file"]:not([multiple])'), { target: { files: [ficheiro] } });
    expect(await screen.findByAltText('Logo')).toHaveAttribute('src', 'https://cdn.test/l.png');
    expect(uploadImage).toHaveBeenCalledWith(ficheiro, expect.any(Function));
    fireEvent.click(botao('Guardar perfil'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalled());
    expect(ultimoPut().logo_url).toBe('https://cdn.test/l.png');
  });

  it('logo_invalido_ou_upload_falhado_mostra_o_erro_e_nao_altera_o_logo', async () => {
    const { container } = await abrirPerfil();
    const entrada = () => container.querySelector('input[type="file"]:not([multiple])');
    validateImageFile.mockReturnValueOnce('Formato inválido: l.gif. Usa JPG, PNG ou WebP.');
    fireEvent.change(entrada(), { target: { files: [arquivo('l.gif', 'a')] } });
    expect(await screen.findByText('Formato inválido: l.gif. Usa JPG, PNG ou WebP.')).toBeInTheDocument();
    expect(uploadImage).not.toHaveBeenCalled();
    uploadImage.mockRejectedValueOnce(new Error('x'));
    fireEvent.change(entrada(), { target: { files: [arquivo('l.png', 'a')] } });
    expect(await screen.findByText('Erro ao carregar logo. Tenta novamente.')).toBeInTheDocument();
    expect(screen.queryByAltText('Logo')).not.toBeInTheDocument();
  });

  it('as_fotos_de_capa_arrancam_com_as_do_operador_e_a_primeira_e_a_principal', async () => {
    const { container } = await abrirPerfil({ ...OPERADOR, cover_images: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'] });
    expect([...container.querySelectorAll('div.group img')].map(i => i.getAttribute('src'))).toEqual(['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg']);
    expect(screen.getAllByText('Principal')).toHaveLength(1);
  });

  it('capas_sem_mexer_nao_vao_no_pedido_e_remover_todas_envia_lista_vazia', async () => {
    const { container } = await abrirPerfil({ ...OPERADOR, cover_images: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'] });
    fireEvent.change(screen.getByLabelText('Descrição da empresa'), { target: { value: 'Nova desc' } });
    fireEvent.click(botao('Guardar perfil'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalledTimes(1));
    expect(ultimoPut()).not.toHaveProperty('cover_images');
    fireEvent.click(container.querySelectorAll('div.group')[1].querySelector('button[title="Remover foto"]'));
    fireEvent.click(container.querySelectorAll('div.group')[0].querySelector('button[title="Remover foto"]'));
    fireEvent.click(botao('Guardar perfil'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalledTimes(2));
    expect(ultimoPut()).toEqual({ cover_images: [] });
  });

  it('acrescentar_uma_foto_faz_upload_e_o_url_novo_vai_no_pedido', async () => {
    const { container } = await abrirPerfil({ ...OPERADOR, cover_images: ['https://cdn.test/a.jpg'] });
    const ficheiro = arquivo('nova.png', 'n');
    fireEvent.change(container.querySelector('input[type="file"][multiple]'), { target: { files: [ficheiro] } });
    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith(ficheiro, expect.any(Function)));
    await waitFor(() => expect([...container.querySelectorAll('div.group img')].map(i => i.getAttribute('src'))).toEqual(['https://cdn.test/a.jpg', 'https://cdn.test/nova.png']));
    /* O ImageUploader (componente partilhado) chama o onChange dentro de um updater do setState e o React avisa
       "Cannot update a component while rendering a different component". E um aviso existente do componente, nao deste ecra. */
    spyErr.mockClear();
    fireEvent.click(botao('Guardar perfil'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalled());
    expect(ultimoPut().cover_images).toEqual(['https://cdn.test/a.jpg', 'https://cdn.test/nova.png']);
  });

  it('mover_e_remover_fotos_actualizam_a_ordem_enviada', async () => {
    const { container } = await abrirPerfil({ ...OPERADOR, cover_images: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg', 'https://cdn.test/c.jpg'] });
    fireEvent.click(screen.getAllByTitle('Mover para baixo')[0]);
    fireEvent.click(container.querySelectorAll('div.group')[2].querySelector('button[title="Remover foto"]'));
    fireEvent.click(botao('Guardar perfil'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalled());
    expect(ultimoPut().cover_images).toEqual(['https://cdn.test/b.jpg', 'https://cdn.test/a.jpg']);
  });

  it('faq_adicionar_mover_remover_com_as_setas_desactivadas_nos_extremos', async () => {
    await abrirPerfil();
    expect(setas(1)[0]).toBeDisabled();
    expect(setas(1)[1]).not.toBeDisabled();
    expect(setas(2)[1]).toBeDisabled();
    fireEvent.click(botao('Adicionar pergunta'));
    expect(screen.getByText('Pergunta 3')).toBeInTheDocument();
    expect(campoFaq(3, 'Pergunta PT')).toHaveValue('');
    fireEvent.click(setas(1)[1]);
    expect(campoFaq(1, 'Pergunta PT')).toHaveValue('P2');
    expect(campoFaq(2, 'Pergunta PT')).toHaveValue('P1');
    fireEvent.click(setas(3)[2]);
    expect(screen.queryByText('Pergunta 3')).not.toBeInTheDocument();
  });

  it('guardar_envia_so_os_campos_alterados_e_faqs_so_com_pergunta_e_setOperator', async () => {
    await abrirPerfil();
    fireEvent.click(botao('Adicionar pergunta'));
    fireEvent.change(campoFaq(3, 'Resposta PT', 'textarea'), { target: { value: 'só resposta' } });
    fireEvent.change(screen.getByLabelText('Descrição da empresa'), { target: { value: 'Nova desc' } });
    fireEvent.click(botao('Guardar perfil'));
    /* so o que mudou: a FAQ so com resposta e descartada, por isso as FAQ nao mudaram */
    await waitFor(() => expect(updateOperator).toHaveBeenCalledWith({ description: 'Nova desc' }));
    expect(await screen.findByText('Guardado com sucesso')).toBeInTheDocument();
    expect(useAuthStore.getState().operator.description).toBe('Nova desc');
  });

  it('o_cartao_do_chat_comeca_desligado_sem_campos_e_ligar_mostra_dias_horas_e_textos', async () => {
    await abrirPerfil();
    const cartaoChat = cartao('Chat do site: resposta automática');
    const ligar = within(cartaoChat).getByRole('checkbox', { name: 'Responder automaticamente fora do horário' });
    expect(ligar).not.toBeChecked();
    expect(within(cartaoChat).queryByLabelText('Abre as')).toBeNull();
    fireEvent.click(ligar);
    expect(ligar).toBeChecked();
    /* por omissao: dias uteis, 09:00 a 18:00 */
    ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].forEach(d => expect(within(cartaoChat).getByRole('checkbox', { name: d })).toBeChecked());
    ['Sab', 'Dom'].forEach(d => expect(within(cartaoChat).getByRole('checkbox', { name: d })).not.toBeChecked());
    expect(within(cartaoChat).getByLabelText('Abre as')).toHaveValue('09:00');
    expect(within(cartaoChat).getByLabelText('Fecha as')).toHaveValue('18:00');
    expect(within(cartaoChat).getByLabelText('Mensagem em Português')).toHaveValue('');
    expect(within(cartaoChat).getByLabelText('Mensagem em Inglês')).toHaveValue('');
    /* o texto por omissao aparece como sugestao */
    expect(within(cartaoChat).getByLabelText('Mensagem em Português')).toHaveAttribute('placeholder', expect.stringContaining('fora do horário de atendimento'));
  });

  it('guardar_com_o_chat_ligado_envia_a_configuracao_com_as_alteracoes', async () => {
    await abrirPerfil();
    const cartaoChat = cartao('Chat do site: resposta automática');
    fireEvent.click(within(cartaoChat).getByRole('checkbox', { name: 'Responder automaticamente fora do horário' }));
    fireEvent.click(within(cartaoChat).getByRole('checkbox', { name: 'Sab' }));
    fireEvent.click(within(cartaoChat).getByRole('checkbox', { name: 'Qua' }));
    fireEvent.change(within(cartaoChat).getByLabelText('Abre as'), { target: { value: '08:30' } });
    fireEvent.change(within(cartaoChat).getByLabelText('Fecha as'), { target: { value: '17:00' } });
    fireEvent.change(within(cartaoChat).getByLabelText('Mensagem em Português'), { target: { value: 'Voltamos segunda.' } });
    fireEvent.change(within(cartaoChat).getByLabelText('Mensagem em Inglês'), { target: { value: 'Back Monday.' } });
    fireEvent.click(botao('Guardar perfil'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalled());
    expect(ultimoPut().chat_auto_reply).toEqual({
      enabled: true, days: [1, 2, 4, 5, 6], from: '08:30', to: '17:00', message_pt: 'Voltamos segunda.', message_en: 'Back Monday.',
    });
  });

  it('arranca_com_a_configuracao_guardada_no_operador_e_desligar_mantem_os_valores', async () => {
    await abrirPerfil({ ...OPERADOR, chat_auto_reply: { enabled: true, days: [0, 6], from: '10:00', to: '14:00', message_pt: 'PT guardado', message_en: 'EN saved' } });
    const cartaoChat = cartao('Chat do site: resposta automática');
    const ligar = within(cartaoChat).getByRole('checkbox', { name: 'Responder automaticamente fora do horário' });
    expect(ligar).toBeChecked();
    expect(within(cartaoChat).getByRole('checkbox', { name: 'Dom' })).toBeChecked();
    expect(within(cartaoChat).getByRole('checkbox', { name: 'Sab' })).toBeChecked();
    expect(within(cartaoChat).getByRole('checkbox', { name: 'Seg' })).not.toBeChecked();
    expect(within(cartaoChat).getByLabelText('Abre as')).toHaveValue('10:00');
    expect(within(cartaoChat).getByLabelText('Mensagem em Português')).toHaveValue('PT guardado');
    fireEvent.click(ligar);
    fireEvent.click(botao('Guardar perfil'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalled());
    expect(ultimoPut().chat_auto_reply).toEqual({
      enabled: false, days: [0, 6], from: '10:00', to: '14:00', message_pt: 'PT guardado', message_en: 'EN saved',
    });
  });

  it('um_horario_que_atravessa_a_meia_noite_e_aceite_e_guardado', async () => {
    await abrirPerfil();
    const cartaoChat = cartao('Chat do site: resposta automática');
    fireEvent.click(within(cartaoChat).getByRole('checkbox', { name: 'Responder automaticamente fora do horário' }));
    fireEvent.change(within(cartaoChat).getByLabelText('Abre as'), { target: { value: '22:00' } });
    fireEvent.change(within(cartaoChat).getByLabelText('Fecha as'), { target: { value: '06:00' } });
    expect(within(cartaoChat).queryByRole('alert')).toBeNull();
    expect(within(cartaoChat).getByText(/atravessa a meia-noite/)).toBeInTheDocument();
    fireEvent.click(botao('Guardar perfil'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalled());
    expect(ultimoPut().chat_auto_reply).toMatchObject({ enabled: true, from: '22:00', to: '06:00' });
  });

  it('um_horario_em_que_o_fim_e_igual_ao_inicio_avisa_e_nao_guarda', async () => {
    await abrirPerfil();
    const cartaoChat = cartao('Chat do site: resposta automática');
    fireEvent.click(within(cartaoChat).getByRole('checkbox', { name: 'Responder automaticamente fora do horário' }));
    fireEvent.change(within(cartaoChat).getByLabelText('Fecha as'), { target: { value: '09:00' } });
    expect(within(cartaoChat).getByRole('alert')).toHaveTextContent('A hora de fecho tem de ser diferente da hora de abertura.');
    fireEvent.click(botao('Guardar perfil'));
    expect(updateOperator).not.toHaveBeenCalled();
    fireEvent.change(within(cartaoChat).getByLabelText('Fecha as'), { target: { value: '18:00' } });
    expect(within(cartaoChat).queryByRole('alert')).toBeNull();
  });

  it('ligado_sem_nenhum_dia_avisa_e_nao_guarda', async () => {
    await abrirPerfil();
    const cartaoChat = cartao('Chat do site: resposta automática');
    fireEvent.click(within(cartaoChat).getByRole('checkbox', { name: 'Responder automaticamente fora do horário' }));
    ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].forEach(d => fireEvent.click(within(cartaoChat).getByRole('checkbox', { name: d })));
    expect(within(cartaoChat).getByRole('alert')).toHaveTextContent('Escolhe pelo menos um dia de atendimento.');
    fireEvent.click(botao('Guardar perfil'));
    expect(updateOperator).not.toHaveBeenCalled();
  });

  describe('cancelamento grátis e confirmação automática', () => {
    const POLITICA = 'Política de cancelamento';
    const prazo = () => within(cartao(POLITICA)).getByLabelText('Cancelamento grátis');

    it('prazo_e_confirmacao_vao_no_guardar', async () => {
      await abrirPerfil({ ...OPERADOR, free_cancellation_hours: null, auto_confirm_bookings: false });
      expect(prazo()).toHaveValue('');
      fireEvent.change(prazo(), { target: { value: '48' } });
      const interruptor = screen.getByRole('switch', { name: 'Confirmar reservas automaticamente' });
      expect(interruptor).toHaveAttribute('aria-checked', 'false');
      fireEvent.click(interruptor);
      fireEvent.click(botao('Guardar perfil'));
      await waitFor(() => expect(updateOperator).toHaveBeenCalled());
      expect(ultimoPut()).toMatchObject({ free_cancellation_hours: 48, auto_confirm_bookings: true });
    });

    it('previa_do_texto_gerado_so_sem_texto_escrito', async () => {
      await abrirPerfil({ ...OPERADOR, cancellation_policy_pt: '', cancellation_policy_en: '', free_cancellation_hours: 48 });
      const c = within(cartao(POLITICA));
      expect(c.getByText('Cancelamento gratuito até 48 horas antes do início. Depois desse prazo, o valor pago não é reembolsado.')).toBeInTheDocument();
      expect(c.queryByText('Confirme que o texto abaixo diz o mesmo prazo.')).toBeNull();
      cleanup();
      await abrirPerfil({ ...OPERADOR, free_cancellation_hours: 48 });
      const c2 = within(cartao(POLITICA));
      expect(c2.getByText('Confirme que o texto abaixo diz o mesmo prazo.')).toBeInTheDocument();
      expect(c2.queryByText(/Cancelamento gratuito até 48 horas/)).toBeNull();
    });

    it('dica_da_confirmacao_explica_que_so_pagar_no_local_confirma_logo', async () => {
      await abrirPerfil({ ...OPERADOR, auto_confirm_bookings: false });
      expect(screen.getByText('As reservas da sua página pública com pagamento no local ficam logo confirmadas, sem precisar de as aceitar. '
        + 'As pagas online ficam confirmadas quando o pagamento é feito. Os cartões do catálogo mostram "Confirmação imediata".')).toBeInTheDocument();
    });

    it('mudar_so_a_confirmacao_nao_envia_o_prazo_nem_o_resto_do_perfil', async () => {
      /* outro separador do browser pode ter gravado o prazo entretanto: este nao o pode apagar */
      await abrirPerfil({ ...OPERADOR, free_cancellation_hours: null, auto_confirm_bookings: false });
      fireEvent.click(screen.getByRole('switch', { name: 'Confirmar reservas automaticamente' }));
      fireEvent.click(botao('Guardar perfil'));
      await waitFor(() => expect(updateOperator).toHaveBeenCalled());
      expect(ultimoPut()).toEqual({ auto_confirm_bookings: true });
    });

    it('sem_prazo_envia_null', async () => {
      await abrirPerfil({ ...OPERADOR, free_cancellation_hours: 24, auto_confirm_bookings: true });
      expect(prazo()).toHaveValue('24');
      expect(screen.getByRole('switch', { name: 'Confirmar reservas automaticamente' })).toHaveAttribute('aria-checked', 'true');
      fireEvent.change(prazo(), { target: { value: '' } });
      fireEvent.click(botao('Guardar perfil'));
      await waitFor(() => expect(updateOperator).toHaveBeenCalled());
      /* a confirmacao nao mudou, por isso nao vai no pedido */
      expect(ultimoPut()).toEqual({ free_cancellation_hours: null });
    });
  });

  describe('cor da página pública', () => {
    const TITULO = 'Cor da página pública e do widget';
    const hex = () => within(cartao(TITULO)).getByLabelText('Cor em hexadecimal');

    it('comeca_sem_cor_escolhida_com_a_cor_original_na_previa_e_guardar_sem_mexer_nao_envia_nada', async () => {
      await abrirPerfil();
      const c = within(cartao(TITULO));
      expect(hex()).toHaveValue('');
      expect(hex()).toHaveAttribute('placeholder', '#0d5470');
      expect(c.queryByRole('button', { name: 'Repor cor original' })).toBeNull();
      expect(c.getByTestId('previa-cor')).toHaveStyle({ backgroundColor: 'rgb(13, 84, 112)' });
      fireEvent.click(botao('Guardar perfil'));
      expect(await screen.findByText('Guardado com sucesso')).toBeInTheDocument();
      expect(updateOperator).not.toHaveBeenCalled();
    });

    it('escolher_uma_cor_sugerida_preenche_o_campo_muda_a_previa_e_guarda_a_cor', async () => {
      await abrirPerfil();
      const c = within(cartao(TITULO));
      fireEvent.click(c.getByRole('button', { name: 'Usar cor #c2410c' }));
      expect(hex()).toHaveValue('#c2410c');
      expect(c.getByTestId('previa-cor')).toHaveStyle({ backgroundColor: 'rgb(194, 65, 12)' });
      expect(c.getByRole('button', { name: 'Repor cor original' })).toBeInTheDocument();
      fireEvent.click(botao('Guardar perfil'));
      await waitFor(() => expect(updateOperator).toHaveBeenCalled());
      expect(ultimoPut().brand_color).toBe('#c2410c');
    });

    it('escrever_o_hex_ou_usar_o_seletor_normaliza_para_minusculas_ao_guardar', async () => {
      await abrirPerfil();
      fireEvent.change(hex(), { target: { value: ' #1F6F43 ' } });
      expect(within(cartao(TITULO)).queryByRole('alert')).toBeNull();
      fireEvent.click(botao('Guardar perfil'));
      await waitFor(() => expect(updateOperator).toHaveBeenCalled());
      expect(ultimoPut().brand_color).toBe('#1f6f43');
      updateOperator.mockClear();
      fireEvent.change(within(cartao(TITULO)).getByLabelText('Escolher cor'), { target: { value: '#6d28d9' } });
      expect(hex()).toHaveValue('#6d28d9');
    });

    it('um_formato_invalido_avisa_e_nao_guarda', async () => {
      await abrirPerfil();
      fireEvent.change(hex(), { target: { value: 'azul' } });
      expect(within(cartao(TITULO)).getByRole('alert')).toHaveTextContent('Use o formato #rrggbb');
      fireEvent.click(botao('Guardar perfil'));
      expect(updateOperator).not.toHaveBeenCalled();
      fireEvent.change(hex(), { target: { value: '#0d5470' } });
      expect(within(cartao(TITULO)).queryByRole('alert')).toBeNull();
    });

    it('uma_cor_demasiado_clara_avisa_do_contraste_e_nao_guarda', async () => {
      await abrirPerfil();
      fireEvent.change(hex(), { target: { value: '#ffe680' } });
      expect(within(cartao(TITULO)).getByRole('alert')).toHaveTextContent('demasiado clara');
      fireEvent.click(botao('Guardar perfil'));
      expect(updateOperator).not.toHaveBeenCalled();
    });

    it('arranca_com_a_cor_guardada_e_repor_a_original_envia_null', async () => {
      await abrirPerfil({ ...OPERADOR, brand_color: '#9f1239' });
      const c = within(cartao(TITULO));
      expect(hex()).toHaveValue('#9f1239');
      fireEvent.click(c.getByRole('button', { name: 'Repor cor original' }));
      expect(hex()).toHaveValue('');
      fireEvent.click(botao('Guardar perfil'));
      await waitFor(() => expect(updateOperator).toHaveBeenCalled());
      expect(ultimoPut().brand_color).toBeNull();
    });
  });

  it('falha_ao_guardar_regista_console.error_e_nao_mostra_o_aviso', async () => {
    updateOperator.mockRejectedValue(new Error('x'));
    await abrirPerfil();
    fireEvent.change(screen.getByLabelText('Descrição da empresa'), { target: { value: 'Nova desc' } });
    fireEvent.click(botao('Guardar perfil'));
    await waitFor(() => expect(spyErr).toHaveBeenCalled());
    spyErr.mockClear();
    expect(screen.queryByText('Guardado com sucesso')).not.toBeInTheDocument();
  });

  it('ferramentas_de_marketing_ligacao_qr_widget_e_copiar', async () => {
    await abrirPerfil();
    const f = within(cartao('Ferramentas de marketing'));
    expect(f.getByText('https://saldesk.cv/book/demo')).toBeInTheDocument();
    expect(f.getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', 'https://saldesk.cv/book/demo');
    const qr = f.getByAltText('QR Code');
    expect(qr).toHaveAttribute('src', `${apiBase}/api/v1/public/demo/qrcode`);
    expect(f.getByRole('link', { name: 'Descarregar PNG' })).toHaveAttribute('download', 'qrcode.png');
    expect(f.getByText('<script data-slug="demo"></script>')).toBeInTheDocument();
    expect(f.getByRole('link', { name: 'Pré-visualizar página pública' })).toHaveAttribute('href', '/book/demo');
    vi.useFakeTimers();
    fireEvent.click(f.getAllByRole('button', { name: 'Copiar' })[0]);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(writeText).toHaveBeenCalledWith('https://saldesk.cv/book/demo');
    expect(f.getAllByRole('button', { name: 'Copiado' })).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(f.queryByRole('button', { name: 'Copiado' })).not.toBeInTheDocument();
  });

  it('sem_slug_nao_ha_qr_nem_indicacao_e_sem_widget_nao_ha_widget', async () => {
    respostas['/marketing/widget-code'] = { data: { data: { html: '' } } };
    respostas['/marketing/booking-link'] = { data: { data: {} } };
    useAuthStore.setState({ operator: { ...OPERADOR, slug: undefined } });
    montar('/definicoes', { ...OPERADOR, slug: undefined });
    await abrir('Perfil Público', 'Logo');
    await screen.findByText('...');
    const f = within(cartao('Ferramentas de marketing'));
    expect(f.queryByAltText('QR Code')).not.toBeInTheDocument();
    expect(f.queryByText('Widget embebível')).not.toBeInTheDocument();
    expect(f.queryByRole('link', { name: 'Abrir' })).not.toBeInTheDocument();
    expect(f.getByRole('link', { name: 'Pré-visualizar página pública' })).toHaveAttribute('href', '#');
    expect(screen.queryByText('Indique um operador')).not.toBeInTheDocument();
  });

  it('bloco_de_indicacao_com_slug_e_ligacao_para_o_editor', async () => {
    await abrirPerfil();
    const b = within(cartao('Indique um operador'));
    expect(b.getByText('https://saldesk.cv/operadores.html?ref=demo')).toBeInTheDocument();
    fireEvent.click(b.getByRole('button', { name: 'Copiar' }));
    expect(writeText).toHaveBeenCalledWith('https://saldesk.cv/operadores.html?ref=demo');
    await screen.findByRole('button', { name: 'Copiado' });
    expect(screen.getByRole('link', { name: 'Abrir editor' })).toHaveAttribute('href', '/editor-pagina');
  });
});

/* ───────────────────────── caracterizacao: Pagamentos ───────────────────────── */

const estadoCartao = (rotulo) => screen.getAllByText(rotulo).find(e => e.tagName === 'P' && e.className.includes('font-semibold')).nextSibling.textContent;

describe('Definições: Pagamentos', () => {
  it('mostra_o_estado_PayPal_Webhook_e_SISP_e_os_marcadores_de_ja_configurado', async () => {
    montar();
    await abrir('Pagamentos', 'Webhook PayPal');
    expect(estadoCartao('PayPal')).toBe('Configurado');
    expect(estadoCartao('Webhook PayPal')).toBe('Não configurado');
    expect(estadoCartao('SISP Vinti4')).toBe('Não configurado');
    expect(screen.getByPlaceholderText('••••••••••••')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: 8PT597110X687430LKGECATA')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: 90051')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('EeFfGg...')).toBeInTheDocument();
    expect(campo('Client ID')).toHaveAttribute('type', 'password');
  });

  it('sem_resposta_do_servidor_nao_mostra_os_estados', async () => {
    api.get.mockImplementation(async (url) => { if (url === '/marketing/payment-settings') throw new Error('x'); return respostas[url]; });
    montar();
    await abrir('Pagamentos', 'Guardar credenciais');
    expect(screen.queryByText('Webhook PayPal')).not.toBeInTheDocument();
  });

  it('guardar_envia_so_os_campos_preenchidos_recarrega_o_estado_e_limpa_o_formulario', async () => {
    montar();
    await abrir('Pagamentos', 'Webhook PayPal');
    fireEvent.change(campo('Client ID'), { target: { value: 'cid' } });
    fireEvent.change(campo('POS ID'), { target: { value: '9' } });
    const antes = api.get.mock.calls.filter(c => c[0] === '/marketing/payment-settings').length;
    respostas['/marketing/payment-settings'] = { data: { data: { ...PAGAMENTOS, has_sisp: true } } };
    fireEvent.click(botao('Guardar credenciais'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/marketing/payment-settings', { paypal_client_id: 'cid', sisp_merchant_id: '9' }));
    await waitFor(() => expect(api.get.mock.calls.filter(c => c[0] === '/marketing/payment-settings').length).toBe(antes + 1));
    expect(await screen.findByText('Guardado com sucesso')).toBeInTheDocument();
    expect(campo('Client ID')).toHaveValue('');
    expect(campo('POS ID')).toHaveValue('');
    await waitFor(() => expect(estadoCartao('SISP Vinti4')).toBe('Configurado'));
  });

  it('guardar_sem_campos_envia_um_objecto_vazio', async () => {
    montar();
    await abrir('Pagamentos', 'Webhook PayPal');
    fireEvent.click(botao('Guardar credenciais'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/marketing/payment-settings', {}));
    await screen.findByText('Guardado com sucesso');
  });
});

/* ───────────────────────── caracterizacao: Facturacao ───────────────────────── */

const plano = (nome) => screen.getAllByText(nome).find(e => e.closest('article')).closest('article');
async function abrirFacturacao(op = OPERADOR) {
  montar('/definicoes', op);
  await abrir('Facturação', 'Subscrição actual');
  await screen.findByText('Histórico de pagamentos');
  await act(async () => {});
}
const escolher = (nomePlano) => fireEvent.click(within(plano(nomePlano)).getByRole('button'));
const modalPagamento = () => within(screen.getByText('Como quer pagar?').closest('[role="dialog"]'));

describe('Definições: Facturação', () => {
  it('mostra_plano_estado_renovacao_e_cancelar', async () => {
    await abrirFacturacao();
    const sub = within(cartao('Subscrição actual'));
    expect(sub.getByText('Pro')).toBeInTheDocument();
    expect(sub.getByText('Activo')).toBeInTheDocument();
    expect(sub.getByText(`Renova automaticamente a ${new Date(OPERADOR.plan_paid_until).toLocaleDateString('pt-PT')}`)).toBeInTheDocument();
    expect(sub.getByRole('button', { name: 'Cancelar subscrição' })).toBeInTheDocument();
  });

  it('sem_subscricao_activa_mostra_pago_ate_e_sem_cancelar', async () => {
    await abrirFacturacao({ ...OPERADOR, paypal_subscription_id: null });
    const sub = within(cartao('Subscrição actual'));
    expect(sub.getByText(`Pago até ${new Date(OPERADOR.plan_paid_until).toLocaleDateString('pt-PT')}`)).toBeInTheDocument();
    expect(sub.queryByRole('button', { name: 'Cancelar subscrição' })).not.toBeInTheDocument();
  });

  it('avaliacao_em_curso_expirada_e_estado_desconhecido', async () => {
    await abrirFacturacao({ ...OPERADOR, plan_status: 'trial', trial_ends_at: dia(5), plan_paid_until: null, paypal_subscription_id: null });
    expect(within(cartao('Subscrição actual')).getByText('Período de avaliação')).toBeInTheDocument();
    expect(screen.getByText('5 dias restantes no período de avaliação')).toBeInTheDocument();
    cleanup();
    await abrirFacturacao({ ...OPERADOR, plan_status: 'trial', trial_ends_at: dia(-1), plan_paid_until: null, paypal_subscription_id: null });
    expect(screen.getByText('Período de avaliação terminado')).toBeInTheDocument();
    cleanup();
    await abrirFacturacao({ ...OPERADOR, plan_status: 'xyz', paypal_subscription_id: null });
    expect(within(cartao('Subscrição actual')).getByText('xyz')).toBeInTheDocument();
  });

  it('plano_actual_desactivado_e_os_outros_mostram_o_preco', async () => {
    await abrirFacturacao();
    expect(within(plano('Pro')).getByRole('button', { name: 'Plano actual' })).toBeDisabled();
    expect(within(plano('Starter')).getByRole('button', { name: 'Subscrever' })).not.toBeDisabled();
    expect(plano('Starter')).toHaveTextContent('€29/mês');
    expect(plano('Business')).toHaveTextContent('€79/mês');
    expect(plano('Pro')).toHaveTextContent('€69/mês');
  });

  it('escolher_um_plano_abre_o_modal_com_o_preco_em_euro_e_CVE_e_a_politica_desbloqueia_os_botoes', async () => {
    await abrirFacturacao();
    escolher('Business');
    const m = modalPagamento();
    expect(norm(m.getByText(/Plano/).parentElement.textContent)).toContain(`Plano Business — €79/mês`);
    expect(norm(m.getByText(/Plano/).parentElement.textContent)).toContain(`≈ ${Math.round(79 * 110.265).toLocaleString('pt-PT')} CVE`);
    const paypal = m.getByRole('button', { name: /^PayPal/ });
    const sisp = m.getByRole('button', { name: /^SISP Vinti4/ });
    expect(paypal).toBeDisabled();
    expect(sisp).toBeDisabled();
    fireEvent.click(m.getByRole('checkbox'));
    expect(paypal).not.toBeDisabled();
    expect(sisp).not.toBeDisabled();
    expect(m.getByRole('link', { name: 'política de cancelamento e reembolsos' })).toHaveAttribute('href', 'https://saldesk.cv/termos.html#s6');
  });

  it('PayPal_vai_para_approval_url_e_falha_mostra_o_erro', async () => {
    const loc = { href: 'http://localhost/' };
    vi.stubGlobal('location', loc);
    createSubscription.mockResolvedValueOnce({ approval_url: 'https://paypal.test/approve' });
    await abrirFacturacao();
    escolher('Starter');
    fireEvent.click(modalPagamento().getByRole('checkbox'));
    fireEvent.click(modalPagamento().getByRole('button', { name: /^PayPal/ }));
    await waitFor(() => expect(createSubscription).toHaveBeenCalledWith('starter'));
    await waitFor(() => expect(window.location.href).toBe('https://paypal.test/approve'));
    createSubscription.mockRejectedValueOnce(new Error('x'));
    escolher('Business');
    fireEvent.click(modalPagamento().getByRole('checkbox'));
    fireEvent.click(modalPagamento().getByRole('button', { name: /^PayPal/ }));
    expect(await screen.findByText('Não foi possível iniciar a subscrição. Tenta novamente.')).toBeInTheDocument();
    expect(screen.queryByText('Como quer pagar?')).not.toBeInTheDocument();
  });

  it('SISP_cria_o_formulario_e_submete_e_SISP_NOT_CONFIGURED_tem_mensagem_propria', async () => {
    const submetidos = [];
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function () {
      this.setAttribute('data-sisp', '1');
      submetidos.push({ action: this.action, method: this.method, campos: [...this.querySelectorAll('input')].map(i => [i.name, i.value, i.type]) });
    });
    createSispCheckout.mockResolvedValueOnce({ postUrl: 'https://sisp.test/pay', fields: { a: '1', b: '2' } });
    await abrirFacturacao();
    escolher('Starter');
    fireEvent.click(modalPagamento().getByRole('checkbox'));
    fireEvent.click(modalPagamento().getByRole('button', { name: /^SISP Vinti4/ }));
    await waitFor(() => expect(submetidos).toHaveLength(1));
    expect(createSispCheckout).toHaveBeenCalledWith('starter');
    expect(submetidos[0]).toEqual({ action: 'https://sisp.test/pay', method: 'post', campos: [['a', '1', 'hidden'], ['b', '2', 'hidden']] });
    createSispCheckout.mockRejectedValueOnce({ response: { data: { code: 'SISP_NOT_CONFIGURED' } } });
    escolher('Business');
    fireEvent.click(modalPagamento().getByRole('checkbox'));
    fireEvent.click(modalPagamento().getByRole('button', { name: /^SISP Vinti4/ }));
    expect(await screen.findByText('O pagamento por SISP ainda não está disponível para a subscrição SalDesk.')).toBeInTheDocument();
    createSispCheckout.mockRejectedValueOnce(new Error('x'));
    escolher('Business');
    fireEvent.click(modalPagamento().getByRole('checkbox'));
    fireEvent.click(modalPagamento().getByRole('button', { name: /^SISP Vinti4/ }));
    expect(await screen.findByText('Não foi possível iniciar o pagamento SISP. Tenta novamente.')).toBeInTheDocument();
  });

  it('cancelar_subscricao_abre_o_modal_chama_cancelSubscription_e_recarrega_o_operador', async () => {
    cancelSubscription.mockResolvedValue({});
    await abrirFacturacao();
    fireEvent.click(within(cartao('Subscrição actual')).getByRole('button', { name: 'Cancelar subscrição' }));
    expect(screen.getByText(/Tens a certeza que queres cancelar a subscrição/)).toBeInTheDocument();
    fireEvent.click(botao('Confirmar cancelamento'));
    await waitFor(() => expect(cancelSubscription).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText(/Tens a certeza que queres cancelar/)).not.toBeInTheDocument());
    expect(api.get).toHaveBeenCalledWith('/auth/me');
    expect(within(cartao('Subscrição actual')).getByText('Cancelado')).toBeInTheDocument();
  });

  it('cancelar_falha_mostra_o_erro_e_Voltar_fecha_o_modal', async () => {
    cancelSubscription.mockRejectedValue(new Error('x'));
    await abrirFacturacao();
    fireEvent.click(within(cartao('Subscrição actual')).getByRole('button', { name: 'Cancelar subscrição' }));
    fireEvent.click(botao('Confirmar cancelamento'));
    expect(await screen.findByText('Não foi possível cancelar a subscrição. Tenta novamente.')).toBeInTheDocument();
    fireEvent.click(botao('Voltar'));
    expect(screen.queryByText(/Tens a certeza que queres cancelar/)).not.toBeInTheDocument();
  });

  it('historico_com_estados_Pago_Falhou_Pendente_e_o_vazio', async () => {
    await abrirFacturacao();
    const h = within(cartao('Histórico de pagamentos'));
    expect(h.getByText('€69.00')).toBeInTheDocument();
    expect(h.getByText('€79.00')).toBeInTheDocument();
    expect(h.getByText('Pago')).toBeInTheDocument();
    expect(h.getByText('Falhou')).toBeInTheDocument();
    expect(h.getByText('Pendente')).toBeInTheDocument();
    expect(h.getByText(new Date('2026-10-01T10:00:00Z').toLocaleDateString('pt-PT'))).toBeInTheDocument();
    cleanup();
    getBillingHistory.mockResolvedValue([]);
    await abrirFacturacao();
    expect(screen.getByText('Sem pagamentos registados.')).toBeInTheDocument();
  });
});

/* ───────────────────────── caracterizacao: Notificacoes ───────────────────────── */

const canal = (rotulo) => screen.getByText(rotulo).closest('label,[role="radio"]');
const canalMarcado = (rotulo) => { const e = canal(rotulo); const r = e.querySelector('input[type="radio"]'); return r ? r.checked : e.getAttribute('aria-checked') === 'true'; };
const interruptor = (rotulo) => screen.getByText(rotulo).parentElement.parentElement.querySelector('button');
const ligado = (rotulo) => interruptor(rotulo).className.includes('bg-ocean-700');

describe('Definições: Notificações', () => {
  it('valores_por_omissao_e_os_do_operador', async () => {
    montar();
    await abrir('Notificações', 'Canal de notificações');
    expect(canalMarcado('Push (PWA)')).toBe(true);
    expect(canalMarcado('Email')).toBe(false);
    expect(ligado('Nova reserva')).toBe(false);
    expect(ligado('Cancelamento')).toBe(true);
    expect(ligado('Lembrete de check-in')).toBe(false);
    cleanup();
    montar('/definicoes?tab=notificacoes', { id: 'o', name: 'X', email: 'e@x.test' });
    expect(canalMarcado('Ambos')).toBe(true);
    expect(ligado('Nova reserva')).toBe(true);
    expect(ligado('Lembrete de check-in')).toBe(false);
  });

  describe('canal_de_notificacoes_com_teclado (grupo de radio)', () => {
    const radios = () => screen.getAllByRole('radio');           // Email, Push (PWA), Ambos
    const marcado = () => radios().map(r => r.getAttribute('aria-checked') === 'true');
    const tecla = (indice, key) => fireEvent.keyDown(radios()[indice], { key });

    beforeEach(() => { montar('/definicoes?tab=notificacoes'); });

    it('so_o_canal_marcado_entra_na_ordem_do_Tab', () => {
      expect(radios().map(r => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    });

    it('setas_direita_e_baixo_marcam_o_seguinte_e_passam_o_foco', () => {
      tecla(1, 'ArrowRight');
      expect(marcado()).toEqual([false, false, true]);
      expect(document.activeElement).toBe(radios()[2]);
      expect(radios().map(r => r.getAttribute('tabindex'))).toEqual(['-1', '-1', '0']);
      tecla(2, 'ArrowDown');
      expect(marcado()).toEqual([true, false, false]); // volta ao principio
      expect(document.activeElement).toBe(radios()[0]);
    });

    it('setas_esquerda_e_cima_marcam_o_anterior_com_volta_ao_fim', () => {
      tecla(1, 'ArrowLeft');
      expect(marcado()).toEqual([true, false, false]);
      tecla(0, 'ArrowUp');
      expect(marcado()).toEqual([false, false, true]);
      expect(document.activeElement).toBe(radios()[2]);
    });

    it('Home_e_End_vao_ao_primeiro_e_ao_ultimo', () => {
      tecla(1, 'End');
      expect(marcado()).toEqual([false, false, true]);
      tecla(2, 'Home');
      expect(marcado()).toEqual([true, false, false]);
    });

    it('outras_teclas_nao_mudam_nada_e_o_valor_escolhido_e_o_que_se_guarda', async () => {
      tecla(1, 'a');
      expect(marcado()).toEqual([false, true, false]);
      tecla(1, 'ArrowLeft'); // email
      fireEvent.click(botao('Guardar preferências'));
      await waitFor(() => expect(updateOperator).toHaveBeenCalledWith(expect.objectContaining({ notif_channel: 'email' })));
    });
  });

  it('guardar_chama_updateOperator_com_notification_prefs_e_notif_channel', async () => {
    montar('/definicoes?tab=notificacoes');
    fireEvent.click(canal('Email'));
    expect(canalMarcado('Email')).toBe(true);
    fireEvent.click(interruptor('Nova reserva'));
    fireEvent.click(interruptor('Lembrete de check-in'));
    fireEvent.click(botao('Guardar preferências'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalledWith({
      notification_prefs: { new_booking: true, cancellation: true, payment_confirmed: true, review_received: true, new_message: true, checkin_reminder: true },
      notif_channel: 'email',
    }));
    expect(await screen.findByText('Guardado com sucesso')).toBeInTheDocument();
  });

  it('falha_regista_console.error', async () => {
    updateOperator.mockRejectedValue(new Error('x'));
    montar('/definicoes?tab=notificacoes');
    fireEvent.click(botao('Guardar preferências'));
    await waitFor(() => expect(spyErr).toHaveBeenCalled());
    spyErr.mockClear();
    expect(screen.queryByText('Guardado com sucesso')).not.toBeInTheDocument();
  });
});

/* ───────────────────────── caracterizacao: Seguranca ───────────────────────── */

const pw = (rotulo) => campo(rotulo);
const formPw = () => pw('Nova password').closest('form');

describe('Definições: Segurança', () => {
  it('valida_a_forca_e_a_confirmacao', async () => {
    montar('/definicoes?tab=seguranca');
    fireEvent.change(pw('Nova password'), { target: { value: 'abc' } });
    fireEvent.submit(formPw());
    expect(screen.getByText('A password deve ser forte: 8+ caracteres, maiúscula, número e especial.')).toBeInTheDocument();
    fireEvent.change(pw('Nova password'), { target: { value: 'Abcdef1!' } });
    fireEvent.change(pw('Confirmar nova password'), { target: { value: 'outra' } });
    expect(screen.getAllByText('As passwords não coincidem.')).toHaveLength(1);
    fireEvent.submit(formPw());
    expect(screen.getAllByText('As passwords não coincidem.')).toHaveLength(2);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('chama_changePassword_com_a_password_actual_e_a_nova_e_limpa_os_tres_campos', async () => {
    montar('/definicoes?tab=seguranca');
    expect(pw('Password actual')).toBeRequired();
    fireEvent.change(pw('Password actual'), { target: { value: 'Actual1!x' } });
    fireEvent.change(pw('Nova password'), { target: { value: 'Abcdef1!' } });
    fireEvent.change(pw('Confirmar nova password'), { target: { value: 'Abcdef1!' } });
    fireEvent.submit(formPw());
    await waitFor(() => expect(changePassword).toHaveBeenCalledTimes(1));
    expect(changePassword.mock.calls[0]).toEqual(['Actual1!x', 'Abcdef1!']);
    expect(await screen.findByText('Guardado com sucesso')).toBeInTheDocument();
    expect(pw('Password actual')).toHaveValue('');
    expect(pw('Nova password')).toHaveValue('');
    expect(pw('Confirmar nova password')).toHaveValue('');
  });

  it('password_actual_incorrecta_ou_conta_bloqueada_mostram_a_mensagem_do_servidor_e_nao_limpam_os_campos', async () => {
    montar('/definicoes?tab=seguranca');
    fireEvent.change(pw('Password actual'), { target: { value: 'errada' } });
    fireEvent.change(pw('Nova password'), { target: { value: 'Abcdef1!' } });
    fireEvent.change(pw('Confirmar nova password'), { target: { value: 'Abcdef1!' } });
    changePassword.mockRejectedValueOnce({ response: { status: 403, data: { error: 'Password actual incorrecta', code: 'INVALID_CURRENT_PASSWORD' } } });
    fireEvent.submit(formPw());
    expect(await screen.findByText('Password actual incorrecta')).toBeInTheDocument();
    expect(pw('Password actual')).toHaveValue('errada');
    changePassword.mockRejectedValueOnce({ response: { status: 423, data: { error: 'Conta temporariamente bloqueada por demasiadas tentativas falhadas', code: 'ACCOUNT_LOCKED' } } });
    fireEvent.submit(formPw());
    expect(await screen.findByText('Conta temporariamente bloqueada por demasiadas tentativas falhadas')).toBeInTheDocument();
  });

  it('mostrar_e_esconder_cada_campo', () => {
    montar('/definicoes?tab=seguranca');
    for (const rotulo of ['Password actual', 'Nova password', 'Confirmar nova password']) {
      const input = pw(rotulo);
      expect(input).toHaveAttribute('type', 'password');
      fireEvent.click(input.parentElement.querySelector('button'));
      expect(input).toHaveAttribute('type', 'text');
      fireEvent.click(input.parentElement.querySelector('button'));
      expect(input).toHaveAttribute('type', 'password');
    }
  });

  it('erro_do_servidor_ou_Erro ao alterar password.', async () => {
    montar('/definicoes?tab=seguranca');
    fireEvent.change(pw('Nova password'), { target: { value: 'Abcdef1!' } });
    fireEvent.change(pw('Confirmar nova password'), { target: { value: 'Abcdef1!' } });
    changePassword.mockRejectedValueOnce({ response: { data: { error: 'Password recente' } } });
    fireEvent.submit(formPw());
    expect(await screen.findByText('Password recente')).toBeInTheDocument();
    changePassword.mockRejectedValueOnce(new Error('x'));
    fireEvent.submit(formPw());
    expect(await screen.findByText('Erro ao alterar password.')).toBeInTheDocument();
  });
});

/* ───────────────────────── design system: estrutura, Conta, Notificacoes e Seguranca ───────────────────────── */

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;
const classes = (root) => [...root.querySelectorAll('[class]')].map(e => e.getAttribute('class')).join(' ');
const semCoresForaDosTokens = (html) => {
  expect(html).not.toMatch(HEX);
  expect(html).not.toMatch(NOMEADAS);
  expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  expect(html).not.toMatch(/bg-red-/);
  expect(html).not.toMatch(/bg-error/);
};

describe('Definições: design system (estrutura, Conta, Notificações e Segurança)', () => {
  it('os_sete_separadores_sao_Tabs_sem_icones_e_o_query_string_escolhe_o_inicial', async () => {
    montar();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const nomes = ['Conta', 'Perfil Público', 'Pagamentos', 'Facturação', 'Notificações', 'Mensagens', 'Segurança'];
    nomes.forEach(n => expect(screen.getByRole('tab', { name: n })).toBeInTheDocument());
    expect(screen.getAllByRole('tab')).toHaveLength(7);
    expect(screen.getByRole('tab', { name: 'Conta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Conta' }).querySelector('svg')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Segurança' }));
    expect(screen.getByRole('tab', { name: 'Segurança' })).toHaveAttribute('aria-selected', 'true');
    cleanup();
    montar('/definicoes?tab=facturacao');
    expect(screen.getByRole('tab', { name: 'Facturação' })).toHaveAttribute('aria-selected', 'true');
    await screen.findByText('Pago');
  });

  it('o_aviso_de_guardado_tem_role_status_e_tokens', async () => {
    montar();
    fireEvent.click(botao('Guardar alterações'));
    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent('Guardado com sucesso');
    expect(aviso.className).toContain('var(--success-light)');
    expect(aviso.className).toContain('var(--success)');
  });

  it('os_campos_de_Conta_tem_nome_acessivel_e_o_erro_usa_tokens', async () => {
    montar();
    ['Nome da empresa', 'Email', 'Telefone', 'WhatsApp', 'Morada', 'Idioma', 'Moeda', 'Fuso horário'].forEach(e => expect(screen.getByLabelText(e)).toBeInTheDocument());
    updateOperator.mockRejectedValueOnce({ response: { data: { error: 'Email inválido' } } });
    fireEvent.change(campo('Email'), { target: { value: 'mau@x' } });
    fireEvent.click(botao('Guardar alterações'));
    const erro = await screen.findByText('Email inválido');
    expect(erro.className).toContain('var(--error-light)');
    expect(erro.className).toContain('var(--error)');
  });

  it('o_canal_de_notificacoes_e_um_radiogroup_com_aria_checked', () => {
    montar('/definicoes?tab=notificacoes');
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Push (PWA)', checked: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Email' }));
    expect(screen.getByRole('radio', { name: 'Email', checked: true })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Push (PWA)', checked: false })).toBeInTheDocument();
  });

  it('os_campos_de_password_tem_nome_e_os_botoes_de_mostrar_aria_pressed', () => {
    montar('/definicoes?tab=seguranca');
    ['Password actual', 'Nova password', 'Confirmar nova password'].forEach(e => expect(screen.getByLabelText(e)).toBeInTheDocument());
    const botaoMostrar = screen.getByRole('button', { name: 'Mostrar password actual', pressed: false });
    fireEvent.click(botaoMostrar);
    expect(screen.getByRole('button', { name: 'Mostrar password actual', pressed: true })).toBeInTheDocument();
    expect(screen.getByLabelText('Password actual')).toHaveAttribute('type', 'text');
  });

  it('os_erros_de_Seguranca_usam_tokens', () => {
    montar('/definicoes?tab=seguranca');
    fireEvent.change(pw('Confirmar nova password'), { target: { value: 'x' } });
    const inline = screen.getByText('As passwords não coincidem.');
    expect(inline.className).toContain('var(--error)');
    fireEvent.submit(formPw());
    const erro = screen.getByText('A password deve ser forte: 8+ caracteres, maiúscula, número e especial.');
    expect(erro.className).toContain('var(--error-light)');
  });

  it('sem_cores_nomeadas_text_error_bg_red_ou_hexadecimais_em_classes_em_Conta_Notificacoes_e_Seguranca', async () => {
    const { container } = montar();
    let html = classes(container);
    updateOperator.mockRejectedValueOnce(new Error('x'));
    fireEvent.change(campo('Nome da empresa'), { target: { value: 'Outro nome' } });
    fireEvent.click(botao('Guardar alterações'));
    await screen.findByText('Erro ao guardar');
    html += classes(container);
    fireEvent.click(botao('Guardar alterações'));
    await screen.findByRole('status');
    html += classes(container);
    fireEvent.click(screen.getByRole('tab', { name: 'Notificações' }));
    html += classes(container);
    fireEvent.click(screen.getByRole('tab', { name: 'Segurança' }));
    fireEvent.change(pw('Confirmar nova password'), { target: { value: 'x' } });
    fireEvent.submit(formPw());
    html += classes(container);
    semCoresForaDosTokens(html);
  });
});

/* ───────────────────────── design system: Perfil Publico ───────────────────────── */

describe('Definições: design system (Perfil Público)', () => {
  it('os_campos_tem_nome_acessivel_incluindo_os_pares_PT_EN_com_contexto', async () => {
    const { container } = await abrirPerfil();
    ['Descrição da empresa', 'Política de cancelamento em Português', 'Política de cancelamento em Inglês',
      'Pergunta 1 PT', 'Pergunta 1 EN', 'Resposta 1 PT', 'Resposta 1 EN', 'Pergunta 2 PT'].forEach(e => expect(screen.getByLabelText(e)).toBeInTheDocument());
    expect(screen.getByLabelText('Ficheiro do logo')).toHaveAttribute('type', 'file');
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(2);
  });

  it('os_botoes_de_icone_das_faq_tem_nome', async () => {
    await abrirPerfil();
    expect(screen.getByRole('button', { name: 'Mover pergunta 1 para baixo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mover pergunta 2 para cima' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover pergunta 2' })).toBeInTheDocument();
  });

  it('sem_cores_nomeadas_text_error_bg_error_bg_red_ou_hexadecimais_em_classes', async () => {
    const { container } = await abrirPerfil({ ...OPERADOR, cover_images: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'] });
    expect(container.querySelectorAll('div.group img')).toHaveLength(2);
    updateOperator.mockRejectedValueOnce(new Error('x'));
    fireEvent.change(screen.getByLabelText('Descrição da empresa'), { target: { value: 'Nova desc' } });
    fireEvent.click(botao('Guardar perfil'));
    await waitFor(() => expect(spyErr).toHaveBeenCalled());
    spyErr.mockClear();
    fireEvent.click(botao('Guardar perfil'));
    await screen.findByRole('status');
    /* as fotos sao do ImageUploader (partilhado, com o botao de remover em bg-error): so se verifica o resto do ecra */
    const sem = container.cloneNode(true);
    sem.querySelectorAll('div.group').forEach(n => n.remove());
    /* o hover vermelho dos botoes de remover vem do DELETE_HOVER do IconBtn (hover:text-error) */
    semCoresForaDosTokens(classes(sem).replace(/hover:text-error/g, ''));
  });
});

/* ───────────────────────── design system: Pagamentos e Facturacao ───────────────────────── */

describe('Definições: design system (Pagamentos e Facturação)', () => {
  it('os_estados_de_Pagamentos_sao_cartoes_estaticos_sem_role_status_com_tokens_e_os_campos_tem_nome', async () => {
    montar();
    await abrir('Pagamentos', 'Webhook PayPal');
    /* nao mudam em directo, por isso nao sao uma "live region" (role=status) */
    expect(screen.queryAllByRole('status')).toHaveLength(0);
    const estados = screen.getAllByText(/^(Configurado|Não configurado)$/).map(p => p.parentElement.parentElement);
    expect(estados).toHaveLength(3);
    expect(estados[0].className).toContain('var(--success-light)');
    expect(estados[1].className).toContain('bg-mare-head');
    ['Client ID', 'Client Secret', 'Webhook ID', 'POS ID', 'POS Auth Code'].forEach(e => expect(screen.getByLabelText(e)).toBeInTheDocument());
    expect(screen.getByLabelText('Client ID')).toHaveAttribute('type', 'password');
  });

  it('o_estado_da_subscricao_e_Badge_com_a_variante_certa', async () => {
    const estado = async (op, texto) => {
      await abrirFacturacao(op);
      const e = within(cartao('Subscrição actual')).getByText(texto);
      cleanup();
      return e.className;
    };
    expect(await estado(OPERADOR, 'Activo')).toContain('var(--success-light)');
    expect(await estado({ ...OPERADOR, plan_status: 'trial', trial_ends_at: dia(5) }, 'Período de avaliação')).toContain('var(--info-light)');
    expect(await estado({ ...OPERADOR, plan_status: 'suspended', paypal_subscription_id: null }, 'Suspenso')).toContain('var(--error-light)');
    expect(await estado({ ...OPERADOR, plan_status: 'cancelled', paypal_subscription_id: null }, 'Cancelado')).toContain('bg-n-100');
    expect(await estado({ ...OPERADOR, plan_status: 'xyz', paypal_subscription_id: null }, 'xyz')).toContain('bg-n-100');
  });

  it('o_historico_e_os_erros_usam_tokens', async () => {
    createSubscription.mockRejectedValueOnce(new Error('x'));
    await abrirFacturacao();
    const h = within(cartao('Histórico de pagamentos'));
    expect(h.getByText('Pago').className).toContain('var(--success)');
    expect(h.getByText('Falhou').className).toContain('var(--error)');
    escolher('Starter');
    fireEvent.click(modalPagamento().getByRole('checkbox'));
    fireEvent.click(modalPagamento().getByRole('button', { name: /^PayPal/ }));
    const erro = await screen.findByText('Não foi possível iniciar a subscrição. Tenta novamente.');
    expect(erro.className).toContain('var(--error-light)');
    expect(erro.className).toContain('var(--error)');
  });

  it('sem_cores_nomeadas_text_error_bg_red_ou_hexadecimais_em_classes_em_Pagamentos_e_Facturacao', async () => {
    /* o botao "Confirmar cancelamento" e um ui/Button variant=danger (bg-error): o modal de cancelamento fica de fora */
    const { container } = montar();
    await abrir('Pagamentos', 'Webhook PayPal');
    let html = classes(container);
    fireEvent.click(separador('Facturação'));
    await screen.findByText('Histórico de pagamentos');
    await screen.findByText('Pago');
    html += classes(container);
    cleanup();
    createSubscription.mockRejectedValueOnce(new Error('x'));
    const r = montar('/definicoes?tab=facturacao', { ...OPERADOR, plan_status: 'trial', trial_ends_at: dia(-1) });
    await screen.findByText('Pago');
    escolher('Starter');
    html += classes(r.container);
    fireEvent.click(modalPagamento().getByRole('checkbox'));
    fireEvent.click(modalPagamento().getByRole('button', { name: /^PayPal/ }));
    await screen.findByText('Não foi possível iniciar a subscrição. Tenta novamente.');
    html += classes(r.container);
    semCoresForaDosTokens(html);
  });
});

/* ───────────────────────── estilo Mare: Conta, Notificacoes, Seguranca e Pagamentos ───────────────────────── */

describe('Definições: estilo Maré (cabeçalho, Conta, Notificações, Segurança e Pagamentos)', () => {
  const fichas = (el) => el.className.split(/\s+/);
  const secaoDe = (titulo) => screen.getByRole('heading', { level: 2, name: titulo }).closest('section');
  const ehCartao = (el) => {
    const c = fichas(el);
    ['bg-white', 'rounded-[18px]', 'border', 'border-mare-card'].forEach(k => expect(c).toContain(k));
  };

  it('mostra_o_eyebrow_Configuracao_e_os_separadores_continuam_a_mudar', () => {
    montar();
    expect(document.querySelector('[data-eyebrow]')).toHaveTextContent('Configuração');
    fireEvent.click(screen.getByRole('tab', { name: 'Segurança' }));
    expect(screen.getByRole('tab', { name: 'Segurança', selected: true })).toBeInTheDocument();
    expect(document.querySelector('[data-eyebrow]')).toHaveTextContent('Configuração');
  });

  it('Conta_tem_tres_cartoes_Mare_com_titulo_h2_Sora_e_grelhas_com_uma_coluna_no_telemovel', () => {
    montar();
    ['Dados da empresa', 'Preferências', 'Ajuda'].forEach((t) => {
      const sec = secaoDe(t);
      ehCartao(sec);
      const h = within(sec).getByRole('heading', { level: 2, name: t });
      ['font-display', 'text-lg', 'font-semibold', 'text-ocean-900'].forEach(k => expect(fichas(h)).toContain(k));
    });
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    const g2 = screen.getByLabelText('Telefone').closest('div.grid');
    expect(fichas(g2)).toEqual(expect.arrayContaining(['grid-cols-1', 'sm:grid-cols-2']));
    const g3 = screen.getByLabelText('Idioma').closest('div.grid');
    expect(fichas(g3)).toEqual(expect.arrayContaining(['grid-cols-1', 'sm:grid-cols-3']));
    expect(fichas(botao('Rever tour'))).toEqual(expect.arrayContaining(['min-h-11', 'md:min-h-0']));
  });

  it('Notificacoes_tem_dois_cartoes_Mare_h2_e_o_canal_escolhido_mantem_aria_checked', () => {
    montar('/definicoes?tab=notificacoes');
    ['Canal de notificações', 'Tipos de notificação'].forEach(t => ehCartao(secaoDe(t)));
    const grupo = screen.getByRole('radiogroup');
    expect(fichas(grupo)).toEqual(expect.arrayContaining(['grid-cols-1', 'sm:grid-cols-3']));
    const push = screen.getByRole('radio', { name: 'Push (PWA)' });
    const email = screen.getByRole('radio', { name: 'Email' });
    expect(push).toHaveAttribute('aria-checked', 'true');
    expect(fichas(push)).toEqual(expect.arrayContaining(['min-h-11', 'md:min-h-0', 'rounded-[14px]', 'bg-ocean-700']));
    expect(fichas(email)).toEqual(expect.arrayContaining(['border-mare-field']));
    expect(fichas(email)).not.toContain('bg-ocean-700');
    fireEvent.click(email);
    expect(email).toHaveAttribute('aria-checked', 'true');
    expect(fichas(email)).toContain('bg-ocean-700');
    expect(fichas(email)).not.toContain('border-mare-field');
    expect(push).toHaveAttribute('aria-checked', 'false');
  });

  it('Seguranca_e_um_cartao_Mare_com_h2_e_campos_de_44px_no_telemovel_ligados_as_etiquetas', () => {
    montar('/definicoes?tab=seguranca');
    ehCartao(screen.getByRole('heading', { level: 2, name: 'Alterar password' }).closest('section'));
    ['Password actual', 'Nova password', 'Confirmar nova password'].forEach((e) => {
      const input = screen.getByLabelText(e);
      expect(fichas(input)).toEqual(expect.arrayContaining(['h-11', 'md:h-9', 'border-mare-field', 'focus:ring-sand-500']));
      expect(input.id).toBeTruthy();
      expect(screen.getByText(e, { selector: 'label' })).toHaveAttribute('for', input.id);
    });
    const ver = screen.getByRole('button', { name: 'Mostrar password actual' });
    expect(fichas(ver)).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11', 'md:min-h-9', 'md:min-w-9']));
  });

  it('Pagamentos_tem_estados_em_caixas_internas_e_cartoes_Mare_com_h2_e_o_webhook_quebra_linha', async () => {
    montar();
    await abrir('Pagamentos', 'Webhook PayPal');
    ['PayPal', 'SISP Vinti4'].forEach(t => ehCartao(secaoDe(t)));
    const estados = screen.getAllByText(/^(Configurado|Não configurado)$/).map(p => p.parentElement.parentElement);
    expect(estados).toHaveLength(3);
    estados.forEach(e => expect(fichas(e)).toEqual(expect.arrayContaining(['rounded-[14px]', 'border-mare-card'])));
    expect(fichas(estados[0])).toContain('bg-[var(--success-light)]');
    expect(fichas(estados[1])).toContain('bg-mare-head');
    expect(fichas(estados[0].parentElement)).toEqual(expect.arrayContaining(['grid-cols-1', 'sm:grid-cols-3']));
    const url = screen.getByText('https://api.saldesk.cv/api/v1/payments/webhook/paypal');
    expect(fichas(url)).toContain('break-all');
  });

  it('Pagamentos_guarda_so_o_que_foi_preenchido_como_antes', async () => {
    montar();
    await abrir('Pagamentos', 'Webhook PayPal');
    fireEvent.change(screen.getByLabelText('POS ID'), { target: { value: '90051' } });
    fireEvent.click(screen.getAllByRole('button').find(b => b.type === 'submit'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/marketing/payment-settings', { sisp_merchant_id: '90051' }));
  });
});

/* ───────────────────────── estilo Mare: Facturacao e Perfil Publico ───────────────────────── */

describe('Definições: estilo Maré (Facturação e Perfil Público)', () => {
  const fichas = (el) => el.className.split(/\s+/);
  const secaoDe = (titulo) => screen.getByRole('heading', { level: 2, name: titulo }).closest('section');
  const ehCartao = (el) => {
    const c = fichas(el);
    ['bg-white', 'rounded-[18px]', 'border', 'border-mare-card'].forEach(k => expect(c).toContain(k));
  };
  const ehTitulo = (h) => ['font-display', 'text-lg', 'font-semibold', 'text-ocean-900'].forEach(k => expect(fichas(h)).toContain(k));
  const mono = (el) => ['font-mono', 'tabular-nums'].forEach(k => expect(fichas(el)).toContain(k));

  it('Facturacao_mostra_o_eyebrow_e_tem_a_subscricao_e_o_historico_em_cartoes_Mare_com_h2', async () => {
    await abrirFacturacao();
    expect(document.querySelector('[data-eyebrow]')).toHaveTextContent('Configuração');
    ['Subscrição actual', 'Histórico de pagamentos'].forEach((t) => {
      const sec = secaoDe(t);
      ehCartao(sec);
      ehTitulo(within(sec).getByRole('heading', { level: 2, name: t }));
    });
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
  });

  it('Facturacao_os_tres_planos_sao_cartoes_Mare_com_preco_em_mono_e_o_actual_destacado_sem_conflito_de_bordas', async () => {
    await abrirFacturacao();
    ['Starter', 'Business', 'Pro'].forEach((n) => ehCartao(plano(n)));
    mono(within(plano('Starter')).getByText('€29'));
    expect(plano('Starter')).toHaveTextContent('€29/mês');
    mono(within(plano('Business')).getByText('€79'));
    /* o plano actual ganha um anel e o botao diz "Plano actual": nao so a cor */
    expect(fichas(plano('Pro'))).toEqual(expect.arrayContaining(['ring-2', 'ring-ocean-700', 'border-mare-card']));
    expect(fichas(plano('Starter'))).not.toContain('ring-2');
    const sub = within(plano('Starter')).getByRole('button', { name: 'Subscrever' });
    expect(fichas(sub)).toEqual(expect.arrayContaining(['min-h-11', 'md:min-h-0']));
    expect(fichas(plano('Starter').parentElement)).toEqual(expect.arrayContaining(['grid-cols-1', 'sm:grid-cols-3']));
  });

  it('Facturacao_o_estado_do_plano_e_Badge_com_texto_e_cancelar_tem_44px_no_telemovel', async () => {
    await abrirFacturacao();
    const sub = within(secaoDe('Subscrição actual'));
    const badge = sub.getByText('Activo');
    expect(badge.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(fichas(badge)).toEqual(expect.arrayContaining(['inline-flex', 'rounded-xs']));
    const cancelar = sub.getByRole('button', { name: 'Cancelar subscrição' });
    expect(fichas(cancelar)).toEqual(expect.arrayContaining(['min-h-11', 'md:min-h-0', 'focus-visible:ring-sand-500']));
  });

  it('Facturacao_historico_com_datas_e_valores_em_mono_e_estados_em_Badge_com_texto', async () => {
    await abrirFacturacao();
    const h = within(secaoDe('Histórico de pagamentos'));
    mono(h.getByText('€69.00'));
    mono(h.getByText('€79.00'));
    mono(h.getByText(new Date('2026-10-01T10:00:00Z').toLocaleDateString('pt-PT')));
    const pago = h.getByText('Pago');
    const falhou = h.getByText('Falhou');
    const pendente = h.getByText('Pendente');
    expect(fichas(pago)).toContain('bg-[var(--success-light)]');
    expect(fichas(falhou)).toContain('bg-[var(--error-light)]');
    expect(fichas(pendente)).toContain('bg-[var(--warning-light)]');
    [pago, falhou, pendente].forEach(b => expect(b.querySelector('[aria-hidden="true"]')).not.toBeNull());
    const linha = pago.closest('div.rounded-\\[14px\\]');
    expect(fichas(linha)).toContain('bg-mare-head');
  });

  it('Facturacao_o_vazio_e_a_escolha_do_plano_continuam_a_funcionar', async () => {
    getBillingHistory.mockResolvedValue([]);
    await abrirFacturacao();
    expect(screen.getByText('Sem pagamentos registados.')).toBeInTheDocument();
    escolher('Starter');
    expect(screen.getByText('Como quer pagar?')).toBeInTheDocument();
  });

  it('Perfil_Publico_mostra_o_eyebrow_e_todas_as_seccoes_sao_cartoes_Mare_com_h2_Sora', async () => {
    await abrirPerfil();
    expect(document.querySelector('[data-eyebrow]')).toHaveTextContent('Configuração');
    ['Logo', 'Fotos de capa', 'Descrição', 'Política de cancelamento', 'Confirmação das reservas',
      'Cor da página pública e do widget', 'Chat do site: resposta automática', 'FAQ personalizado',
      'Secções, redes sociais, horário e mais', 'Ferramentas de marketing', 'Indique um operador'].forEach((t) => {
      const sec = secaoDe(t);
      ehCartao(sec);
      ehTitulo(within(sec).getByRole('heading', { level: 2, name: t }));
    });
  });

  it('Perfil_Publico_tem_caixas_internas_Mare_e_o_uploader_nao_foi_tocado', async () => {
    const { container } = await abrirPerfil({ ...OPERADOR, cover_images: ['https://cdn.test/a.jpg'] });
    /* cada pergunta do FAQ e uma caixa interna */
    expect(fichas(faq(1))).toEqual(expect.arrayContaining(['rounded-[14px]', 'bg-mare-head']));
    /* a pre-visualizacao do logo tambem */
    expect(secaoDe('Logo').querySelector('div.rounded-\\[14px\\]')).not.toBeNull();
    /* o uploader continua a ser o partilhado: fotos em div.group com o botao de remover */
    expect(container.querySelectorAll('div.group')).toHaveLength(1);
    expect(container.querySelector('button[title="Remover foto"]')).not.toBeNull();
    /* grelhas de duas colunas com uma coluna no telemovel */
    const g = screen.getByLabelText('Pergunta 1 PT').closest('div.grid');
    expect(fichas(g)).toEqual(expect.arrayContaining(['grid-cols-1', 'sm:grid-cols-2']));
  });

  it('Perfil_Publico_cada_seccao_mantem_os_campos_ligados_as_etiquetas', async () => {
    await abrirPerfil();
    expect(within(secaoDe('Logo')).getByLabelText('Ficheiro do logo')).toHaveAttribute('type', 'file');
    expect(within(secaoDe('Descrição')).getByLabelText('Descrição da empresa').tagName).toBe('TEXTAREA');
    const pol = within(secaoDe('Política de cancelamento'));
    expect(pol.getByLabelText('Cancelamento grátis').tagName).toBe('SELECT');
    expect(pol.getByLabelText('Política de cancelamento em Português').tagName).toBe('TEXTAREA');
    const cor = within(secaoDe('Cor da página pública e do widget'));
    expect(cor.getByLabelText('Cor em hexadecimal').tagName).toBe('INPUT');
    expect(fichas(cor.getByLabelText('Escolher cor'))).toEqual(expect.arrayContaining(['h-11', 'md:h-10', 'border-mare-field', 'focus-visible:ring-sand-500']));
    expect(within(secaoDe('FAQ personalizado')).getByLabelText('Resposta 2 EN').tagName).toBe('TEXTAREA');
    expect(within(secaoDe('Confirmação das reservas')).getByRole('switch', { name: 'Confirmar reservas automaticamente' })).toBeInTheDocument();
  });

  it('Perfil_Publico_o_chat_ligado_mantem_as_etiquetas_dos_dias_e_horas', async () => {
    await abrirPerfil();
    const chat = within(secaoDe('Chat do site: resposta automática'));
    const ligar = chat.getAllByRole('checkbox')[0];
    expect(fichas(ligar)).toContain('focus-visible:ring-sand-500');
    fireEvent.click(ligar);
    expect(chat.getByLabelText('Abre as').getAttribute('type')).toBe('time');
    expect(chat.getByLabelText('Seg')).toHaveAttribute('type', 'checkbox');
    expect(fichas(chat.getByLabelText('Seg').closest('label'))).toEqual(expect.arrayContaining(['min-h-11', 'md:min-h-0']));
  });

  it('Perfil_Publico_os_botoes_de_icone_das_FAQ_sao_IconBtn_e_remover_mantem_o_realce_vermelho', async () => {
    await abrirPerfil();
    const remover = screen.getByRole('button', { name: 'Remover pergunta 2' });
    expect(fichas(remover)).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11', 'md:min-h-9', 'md:min-w-9', 'hover:text-error', 'hover:bg-[var(--error-light)]', 'focus-visible:ring-sand-500']));
    const subir = screen.getByRole('button', { name: 'Mover pergunta 2 para cima' });
    expect(fichas(subir)).toEqual(expect.arrayContaining(['min-h-11', 'hover:text-ocean-700']));
    expect(fichas(subir)).not.toContain('hover:text-error');
    fireEvent.click(remover);
    expect(screen.queryByText('Pergunta 2')).not.toBeInTheDocument();
  });

  it('Perfil_Publico_o_link_e_o_slug_compridos_quebram_linha_e_o_guardar_continua_igual', async () => {
    const slug = 'a'.repeat(80);
    respostas['/marketing/booking-link'] = { data: { data: { url: `https://saldesk.cv/book/${slug}` } } };
    montar('/definicoes', { ...OPERADOR, slug });
    await abrir('Perfil Público', 'Logo');
    const link = await screen.findByText(`https://saldesk.cv/book/${slug}`);
    expect(fichas(link)).toEqual(expect.arrayContaining(['break-all', 'min-w-0']));
    expect(fichas(link)).not.toContain('truncate');
    expect(fichas(link.parentElement)).toContain('flex-wrap');
    const ref = screen.getByText(`https://saldesk.cv/operadores.html?ref=${slug}`);
    expect(fichas(ref)).toEqual(expect.arrayContaining(['break-all', 'min-w-0']));
    expect(fichas(screen.getByText('<script data-slug="demo"></script>'))).toContain('break-all');
    fireEvent.change(screen.getByLabelText('Descrição da empresa'), { target: { value: 'Outra' } });
    fireEvent.click(botao('Guardar perfil'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalled());
    expect(ultimoPut()).toEqual({ description: 'Outra' });
  });

  it('Perfil_Publico_os_botoes_soltos_tem_44px_no_telemovel', async () => {
    await abrirPerfil();
    ['Escolher logo', 'Adicionar pergunta'].forEach(n => expect(fichas(botao(n))).toEqual(expect.arrayContaining(['min-h-11', 'md:min-h-0'])));
    ['Abrir editor', 'Pré-visualizar página pública'].forEach(n => expect(fichas(screen.getByRole('link', { name: n }).querySelector('button'))).toEqual(expect.arrayContaining(['min-h-11', 'md:min-h-0'])));
  });
});
