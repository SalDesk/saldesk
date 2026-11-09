import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TemplatesEditor from '../components/messaging/TemplatesEditor';
import useToastStore from '../store/toastStore';
import {
  listMessageTemplates, saveMessageTemplate, previewMessageTemplate, getMessagingChannel,
} from '../services/messagingService';

vi.mock('../services/messagingService', () => ({
  listMessageTemplates: vi.fn(), saveMessageTemplate: vi.fn(), previewMessageTemplate: vi.fn(), getMessagingChannel: vi.fn(),
}));

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;
const classes = (root) => [...root.querySelectorAll('[class]')].map(e => e.getAttribute('class')).join(' ');

const t = (trigger, locale, body, extra = {}) => ({ trigger, locale, body, default_body: body, custom: false, ...extra });
const LISTA = [
  t('booking_confirmed', 'pt', 'Ola {nome_cliente} confirmado'), t('booking_confirmed', 'en', 'Hello {nome_cliente}'),
  t('reminder_d1', 'pt', 'Lembrete personalizado {data}', { default_body: 'Lembrete padrao {data}', custom: true }), t('reminder_d1', 'en', 'Reminder {data}'),
  t('review_request', 'pt', 'Avalie em {link_avaliacao}'), t('review_request', 'en', 'Rate us {link_avaliacao}'),
];
const CANAL_MANUAL = { canal: 'wa_me', modelos: [] };

let spyErr; let spyWarn;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  useToastStore.setState({ toasts: [] });
  listMessageTemplates.mockReset().mockResolvedValue(LISTA);
  getMessagingChannel.mockReset().mockResolvedValue(CANAL_MANUAL);
  saveMessageTemplate.mockReset();
  previewMessageTemplate.mockReset().mockImplementation(async (body) => ({ text: `PREVIA: ${body}`, unknown_variables: body.includes('{xpto}') ? ['xpto'] : [] }));
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
  useToastStore.setState({ toasts: [] });
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

async function montar() {
  const r = render(<TemplatesEditor />);
  await screen.findByText('Confirmação da reserva');
  await screen.findAllByText(/^PREVIA:/);
  return r;
}
const cartao = (titulo) => within(screen.getByText(titulo, { selector: 'h3' }).closest('.p-5'));
const texto = (titulo, idioma = 'PT') => screen.getByLabelText(`${titulo} (${idioma})`);
const mudar = (titulo, valor, idioma = 'PT') => fireEvent.change(texto(titulo, idioma), { target: { value: valor } });
const mensagens = () => useToastStore.getState().toasts.map(x => x.message);

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Editor de mensagens: cartoes', () => {
  it('mostra_o_cartao_do_canal_e_os_tres_gatilhos_com_os_textos_do_servidor', async () => {
    await montar();
    expect(screen.getByText('Como as mensagens são enviadas')).toBeInTheDocument();
    ['Confirmação da reserva', 'Lembrete da véspera', 'Pedido de avaliação'].forEach(x => expect(screen.getByText(x, { selector: 'h3' })).toBeInTheDocument());
    expect(screen.getByText('Enviada para reservas confirmadas.')).toBeInTheDocument();
    expect(texto('Confirmação da reserva')).toHaveValue('Ola {nome_cliente} confirmado');
    expect(texto('Lembrete da véspera')).toHaveValue('Lembrete personalizado {data}');
    expect(screen.getByText(/Estes são os textos que o SalDesk prepara/)).toBeInTheDocument();
  });

  it('canal_manual_e_automatico_com_qualidade_suspenso_e_estado_dos_modelos_da_Meta', async () => {
    await montar();
    expect(screen.getByText('Manual (WhatsApp no telemóvel)')).toBeInTheDocument();
    expect(screen.getByText(/O SalDesk prepara o texto e o WhatsApp abre no telemóvel/)).toBeInTheDocument();
    expect(screen.queryByText(/Qualidade do número/)).not.toBeInTheDocument();
    cleanup();
    getMessagingChannel.mockResolvedValue({
      canal: 'cloud_api', quality_rating: 'GREEN', cloud_status: 'suspended',
      modelos: [
        { trigger: 'booking_confirmed', locale: 'pt', meta_status: 'approved' },
        { trigger: 'reminder_d1', locale: 'en', meta_status: 'pending', meta_reason: 'a rever' },
        { trigger: 'review_request', locale: 'pt', meta_status: 'rejected' },
        { trigger: 'review_request', locale: 'en', meta_status: 'paused' },
        { trigger: 'booking_confirmed', locale: 'en', meta_status: 'disabled' },
        { trigger: 'reminder_d1', locale: 'pt', meta_status: 'xyz' },
      ],
    });
    await montar();
    expect(screen.getByText('Automático (WhatsApp Cloud API)')).toBeInTheDocument();
    expect(screen.getByText('GREEN')).toBeInTheDocument();
    expect(screen.getByText('Envio automático suspenso')).toBeInTheDocument();
    const item = (x) => screen.getByText(x).closest('li');
    expect(item('Confirmação (PT)')).toHaveTextContent('Aprovado');
    expect(item('Lembrete (EN)')).toHaveTextContent('Em análise na Meta');
    expect(item('Lembrete (EN)')).toHaveTextContent('a rever');
    expect(item('Pedido de avaliação (PT)')).toHaveTextContent('Rejeitado');
    expect(item('Pedido de avaliação (EN)')).toHaveTextContent('Em pausa');
    expect(item('Confirmação (EN)')).toHaveTextContent('Desactivado');
    expect(item('Lembrete (PT)')).toHaveTextContent('Em análise na Meta');
  });

  it('getMessagingChannel_a_falhar_nao_mostra_o_cartao', async () => {
    getMessagingChannel.mockRejectedValue(new Error('x'));
    await montar();
    expect(screen.queryByText('Como as mensagens são enviadas')).not.toBeInTheDocument();
  });

  it('listMessageTemplates_a_falhar_mostra_o_erro_do_servidor_ou_a_frase_por_omissao', async () => {
    listMessageTemplates.mockRejectedValue({ response: { data: { error: 'Sem permissao' } } });
    render(<TemplatesEditor />);
    expect(await screen.findByText('Sem permissao')).toBeInTheDocument();
    cleanup();
    listMessageTemplates.mockRejectedValue(new Error('x'));
    render(<TemplatesEditor />);
    expect(await screen.findByText('Não foi possível carregar as mensagens')).toBeInTheDocument();
  });

  it('em_carga_mostra_o_spinner', () => {
    listMessageTemplates.mockReturnValue(new Promise(() => {}));
    const { container } = render(<TemplatesEditor />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Confirmação da reserva')).not.toBeInTheDocument();
  });

  it('um_gatilho_sem_o_par_PT_EN_nao_aparece', async () => {
    listMessageTemplates.mockResolvedValue(LISTA.filter(x => !(x.trigger === 'reminder_d1' && x.locale === 'en')));
    await montar();
    expect(screen.queryByText('Lembrete da véspera', { selector: 'h3' })).not.toBeInTheDocument();
    expect(screen.getByText('Pedido de avaliação', { selector: 'h3' })).toBeInTheDocument();
  });
});

describe('Editor de mensagens: edicao', () => {
  it('o_idioma_troca_o_texto_e_cada_rascunho_mantem_se', async () => {
    await montar();
    mudar('Confirmação da reserva', 'rascunho PT');
    fireEvent.click(cartao('Confirmação da reserva').getByRole('button', { name: 'English' }));
    expect(texto('Confirmação da reserva', 'EN')).toHaveValue('Hello {nome_cliente}');
    fireEvent.click(cartao('Confirmação da reserva').getByRole('button', { name: 'Português' }));
    expect(texto('Confirmação da reserva')).toHaveValue('rascunho PT');
  });

  it('estado_Texto_original_Personalizado_e_Alteracoes_por_guardar', async () => {
    await montar();
    expect(cartao('Confirmação da reserva').getByText('Texto original')).toBeInTheDocument();
    expect(cartao('Lembrete da véspera').getByText('Personalizado')).toBeInTheDocument();
    mudar('Confirmação da reserva', 'outro');
    expect(cartao('Confirmação da reserva').getByText('Alterações por guardar')).toBeInTheDocument();
    expect(cartao('Confirmação da reserva').queryByText('Texto original')).not.toBeInTheDocument();
  });

  it('pre_visualizacao_so_depois_de_350ms_e_ignora_respostas_antigas', async () => {
    await montar();
    const antigas = [];
    previewMessageTemplate.mockImplementation((body) => new Promise((resolve) => {
      antigas.push(() => resolve({ text: `PREVIA: ${body}`, unknown_variables: [] }));
    }));
    previewMessageTemplate.mockClear();
    vi.useFakeTimers();
    mudar('Confirmação da reserva', 'a');
    await act(async () => { await vi.advanceTimersByTimeAsync(349); });
    expect(previewMessageTemplate).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(previewMessageTemplate).toHaveBeenCalledTimes(1);
    expect(previewMessageTemplate).toHaveBeenCalledWith('a', 'pt');
    mudar('Confirmação da reserva', 'b');
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(previewMessageTemplate).toHaveBeenCalledTimes(2);
    await act(async () => { antigas[1](); await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText('PREVIA: b')).toBeInTheDocument();
    await act(async () => { antigas[0](); await vi.advanceTimersByTimeAsync(0); });
    expect(screen.queryByText('PREVIA: a')).not.toBeInTheDocument();
    expect(screen.getByText('PREVIA: b')).toBeInTheDocument();
  });

  it('a_frase_por_omissao_aparece_enquanto_nao_ha_previa', async () => {
    previewMessageTemplate.mockReturnValue(new Promise(() => {}));
    render(<TemplatesEditor />);
    await screen.findByText('Confirmação da reserva');
    expect(screen.getAllByText('A mensagem aparece aqui.')).toHaveLength(3);
  });

  it('variavel_desconhecida_bloqueia_e_mostra_o_aviso', async () => {
    await montar();
    mudar('Confirmação da reserva', 'Ola {xpto}');
    expect(await screen.findByText(/Variável desconhecida: xpto\./)).toBeInTheDocument();
    expect(cartao('Confirmação da reserva').getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('pedido_de_avaliacao_sem_link_avaliacao_bloqueia_e_o_texto_vazio_so_bloqueia', async () => {
    await montar();
    mudar('Pedido de avaliação', 'sem link');
    expect(screen.getByText(/O pedido de avaliação tem de incluir/)).toBeInTheDocument();
    expect(cartao('Pedido de avaliação').getByRole('button', { name: 'Guardar' })).toBeDisabled();
    mudar('Pedido de avaliação', '  ');
    expect(screen.queryByText(/O pedido de avaliação tem de incluir/)).not.toBeInTheDocument();
    expect(cartao('Pedido de avaliação').getByRole('button', { name: 'Guardar' })).toBeDisabled();
    mudar('Pedido de avaliação', 'Avalie {{link_avaliacao}}');
    expect(screen.queryByText(/O pedido de avaliação tem de incluir/)).not.toBeInTheDocument();
    expect(cartao('Pedido de avaliação').getByRole('button', { name: 'Guardar' })).not.toBeDisabled();
  });

  it('acima_de_1000_caracteres_bloqueia_e_o_contador_destaca_se', async () => {
    await montar();
    mudar('Confirmação da reserva', 'x'.repeat(1000));
    const ok = cartao('Confirmação da reserva').getByText('1000/1000');
    expect(ok.className).toBe('');
    expect(cartao('Confirmação da reserva').getByRole('button', { name: 'Guardar' })).not.toBeDisabled();
    mudar('Confirmação da reserva', 'x'.repeat(1001));
    const alto = cartao('Confirmação da reserva').getByText('1001/1000');
    expect(alto.className).toContain('font-semibold');
    expect(cartao('Confirmação da reserva').getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('inserir_variavel_no_cursor_e_devolve_o_foco', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { setTimeout(() => cb(0), 0); return 1; });
    await montar();
    mudar('Confirmação da reserva', 'AB');
    const ta = texto('Confirmação da reserva');
    ta.setSelectionRange(1, 1);
    fireEvent.click(cartao('Confirmação da reserva').getByRole('button', { name: '{data}' }));
    expect(ta).toHaveValue('A{data}B');
    await waitFor(() => expect(document.activeElement).toBe(ta));
    await waitFor(() => expect(ta.selectionStart).toBe(1 + '{data}'.length));
  });
});

describe('Editor de mensagens: guardar e repor', () => {
  it('guardar_chama_saveMessageTemplate_mostra_o_aviso_e_actualiza_o_estado', async () => {
    saveMessageTemplate.mockResolvedValue({ body: 'novo texto', custom: true });
    await montar();
    mudar('Confirmação da reserva', 'novo texto');
    fireEvent.click(cartao('Confirmação da reserva').getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(saveMessageTemplate).toHaveBeenCalledWith('booking_confirmed', 'pt', 'novo texto'));
    await waitFor(() => expect(mensagens()).toContain('Mensagem guardada'));
    expect(cartao('Confirmação da reserva').getByText('Personalizado')).toBeInTheDocument();
    expect(cartao('Confirmação da reserva').getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('guardar_com_erro_do_servidor_ou_Nao_foi_possivel_guardar', async () => {
    await montar();
    mudar('Confirmação da reserva', 'novo texto');
    saveMessageTemplate.mockRejectedValueOnce({ response: { data: { error: 'Texto invalido' } } });
    fireEvent.click(cartao('Confirmação da reserva').getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Texto invalido')).toBeInTheDocument();
    saveMessageTemplate.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(cartao('Confirmação da reserva').getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Não foi possível guardar')).toBeInTheDocument();
  });

  it('repor_so_aparece_com_texto_personalizado_ou_diferente_do_padrao_e_envia_texto_vazio', async () => {
    saveMessageTemplate.mockResolvedValue({ body: 'Lembrete padrao {data}' });
    await montar();
    expect(cartao('Confirmação da reserva').queryByRole('button', { name: 'Repor texto original' })).not.toBeInTheDocument();
    mudar('Confirmação da reserva', 'diferente');
    expect(cartao('Confirmação da reserva').getByRole('button', { name: 'Repor texto original' })).toBeInTheDocument();
    fireEvent.click(cartao('Lembrete da véspera').getByRole('button', { name: 'Repor texto original' }));
    await waitFor(() => expect(saveMessageTemplate).toHaveBeenCalledWith('reminder_d1', 'pt', ''));
    await waitFor(() => expect(mensagens()).toContain('Texto original reposto'));
    expect(texto('Lembrete da véspera')).toHaveValue('Lembrete padrao {data}');
    expect(cartao('Lembrete da véspera').getByText('Texto original')).toBeInTheDocument();
  });

  it('repor_com_erro_mostra_a_frase_por_omissao', async () => {
    await montar();
    saveMessageTemplate.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(cartao('Lembrete da véspera').getByRole('button', { name: 'Repor texto original' }));
    expect(await screen.findByText('Não foi possível repor')).toBeInTheDocument();
  });
});

/* ───────────────────────── design system ───────────────────────── */

describe('Editor de mensagens: design system', () => {
  it('os_estados_do_cartao_sao_Badge_com_a_variante_certa', async () => {
    await montar();
    mudar('Pedido de avaliação', 'alterado {link_avaliacao}');
    expect(cartao('Confirmação da reserva').getByText('Texto original').className).toContain('bg-n-100');
    expect(cartao('Lembrete da véspera').getByText('Personalizado').className).toContain('var(--info-light)');
    expect(cartao('Pedido de avaliação').getByText('Alterações por guardar').className).toContain('var(--warning-light)');
  });

  it('o_canal_e_os_estados_da_Meta_sao_Badge_com_a_variante_certa', async () => {
    getMessagingChannel.mockResolvedValue({
      canal: 'cloud_api', cloud_status: 'suspended',
      modelos: [
        { trigger: 'booking_confirmed', locale: 'pt', meta_status: 'approved' }, { trigger: 'reminder_d1', locale: 'en', meta_status: 'pending' },
        { trigger: 'review_request', locale: 'pt', meta_status: 'rejected' },
      ],
    });
    await montar();
    expect(screen.getByText('Automático (WhatsApp Cloud API)').className).toContain('var(--success-light)');
    expect(screen.getByText('Envio automático suspenso').className).toContain('var(--error-light)');
    expect(screen.getByText('Aprovado').className).toContain('var(--success-light)');
    expect(screen.getByText('Em análise na Meta').className).toContain('var(--warning-light)');
    expect(screen.getByText('Rejeitado').className).toContain('var(--error-light)');
    cleanup();
    getMessagingChannel.mockResolvedValue(CANAL_MANUAL);
    await montar();
    expect(screen.getByText('Manual (WhatsApp no telemóvel)').className).toContain('bg-n-100');
  });

  it('o_campo_e_o_Textarea_do_ui_com_nome_acessivel', async () => {
    await montar();
    const ta = texto('Confirmação da reserva');
    expect(ta.tagName).toBe('TEXTAREA');
    expect(ta.className).toContain('app:bg-white');
    expect(ta).toHaveAttribute('rows', '9');
  });

  it('sem_cores_nomeadas_text_error_bg_red_sand_700_ou_hexadecimais_em_classes', async () => {
    getMessagingChannel.mockResolvedValue({
      canal: 'cloud_api', cloud_status: 'suspended', quality_rating: 'GREEN',
      modelos: ['approved', 'pending', 'rejected', 'paused', 'disabled'].map((s, i) => ({ trigger: 'booking_confirmed', locale: `l${i}`, meta_status: s })),
    });
    const { container } = await montar();
    mudar('Pedido de avaliação', 'x'.repeat(1001));
    mudar('Confirmação da reserva', 'Ola {xpto}');
    await screen.findByText(/Variável desconhecida/);
    const html = classes(container);
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html).not.toMatch(/(?:text|bg|border)-error/);
    expect(html).not.toMatch(/bg-red-/);
    expect(html).not.toMatch(/sand-(?:700|200)/);
  });
});
