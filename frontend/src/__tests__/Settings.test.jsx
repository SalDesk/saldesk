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
  description_pt: 'Desc PT', description_en: 'Desc EN', cancellation_policy_pt: 'CP PT', cancellation_policy_en: 'CP EN',
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
const cartao = (titulo) => screen.getByText(titulo, { selector: 'h3' }).parentElement.parentElement;
const botao = (nome) => screen.getByRole('button', { name: nome });
const ultimoPut = () => updateOperator.mock.calls[updateOperator.mock.calls.length - 1][0];

/* ───────────────────────── caracterizacao: estrutura ───────────────────────── */

describe('Definicoes: estrutura', () => {
  it('abre_em_Conta_e_o_query_string_tab_escolhe_o_separador_inicial', async () => {
    montar();
    expect(screen.getByText('Definicoes')).toBeInTheDocument();
    expect(screen.getByText('Dados da empresa')).toBeInTheDocument();
    cleanup();
    montar('/definicoes?tab=notificacoes');
    expect(screen.getByText('Canal de notificacoes')).toBeInTheDocument();
    cleanup();
    montar('/definicoes?tab=nao-existe');
    expect(screen.getByText('Dados da empresa')).toBeInTheDocument();
  });

  it('os_sete_separadores_trocam_o_conteudo', async () => {
    montar();
    for (const [rotulo, ancora] of [
      ['Perfil Publico', 'Logo'], ['Pagamentos', 'Guardar credenciais'], ['Facturacao', 'Subscricao actual'],
      ['Notificacoes', 'Canal de notificacoes'], ['Mensagens', 'EDITOR MENSAGENS'], ['Seguranca', 'Alterar password'], ['Conta', 'Dados da empresa'],
    ]) {
      await abrir(rotulo, ancora);
    }
    expect(screen.queryByText('EDITOR MENSAGENS')).not.toBeInTheDocument();
  });
});

/* ───────────────────────── caracterizacao: Conta ───────────────────────── */

describe('Definicoes: Conta', () => {
  it('mostra_os_valores_do_operador_e_os_por_omissao', () => {
    montar();
    expect(campo('Nome da empresa')).toHaveValue('Sal Aventura');
    expect(campo('Email')).toHaveValue('a@x.test');
    expect(campo('Telefone')).toHaveValue('+238 111');
    expect(campo('WhatsApp')).toHaveValue('+238 222');
    expect(campo('Morada')).toHaveValue('Rua 1');
    expect(campo('Idioma', 'select')).toHaveValue('en');
    expect(campo('Moeda', 'select')).toHaveValue('EUR');
    expect(campo('Fuso horario', 'select')).toHaveValue('Europe/Lisbon');
    cleanup();
    montar('/definicoes', { id: 'o', name: 'X', email: 'e@x.test' });
    expect(campo('Idioma', 'select')).toHaveValue('pt');
    expect(campo('Moeda', 'select')).toHaveValue('CVE');
    expect(campo('Fuso horario', 'select')).toHaveValue('Atlantic/Cape_Verde');
    expect(campo('Telefone')).toHaveValue('');
  });

  it('as_opcoes_de_idioma_moeda_e_fuso_horario', () => {
    montar();
    expect([...campo('Idioma', 'select').options].map(o => o.textContent)).toEqual(['PT', 'EN', 'DE', 'NL', 'FR', 'ES']);
    expect([...campo('Moeda', 'select').options].map(o => o.textContent)).toEqual(['CVE', 'EUR', 'USD', 'GBP']);
    expect([...campo('Fuso horario', 'select').options].map(o => o.textContent)).toEqual([
      'Atlantic/Cape Verde', 'Europe/Lisbon', 'Europe/London', 'America/New York', 'America/Sao_Paulo'.replace('_', ' '),
    ]);
  });

  it('guardar_chama_updateOperator_com_os_oito_campos_e_setOperator_e_mostra_Guardado_com_sucesso', async () => {
    montar();
    fireEvent.change(campo('Nome da empresa'), { target: { value: 'Novo Nome' } });
    fireEvent.change(campo('Moeda', 'select'), { target: { value: 'USD' } });
    fireEvent.click(botao('Guardar alteracoes'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalledWith({
      name: 'Novo Nome', email: 'a@x.test', phone: '+238 111', whatsapp: '+238 222', address: 'Rua 1',
      language: 'en', currency: 'USD', timezone: 'Europe/Lisbon',
    }));
    expect(await screen.findByText('Guardado com sucesso')).toBeInTheDocument();
    expect(useAuthStore.getState().operator.name).toBe('Novo Nome');
  });

  it('o_aviso_de_guardado_desaparece_apos_3s', async () => {
    montar();
    vi.useFakeTimers();
    fireEvent.click(botao('Guardar alteracoes'));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText('Guardado com sucesso')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
    expect(screen.getByText('Guardado com sucesso')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByText('Guardado com sucesso')).not.toBeInTheDocument();
  });

  it('erro_do_servidor_ou_Erro ao guardar', async () => {
    updateOperator.mockRejectedValueOnce({ response: { data: { error: 'Email invalido' } } });
    montar();
    fireEvent.click(botao('Guardar alteracoes'));
    expect(await screen.findByText('Email invalido')).toBeInTheDocument();
    updateOperator.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(botao('Guardar alteracoes'));
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
  await abrir('Perfil Publico', 'Logo');
  await screen.findByText(/saldesk\.cv\/book\/demo|^\.\.\.$/);
  return r;
}
const arquivo = (nome, conteudo) => new File([conteudo], nome, { type: 'image/png' });

describe('Definicoes: Perfil Publico', () => {
  it('mostra_os_valores_do_operador', async () => {
    await abrirPerfil();
    expect(campo('Portugues', 'textarea', within(cartao('Descricao')))).toHaveValue('Desc PT');
    expect(campo('Ingles (EN)', 'textarea', within(cartao('Descricao')))).toHaveValue('Desc EN');
    expect(campo('Portugues', 'textarea', within(cartao('Politica de cancelamento')))).toHaveValue('CP PT');
    expect(campo('Ingles (EN)', 'textarea', within(cartao('Politica de cancelamento')))).toHaveValue('CP EN');
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
    validateImageFile.mockReturnValueOnce('Formato invalido: l.gif. Usa JPG, PNG ou WebP.');
    fireEvent.change(entrada(), { target: { files: [arquivo('l.gif', 'a')] } });
    expect(await screen.findByText('Formato invalido: l.gif. Usa JPG, PNG ou WebP.')).toBeInTheDocument();
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

  it('guardar_envia_cover_images_com_as_urls_actuais_e_sem_capas_envia_lista_vazia', async () => {
    await abrirPerfil({ ...OPERADOR, cover_images: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'] });
    fireEvent.click(botao('Guardar perfil'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalledTimes(1));
    expect(ultimoPut().cover_images).toEqual(['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg']);
    cleanup();
    await abrirPerfil({ ...OPERADOR, cover_images: undefined });
    fireEvent.click(botao('Guardar perfil'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalledTimes(2));
    expect(ultimoPut().cover_images).toEqual([]);
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

  it('guardar_envia_logo_descricoes_politicas_e_faqs_so_com_pergunta_e_setOperator', async () => {
    await abrirPerfil();
    fireEvent.click(botao('Adicionar pergunta'));
    fireEvent.change(campoFaq(3, 'Resposta PT', 'textarea'), { target: { value: 'so resposta' } });
    fireEvent.change(campo('Portugues', 'textarea', within(cartao('Descricao'))), { target: { value: 'Nova desc' } });
    fireEvent.click(botao('Guardar perfil'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalledWith({
      logo_url: null, description_pt: 'Nova desc', description_en: 'Desc EN',
      cancellation_policy_pt: 'CP PT', cancellation_policy_en: 'CP EN',
      custom_faqs: OPERADOR.custom_faqs, cover_images: [],
    }));
    expect(await screen.findByText('Guardado com sucesso')).toBeInTheDocument();
    expect(useAuthStore.getState().operator.description_pt).toBe('Nova desc');
  });

  it('falha_ao_guardar_regista_console.error_e_nao_mostra_o_aviso', async () => {
    updateOperator.mockRejectedValue(new Error('x'));
    await abrirPerfil();
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
    expect(f.getByRole('link', { name: 'Pre-visualizar pagina publica' })).toHaveAttribute('href', '/book/demo');
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
    await abrir('Perfil Publico', 'Logo');
    await screen.findByText('...');
    const f = within(cartao('Ferramentas de marketing'));
    expect(f.queryByAltText('QR Code')).not.toBeInTheDocument();
    expect(f.queryByText('Widget embebivel')).not.toBeInTheDocument();
    expect(f.queryByRole('link', { name: 'Abrir' })).not.toBeInTheDocument();
    expect(f.getByRole('link', { name: 'Pre-visualizar pagina publica' })).toHaveAttribute('href', '#');
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

describe('Definicoes: Pagamentos', () => {
  it('mostra_o_estado_PayPal_Webhook_e_SISP_e_os_marcadores_de_ja_configurado', async () => {
    montar();
    await abrir('Pagamentos', 'Webhook PayPal');
    expect(estadoCartao('PayPal')).toBe('Configurado');
    expect(estadoCartao('Webhook PayPal')).toBe('Nao configurado');
    expect(estadoCartao('SISP Vinti4')).toBe('Nao configurado');
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

const plano = (nome) => screen.getAllByText(nome).find(e => e.tagName === 'P' && e.className.includes('text-n-900') && !e.className.includes('text-lg')).closest('div.space-y-2');
async function abrirFacturacao(op = OPERADOR) {
  montar('/definicoes', op);
  await abrir('Facturacao', 'Subscricao actual');
  await screen.findByText('Historico de pagamentos');
  await act(async () => {});
}
const escolher = (nomePlano) => fireEvent.click(within(plano(nomePlano)).getByRole('button'));
const modalPagamento = () => within(screen.getByText('Como quer pagar?').closest('[role="dialog"]'));

describe('Definicoes: Facturacao', () => {
  it('mostra_plano_estado_renovacao_e_cancelar', async () => {
    await abrirFacturacao();
    const sub = within(cartao('Subscricao actual'));
    expect(sub.getByText('Pro')).toBeInTheDocument();
    expect(sub.getByText('Activo')).toBeInTheDocument();
    expect(sub.getByText(`Renova automaticamente a ${new Date(OPERADOR.plan_paid_until).toLocaleDateString('pt-PT')}`)).toBeInTheDocument();
    expect(sub.getByRole('button', { name: 'Cancelar subscricao' })).toBeInTheDocument();
  });

  it('sem_subscricao_activa_mostra_pago_ate_e_sem_cancelar', async () => {
    await abrirFacturacao({ ...OPERADOR, paypal_subscription_id: null });
    const sub = within(cartao('Subscricao actual'));
    expect(sub.getByText(`Pago ate ${new Date(OPERADOR.plan_paid_until).toLocaleDateString('pt-PT')}`)).toBeInTheDocument();
    expect(sub.queryByRole('button', { name: 'Cancelar subscricao' })).not.toBeInTheDocument();
  });

  it('avaliacao_em_curso_expirada_e_estado_desconhecido', async () => {
    await abrirFacturacao({ ...OPERADOR, plan_status: 'trial', trial_ends_at: dia(5), plan_paid_until: null, paypal_subscription_id: null });
    expect(within(cartao('Subscricao actual')).getByText('Periodo de avaliacao')).toBeInTheDocument();
    expect(screen.getByText('5 dias restantes no periodo de avaliacao')).toBeInTheDocument();
    cleanup();
    await abrirFacturacao({ ...OPERADOR, plan_status: 'trial', trial_ends_at: dia(-1), plan_paid_until: null, paypal_subscription_id: null });
    expect(screen.getByText('Periodo de avaliacao terminado')).toBeInTheDocument();
    cleanup();
    await abrirFacturacao({ ...OPERADOR, plan_status: 'xyz', paypal_subscription_id: null });
    expect(within(cartao('Subscricao actual')).getByText('xyz')).toBeInTheDocument();
  });

  it('plano_actual_desactivado_e_os_outros_mostram_o_preco', async () => {
    await abrirFacturacao();
    expect(within(plano('Pro')).getByRole('button', { name: 'Plano actual' })).toBeDisabled();
    expect(within(plano('Starter')).getByRole('button', { name: 'Subscrever' })).not.toBeDisabled();
    expect(plano('Starter')).toHaveTextContent('€29/mes');
    expect(plano('Business')).toHaveTextContent('€79/mes');
    expect(plano('Pro')).toHaveTextContent('€69/mes');
  });

  it('escolher_um_plano_abre_o_modal_com_o_preco_em_euro_e_CVE_e_a_politica_desbloqueia_os_botoes', async () => {
    await abrirFacturacao();
    escolher('Business');
    const m = modalPagamento();
    expect(norm(m.getByText(/Plano/).parentElement.textContent)).toContain(`Plano Business — €79/mes`);
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
    expect(await screen.findByText('Nao foi possivel iniciar a subscricao. Tenta novamente.')).toBeInTheDocument();
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
    expect(await screen.findByText('O pagamento por SISP ainda nao esta disponivel para a subscricao SalDesk.')).toBeInTheDocument();
    createSispCheckout.mockRejectedValueOnce(new Error('x'));
    escolher('Business');
    fireEvent.click(modalPagamento().getByRole('checkbox'));
    fireEvent.click(modalPagamento().getByRole('button', { name: /^SISP Vinti4/ }));
    expect(await screen.findByText('Nao foi possivel iniciar o pagamento SISP. Tenta novamente.')).toBeInTheDocument();
  });

  it('cancelar_subscricao_abre_o_modal_chama_cancelSubscription_e_recarrega_o_operador', async () => {
    cancelSubscription.mockResolvedValue({});
    await abrirFacturacao();
    fireEvent.click(within(cartao('Subscricao actual')).getByRole('button', { name: 'Cancelar subscricao' }));
    expect(screen.getByText(/Tens a certeza que queres cancelar a subscricao/)).toBeInTheDocument();
    fireEvent.click(botao('Confirmar cancelamento'));
    await waitFor(() => expect(cancelSubscription).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText(/Tens a certeza que queres cancelar/)).not.toBeInTheDocument());
    expect(api.get).toHaveBeenCalledWith('/auth/me');
    expect(within(cartao('Subscricao actual')).getByText('Cancelado')).toBeInTheDocument();
  });

  it('cancelar_falha_mostra_o_erro_e_Voltar_fecha_o_modal', async () => {
    cancelSubscription.mockRejectedValue(new Error('x'));
    await abrirFacturacao();
    fireEvent.click(within(cartao('Subscricao actual')).getByRole('button', { name: 'Cancelar subscricao' }));
    fireEvent.click(botao('Confirmar cancelamento'));
    expect(await screen.findByText('Nao foi possivel cancelar a subscricao. Tenta novamente.')).toBeInTheDocument();
    fireEvent.click(botao('Voltar'));
    expect(screen.queryByText(/Tens a certeza que queres cancelar/)).not.toBeInTheDocument();
  });

  it('historico_com_estados_Pago_Falhou_Pendente_e_o_vazio', async () => {
    await abrirFacturacao();
    const h = within(cartao('Historico de pagamentos'));
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

describe('Definicoes: Notificacoes', () => {
  it('valores_por_omissao_e_os_do_operador', async () => {
    montar();
    await abrir('Notificacoes', 'Canal de notificacoes');
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

  it('guardar_chama_updateOperator_com_notification_prefs_e_notif_channel', async () => {
    montar('/definicoes?tab=notificacoes');
    fireEvent.click(canal('Email'));
    expect(canalMarcado('Email')).toBe(true);
    fireEvent.click(interruptor('Nova reserva'));
    fireEvent.click(interruptor('Lembrete de check-in'));
    fireEvent.click(botao('Guardar preferencias'));
    await waitFor(() => expect(updateOperator).toHaveBeenCalledWith({
      notification_prefs: { new_booking: true, cancellation: true, payment_confirmed: true, review_received: true, new_message: true, checkin_reminder: true },
      notif_channel: 'email',
    }));
    expect(await screen.findByText('Guardado com sucesso')).toBeInTheDocument();
  });

  it('falha_regista_console.error', async () => {
    updateOperator.mockRejectedValue(new Error('x'));
    montar('/definicoes?tab=notificacoes');
    fireEvent.click(botao('Guardar preferencias'));
    await waitFor(() => expect(spyErr).toHaveBeenCalled());
    spyErr.mockClear();
    expect(screen.queryByText('Guardado com sucesso')).not.toBeInTheDocument();
  });
});

/* ───────────────────────── caracterizacao: Seguranca ───────────────────────── */

const pw = (rotulo) => campo(rotulo);
const formPw = () => pw('Nova password').closest('form');

describe('Definicoes: Seguranca', () => {
  it('valida_a_forca_e_a_confirmacao', async () => {
    montar('/definicoes?tab=seguranca');
    fireEvent.change(pw('Nova password'), { target: { value: 'abc' } });
    fireEvent.submit(formPw());
    expect(screen.getByText('A password deve ser forte: 8+ caracteres, maiuscula, numero e especial.')).toBeInTheDocument();
    fireEvent.change(pw('Nova password'), { target: { value: 'Abcdef1!' } });
    fireEvent.change(pw('Confirmar nova password'), { target: { value: 'outra' } });
    expect(screen.getAllByText('As passwords nao coincidem.')).toHaveLength(1);
    fireEvent.submit(formPw());
    expect(screen.getAllByText('As passwords nao coincidem.')).toHaveLength(2);
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

describe('Definicoes: design system (estrutura, Conta, Notificacoes e Seguranca)', () => {
  it('os_sete_separadores_sao_Tabs_sem_icones_e_o_query_string_escolhe_o_inicial', async () => {
    montar();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const nomes = ['Conta', 'Perfil Publico', 'Pagamentos', 'Facturacao', 'Notificacoes', 'Mensagens', 'Seguranca'];
    nomes.forEach(n => expect(screen.getByRole('tab', { name: n })).toBeInTheDocument());
    expect(screen.getAllByRole('tab')).toHaveLength(7);
    expect(screen.getByRole('tab', { name: 'Conta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Conta' }).querySelector('svg')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Seguranca' }));
    expect(screen.getByRole('tab', { name: 'Seguranca' })).toHaveAttribute('aria-selected', 'true');
    cleanup();
    montar('/definicoes?tab=facturacao');
    expect(screen.getByRole('tab', { name: 'Facturacao' })).toHaveAttribute('aria-selected', 'true');
    await screen.findByText('Pago');
  });

  it('o_aviso_de_guardado_tem_role_status_e_tokens', async () => {
    montar();
    fireEvent.click(botao('Guardar alteracoes'));
    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent('Guardado com sucesso');
    expect(aviso.className).toContain('var(--success-light)');
    expect(aviso.className).toContain('var(--success)');
  });

  it('os_campos_de_Conta_tem_nome_acessivel_e_o_erro_usa_tokens', async () => {
    montar();
    ['Nome da empresa', 'Email', 'Telefone', 'WhatsApp', 'Morada', 'Idioma', 'Moeda', 'Fuso horario'].forEach(e => expect(screen.getByLabelText(e)).toBeInTheDocument());
    updateOperator.mockRejectedValueOnce({ response: { data: { error: 'Email invalido' } } });
    fireEvent.click(botao('Guardar alteracoes'));
    const erro = await screen.findByText('Email invalido');
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
    const inline = screen.getByText('As passwords nao coincidem.');
    expect(inline.className).toContain('var(--error)');
    fireEvent.submit(formPw());
    const erro = screen.getByText('A password deve ser forte: 8+ caracteres, maiuscula, numero e especial.');
    expect(erro.className).toContain('var(--error-light)');
  });

  it('sem_cores_nomeadas_text_error_bg_red_ou_hexadecimais_em_classes_em_Conta_Notificacoes_e_Seguranca', async () => {
    const { container } = montar();
    let html = classes(container);
    updateOperator.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(botao('Guardar alteracoes'));
    await screen.findByText('Erro ao guardar');
    html += classes(container);
    fireEvent.click(botao('Guardar alteracoes'));
    await screen.findByRole('status');
    html += classes(container);
    fireEvent.click(screen.getByRole('tab', { name: 'Notificacoes' }));
    html += classes(container);
    fireEvent.click(screen.getByRole('tab', { name: 'Seguranca' }));
    fireEvent.change(pw('Confirmar nova password'), { target: { value: 'x' } });
    fireEvent.submit(formPw());
    html += classes(container);
    semCoresForaDosTokens(html);
  });
});

/* ───────────────────────── design system: Perfil Publico ───────────────────────── */

describe('Definicoes: design system (Perfil Publico)', () => {
  it('os_campos_tem_nome_acessivel_incluindo_os_pares_PT_EN_com_contexto', async () => {
    const { container } = await abrirPerfil();
    ['Descricao em Portugues', 'Descricao em Ingles', 'Politica de cancelamento em Portugues', 'Politica de cancelamento em Ingles',
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
    fireEvent.click(botao('Guardar perfil'));
    await waitFor(() => expect(spyErr).toHaveBeenCalled());
    spyErr.mockClear();
    fireEvent.click(botao('Guardar perfil'));
    await screen.findByRole('status');
    /* as fotos sao do ImageUploader (partilhado, com o botao de remover em bg-error): so se verifica o resto do ecra */
    const sem = container.cloneNode(true);
    sem.querySelectorAll('div.group').forEach(n => n.remove());
    semCoresForaDosTokens(classes(sem));
  });
});

/* ───────────────────────── design system: Pagamentos e Facturacao ───────────────────────── */

describe('Definicoes: design system (Pagamentos e Facturacao)', () => {
  it('os_estados_de_Pagamentos_tem_role_status_e_tokens_e_os_campos_tem_nome', async () => {
    montar();
    await abrir('Pagamentos', 'Webhook PayPal');
    const estados = screen.getAllByRole('status');
    expect(estados).toHaveLength(3);
    expect(estados[0].className).toContain('var(--success-light)');
    expect(estados[1].className).toContain('bg-n-50');
    ['Client ID', 'Client Secret', 'Webhook ID', 'POS ID', 'POS Auth Code'].forEach(e => expect(screen.getByLabelText(e)).toBeInTheDocument());
    expect(screen.getByLabelText('Client ID')).toHaveAttribute('type', 'password');
  });

  it('o_estado_da_subscricao_e_Badge_com_a_variante_certa', async () => {
    const estado = async (op, texto) => {
      await abrirFacturacao(op);
      const e = within(cartao('Subscricao actual')).getByText(texto);
      cleanup();
      return e.className;
    };
    expect(await estado(OPERADOR, 'Activo')).toContain('var(--success-light)');
    expect(await estado({ ...OPERADOR, plan_status: 'trial', trial_ends_at: dia(5) }, 'Periodo de avaliacao')).toContain('var(--info-light)');
    expect(await estado({ ...OPERADOR, plan_status: 'suspended', paypal_subscription_id: null }, 'Suspenso')).toContain('var(--error-light)');
    expect(await estado({ ...OPERADOR, plan_status: 'cancelled', paypal_subscription_id: null }, 'Cancelado')).toContain('bg-n-100');
    expect(await estado({ ...OPERADOR, plan_status: 'xyz', paypal_subscription_id: null }, 'xyz')).toContain('bg-n-100');
  });

  it('o_historico_e_os_erros_usam_tokens', async () => {
    createSubscription.mockRejectedValueOnce(new Error('x'));
    await abrirFacturacao();
    const h = within(cartao('Historico de pagamentos'));
    expect(h.getByText('Pago').className).toContain('var(--success)');
    expect(h.getByText('Falhou').className).toContain('var(--error)');
    escolher('Starter');
    fireEvent.click(modalPagamento().getByRole('checkbox'));
    fireEvent.click(modalPagamento().getByRole('button', { name: /^PayPal/ }));
    const erro = await screen.findByText('Nao foi possivel iniciar a subscricao. Tenta novamente.');
    expect(erro.className).toContain('var(--error-light)');
    expect(erro.className).toContain('var(--error)');
  });

  it('sem_cores_nomeadas_text_error_bg_red_ou_hexadecimais_em_classes_em_Pagamentos_e_Facturacao', async () => {
    /* o botao "Confirmar cancelamento" e um ui/Button variant=danger (bg-error): o modal de cancelamento fica de fora */
    const { container } = montar();
    await abrir('Pagamentos', 'Webhook PayPal');
    let html = classes(container);
    fireEvent.click(separador('Facturacao'));
    await screen.findByText('Historico de pagamentos');
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
    await screen.findByText('Nao foi possivel iniciar a subscricao. Tenta novamente.');
    html += classes(r.container);
    semCoresForaDosTokens(html);
  });
});
