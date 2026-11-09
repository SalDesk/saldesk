import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Automations from '../pages/Automations';
import {
  listAutomations, createAutomation, updateAutomation, toggleAutomation, getLogsAll,
} from '../services/automationsService';

vi.mock('../services/automationsService', () => ({
  listAutomations: vi.fn(), createAutomation: vi.fn(), updateAutomation: vi.fn(),
  toggleAutomation: vi.fn(), getLogsAll: vi.fn(),
}));

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;

const T_EMAIL = 'Nova reserva — Email de confirmacao';
const T_WHATS = 'Nova reserva — WhatsApp de boas-vindas';
const T_D7 = 'D-7 — Email de preparacao';
const T_D3 = 'D-3 — Email com instrucoes';
const T_D1 = 'D-1 — WhatsApp de lembrete';
const TITULOS = [T_EMAIL, T_WHATS, T_D7, T_D3, T_D1, 'D+1 — Pedido de avaliacao', 'D+7 — Desconto proxima reserva', 'D+30 — Newsletter de novos tours'];

const A1 = { id: 'a1', trigger_type: 'booking_confirmed', trigger_days: null, channel: 'email', active: true, subject_pt: 'Assunto PT guardado', subject_en: 'Subject EN saved', message_pt: 'Mensagem guardada PT', message_en: 'Saved message EN' };
const A2 = { id: 'a2', trigger_type: 'days_before_checkin', trigger_days: 7, channel: 'email', active: false, subject: 'Assunto antigo', message_pt: 'Corpo D7' };
const A3 = { id: 'a3', trigger_type: 'days_before_checkin', trigger_days: '3', channel: 'email', active: true };
const A9 = { id: 'a9', trigger_type: 'outro', trigger_days: null, channel: 'sms', active: true };

let spyErr; let spyWarn;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  listAutomations.mockReset().mockResolvedValue([A1, A2, A3, A9]);
  getLogsAll.mockReset().mockResolvedValue([]);
  [createAutomation, updateAutomation, toggleAutomation].forEach(f => f.mockReset());
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  vi.restoreAllMocks();
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

async function montar() {
  const r = render(<Automations />);
  await screen.findByText(T_EMAIL);
  return r;
}
/* o p do titulo fica dentro do bloco de texto, dentro do cabecalho clicavel */
const cabecalho = (titulo) => screen.getByText(titulo).parentElement.parentElement;
const abrir = (titulo) => fireEvent.click(cabecalho(titulo));
const interruptor = (titulo) => cabecalho(titulo).querySelector('button');
const esbatida = (titulo) => cabecalho(titulo).closest('.opacity-70') !== null;
const campo = (etiqueta, tag = 'input') => screen.getByText(etiqueta).parentElement.querySelector(tag);
const botao = (nome) => screen.getByRole('button', { name: nome });
const separador = (rotulo) => screen.getAllByText(rotulo).find(e => e.closest('button')).closest('button');

/* ───────────────────────── caracterizacao: estrutura e sequencias ───────────────────────── */

describe('Automacoes: lista de sequencias', () => {
  it('mostra_as_oito_sequencias_e_o_subtitulo_com_as_activas', async () => {
    await montar();
    expect(screen.getByText('Automacoes de Comunicacao')).toBeInTheDocument();
    TITULOS.forEach(t => expect(screen.getByText(t)).toBeInTheDocument());
    expect(screen.getByText('Email imediato ao cliente apos confirmacao')).toBeInTheDocument();
    expect(screen.getByText('7 dias antes do tour')).toBeInTheDocument();
    expect(screen.getByText('30 dias apos o tour')).toBeInTheDocument();
    expect(screen.getByText('3 sequencia(s) activa(s)')).toBeInTheDocument();
    expect(screen.getAllByText('Email')).toHaveLength(6);
    expect(screen.getAllByText('WhatsApp')).toHaveLength(2);
    expect(screen.getByText('Variaveis disponiveis:').parentElement.textContent).toContain('{nome_cliente} · {nome_tour} · {data} · {hora} · {guia} · {ponto_encontro}');
  });

  it('encontra_a_automacao_por_tipo_canal_e_dias', async () => {
    await montar();
    expect(esbatida(T_EMAIL)).toBe(false);
    expect(esbatida(T_D7)).toBe(true);
    expect(esbatida(T_D3)).toBe(false);
    expect(esbatida(T_WHATS)).toBe(true);
    expect(esbatida(T_D1)).toBe(true);
  });

  it('trigger_days_em_falta_ou_zero_casa_com_a_reserva_confirmada', async () => {
    listAutomations.mockResolvedValue([{ id: 'z', trigger_type: 'booking_confirmed', trigger_days: 0, channel: 'whatsapp', active: true }]);
    await montar();
    expect(esbatida(T_WHATS)).toBe(false);
    expect(esbatida(T_EMAIL)).toBe(true);
  });

  it('sem_automacoes_todas_ficam_inactivas_e_esbatidas', async () => {
    listAutomations.mockResolvedValue([]);
    await montar();
    TITULOS.forEach(t => expect(esbatida(t)).toBe(true));
    expect(screen.getByText('0 sequencia(s) activa(s)')).toBeInTheDocument();
  });

  it('listAutomations_a_falhar_ou_nulo_nao_rebenta', async () => {
    listAutomations.mockRejectedValue(new Error('x'));
    await montar();
    expect(screen.getByText('0 sequencia(s) activa(s)')).toBeInTheDocument();
    cleanup();
    listAutomations.mockResolvedValue(null);
    await montar();
    expect(screen.getByText('0 sequencia(s) activa(s)')).toBeInTheDocument();
  });

  it('em_carga_mostra_o_spinner_e_nao_as_sequencias', () => {
    listAutomations.mockReturnValue(new Promise(() => {}));
    const { container } = render(<Automations />);
    expect(screen.getByText('Automacoes de Comunicacao')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText(T_EMAIL)).not.toBeInTheDocument();
  });
});

describe('Automacoes: cartao de sequencia', () => {
  it('abrir_mostra_assunto_e_mensagem_PT_lidos_da_automacao_ou_dos_valores_por_omissao', async () => {
    await montar();
    abrir(T_EMAIL);
    expect(screen.getByText('Assunto PT guardado')).toBeInTheDocument();
    expect(screen.getByText('Mensagem guardada PT')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar template' })).toBeInTheDocument();
    abrir(T_EMAIL);
    expect(screen.queryByText('Mensagem guardada PT')).not.toBeInTheDocument();
    abrir(T_D7);
    expect(screen.getByText('Assunto antigo')).toBeInTheDocument();
    abrir(T_D7);
    abrir(T_WHATS);
    expect(screen.getByText(/^Ola \{nome_cliente\}! Confirmamos a sua reserva/)).toBeInTheDocument();
    expect(screen.queryByText('Assunto PT')).not.toBeInTheDocument();
    abrir(T_WHATS);
    abrir(T_D3);
    expect(screen.getByText('Instrucoes finais para o seu tour — {nome_tour}')).toBeInTheDocument();
  });

  it('activar_sem_automacao_chama_createAutomation_com_os_valores_por_omissao_e_active_true', async () => {
    createAutomation.mockResolvedValue({ id: 'n1', trigger_type: 'booking_confirmed', trigger_days: null, channel: 'whatsapp', active: true });
    await montar();
    fireEvent.click(interruptor(T_WHATS));
    await waitFor(() => expect(createAutomation).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Boas-vindas WhatsApp', trigger_type: 'booking_confirmed', trigger_days: null, channel: 'whatsapp',
      subject: '', subject_pt: '', subject_en: '', active: true,
      message_pt: expect.stringContaining('Ola {nome_cliente}! Confirmamos'), message_en: expect.stringContaining('Hello {nome_cliente}!'),
    })));
    await waitFor(() => expect(esbatida(T_WHATS)).toBe(false));
    expect(screen.getByText('4 sequencia(s) activa(s)')).toBeInTheDocument();
    expect(screen.queryByText(/Confirmamos a sua reserva/)).not.toBeInTheDocument();
  });

  it('activar_e_desactivar_com_automacao_chama_toggleAutomation_com_o_estado_invertido', async () => {
    toggleAutomation.mockImplementation(async (id, active) => (id === 'a2' ? { ...A2, active } : { ...A1, active }));
    await montar();
    fireEvent.click(interruptor(T_D7));
    await waitFor(() => expect(toggleAutomation).toHaveBeenCalledWith('a2', true));
    await waitFor(() => expect(esbatida(T_D7)).toBe(false));
    fireEvent.click(interruptor(T_EMAIL));
    await waitFor(() => expect(toggleAutomation).toHaveBeenLastCalledWith('a1', false));
    await waitFor(() => expect(esbatida(T_EMAIL)).toBe(true));
  });

  it('falha_ao_alternar_deixa_o_estado_e_regista_console.error', async () => {
    toggleAutomation.mockRejectedValue(new Error('x'));
    await montar();
    fireEvent.click(interruptor(T_D7));
    await waitFor(() => expect(spyErr).toHaveBeenCalled());
    spyErr.mockClear();
    expect(esbatida(T_D7)).toBe(true);
    await waitFor(() => expect(interruptor(T_D7)).not.toBeDisabled());
  });

  it('editar_template_mostra_variaveis_assuntos_e_mensagens', async () => {
    await montar();
    abrir(T_EMAIL);
    fireEvent.click(botao('Editar template'));
    expect(screen.getByText('Variaveis — clique para inserir no corpo PT')).toBeInTheDocument();
    ['{nome_cliente}', '{nome_tour}', '{data}', '{hora}', '{guia}', '{ponto_encontro}'].forEach(v => {
      expect(screen.getByRole('button', { name: v })).toBeInTheDocument();
    });
    expect(campo('Assunto PT')).toHaveValue('Assunto PT guardado');
    expect(campo('Assunto EN')).toHaveValue('Subject EN saved');
    expect(campo('Mensagem PT', 'textarea')).toHaveValue('Mensagem guardada PT');
    expect(campo('Mensagem EN', 'textarea')).toHaveValue('Saved message EN');
    abrir(T_EMAIL);
    abrir(T_D1);
    fireEvent.click(botao('Editar template'));
    expect(screen.queryByText('Assunto PT')).not.toBeInTheDocument();
    expect(campo('Mensagem PT', 'textarea')).toBeInTheDocument();
  });

  it('clicar_numa_variavel_acrescenta_so_ao_corpo_PT', async () => {
    await montar();
    abrir(T_EMAIL);
    fireEvent.click(botao('Editar template'));
    fireEvent.click(botao('{data}'));
    expect(campo('Mensagem PT', 'textarea')).toHaveValue('Mensagem guardada PT{data}');
    expect(campo('Mensagem EN', 'textarea')).toHaveValue('Saved message EN');
  });

  it('guardar_sem_automacao_chama_createAutomation_com_campos_pt_en_e_active_true', async () => {
    listAutomations.mockResolvedValue([]);
    createAutomation.mockResolvedValue({ id: 'n1', trigger_type: 'booking_confirmed', trigger_days: null, channel: 'email', active: true, subject_pt: 'S PT', subject_en: 'Subject default', message_pt: 'M PT', message_en: 'M EN' });
    await montar();
    abrir(T_EMAIL);
    fireEvent.click(botao('Editar template'));
    fireEvent.change(campo('Assunto PT'), { target: { value: 'S PT' } });
    fireEvent.change(campo('Mensagem PT', 'textarea'), { target: { value: 'M PT' } });
    fireEvent.change(campo('Mensagem EN', 'textarea'), { target: { value: 'M EN' } });
    fireEvent.click(botao('Guardar template'));
    await waitFor(() => expect(createAutomation).toHaveBeenCalledWith({
      name: 'Confirmacao de reserva', trigger_type: 'booking_confirmed', trigger_days: null, channel: 'email',
      subject: 'S PT', subject_pt: 'S PT', subject_en: 'Your booking is confirmed — {nome_tour}',
      message_pt: 'M PT', message_en: 'M EN', active: true,
    }));
    expect(await screen.findByRole('button', { name: 'Editar template' })).toBeInTheDocument();
    expect(screen.getByText('S PT')).toBeInTheDocument();
    expect(screen.getByText('1 sequencia(s) activa(s)')).toBeInTheDocument();
  });

  it('guardar_com_automacao_chama_updateAutomation_com_o_id_e_active_mantido', async () => {
    updateAutomation.mockImplementation(async (id, dados) => ({ ...A2, ...dados }));
    await montar();
    abrir(T_D7);
    fireEvent.click(botao('Editar template'));
    expect(campo('Assunto PT')).toHaveValue('Assunto antigo');
    fireEvent.change(campo('Assunto EN'), { target: { value: 'New EN' } });
    fireEvent.click(botao('Guardar template'));
    await waitFor(() => expect(updateAutomation).toHaveBeenCalledWith('a2', {
      name: 'Lembrete 7 dias', trigger_type: 'days_before_checkin', trigger_days: 7, channel: 'email',
      subject: 'Assunto antigo', subject_pt: 'Assunto antigo', subject_en: 'New EN',
      message_pt: 'Corpo D7', message_en: expect.stringContaining('Hello {nome_cliente}'), active: false,
    }));
    expect(await screen.findByRole('button', { name: 'Editar template' })).toBeInTheDocument();
    expect(esbatida(T_D7)).toBe(true);
  });

  it('cancelar_fecha_a_edicao_sem_guardar_e_mantem_o_rascunho', async () => {
    await montar();
    abrir(T_EMAIL);
    fireEvent.click(botao('Editar template'));
    fireEvent.change(campo('Mensagem PT', 'textarea'), { target: { value: 'Rascunho' } });
    fireEvent.click(botao('Cancelar'));
    expect(updateAutomation).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Editar template' })).toBeInTheDocument();
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
  });
});

describe('Automacoes: pre-visualizacao', () => {
  it('preview_substitui_as_seis_variaveis_pelos_dados_de_exemplo_em_PT_e_EN', async () => {
    listAutomations.mockResolvedValue([]);
    const { container } = await montar();
    abrir(T_EMAIL);
    fireEvent.click(botao('Preview'));
    expect(screen.getByText('SalDesk Tours')).toBeInTheDocument();
    expect(screen.getByText('Assunto: A sua reserva foi confirmada — Kitesurf Lesson')).toBeInTheDocument();
    const corpo = container.querySelector('pre').textContent;
    expect(corpo).toContain('Ola Maria Santos,');
    expect(corpo).toContain('Kitesurf Lesson em 15 Jun 2025 as 09h00');
    expect(corpo).toContain('Ponto de encontro: Praia de Santa Maria, Sal');
    expect(corpo).toContain('Guia: Joao Silva');
    expect(corpo).not.toMatch(/\{[a-z_]+\}/);
    expect(screen.getByText('Preview com dados de exemplo. Variaveis substituidas no envio real.')).toBeInTheDocument();
    fireEvent.click(botao('EN'));
    expect(screen.getByText('Assunto: Your booking is confirmed — Kitesurf Lesson')).toBeInTheDocument();
    expect(container.querySelector('pre').textContent).toContain('Hello Maria Santos,');
    fireEvent.click(botao('Ocultar'));
    expect(container.querySelector('pre')).toBeNull();
  });

  it('preview_do_WhatsApp_nao_tem_assunto_e_mostra_a_hora', async () => {
    listAutomations.mockResolvedValue([]);
    const { container } = await montar();
    abrir(T_D1);
    fireEvent.click(botao('Preview'));
    expect(screen.getByText('WhatsApp Preview')).toBeInTheDocument();
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('Preview com dados de exemplo.')).toBeInTheDocument();
    expect(screen.queryByText(/^Assunto:/)).not.toBeInTheDocument();
    expect(container.querySelector('pre').textContent).toContain('Ola Maria Santos! Lembrete: o seu tour *Kitesurf Lesson* e amanha em 15 Jun 2025 as 09h00.');
  });

  it('na_edicao_Ver_preview_alterna_e_corpo_vazio_mostra_sem_conteudo', async () => {
    const { container } = await montar();
    abrir(T_EMAIL);
    fireEvent.click(botao('Editar template'));
    fireEvent.change(campo('Mensagem PT', 'textarea'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Ver preview').closest('button'));
    expect(container.querySelector('pre').textContent).toBe('(sem conteudo)');
    fireEvent.click(screen.getByText('Ocultar preview').closest('button'));
    expect(container.querySelector('pre')).toBeNull();
  });
});

describe('Automacoes: separadores', () => {
  it('o_separador_Historico_mostra_o_historico_e_voltar_as_sequencias', async () => {
    await montar();
    fireEvent.click(separador('Historico de envios'));
    expect(await screen.findByText('Sem historico de envios.')).toBeInTheDocument();
    expect(screen.queryByText(T_EMAIL)).not.toBeInTheDocument();
    fireEvent.click(separador('Sequencias'));
    expect(screen.getByText(T_EMAIL)).toBeInTheDocument();
  });
});

/* ───────────────────────── design system: estrutura e sequencias ───────────────────────── */

describe('Automacoes: design system (estrutura e sequencias)', () => {
  it('separadores_sao_Tabs', async () => {
    await montar();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sequencias' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Historico de envios' })).toHaveAttribute('aria-selected', 'false');
  });

  it('o_cabecalho_da_sequencia_tem_aria_expanded_abre_com_Enter_e_Espaco_e_o_interruptor_nao_o_alterna', async () => {
    await montar();
    const cab = cabecalho(T_EMAIL);
    expect(cab).toHaveAttribute('role', 'button');
    expect(cab).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(cab, { key: 'Enter' });
    expect(cab).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(cab, { key: ' ' });
    expect(cab).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(interruptor(T_EMAIL), { key: 'Enter' });
    expect(cab).toHaveAttribute('aria-expanded', 'false');
  });

  it('o_interruptor_tem_nome_com_o_titulo_e_aria_pressed', async () => {
    await montar();
    expect(screen.getByRole('button', { name: `Desactivar ${T_EMAIL}`, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Activar ${T_D7}`, pressed: false })).toBeInTheDocument();
  });

  it('os_botoes_PT_e_EN_da_pre_visualizacao_tem_aria_pressed', async () => {
    await montar();
    abrir(T_EMAIL);
    fireEvent.click(botao('Preview'));
    expect(screen.getByRole('button', { name: 'PT', pressed: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('button', { name: 'EN', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PT', pressed: false })).toBeInTheDocument();
  });

  it('os_campos_do_editor_tem_nome_acessivel', async () => {
    await montar();
    abrir(T_EMAIL);
    fireEvent.click(botao('Editar template'));
    ['Assunto PT', 'Assunto EN', 'Mensagem PT', 'Mensagem EN'].forEach(e => expect(screen.getByLabelText(e)).toBeInTheDocument());
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error_com_todas_as_sequencias_em_leitura_edicao_e_preview', async () => {
    const { container } = await montar();
    let html = container.innerHTML;
    abrir(T_EMAIL);
    html += container.innerHTML;
    fireEvent.click(botao('Editar template'));
    fireEvent.click(screen.getByText('Ver preview').closest('button'));
    html += container.innerHTML;
    abrir(T_EMAIL);
    abrir(T_D1);
    fireEvent.click(botao('Preview'));
    html += container.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  });
});
