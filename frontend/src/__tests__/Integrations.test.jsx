import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Integrations from '../pages/Integrations';
import { getStatus, connectChannel, disconnectChannel, syncManual, getLogs } from '../services/integrationsService';

vi.mock('../services/integrationsService', () => ({
  getStatus: vi.fn(), connectChannel: vi.fn(), disconnectChannel: vi.fn(), syncManual: vi.fn(), getLogs: vi.fn(),
}));

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;
const norm = (t) => t.replace(/\s/g, ' ');
const fmt = (d) => norm(new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }));

const VIATOR = { channel: 'viator', is_active: true, configured: true, supplier_id: 'SUP-1', last_sync_at: '2026-11-05T10:30:00Z', sync_error: 'Token expirado' };
const GYG = { channel: 'getyourguide', is_active: false, configured: false };
const LOGS = {
  data: [
    { id: 'g1', created_at: '2026-11-05T10:30:00Z', channel: 'viator', event_type: 'booking.created', status: 'processed', external_ref: 'BR-1', error_message: null },
    { id: 'g2', created_at: '2026-11-05T11:30:00Z', channel: 'getyourguide', event_type: 'booking.updated', status: 'received' },
    { id: 'g3', created_at: '2026-11-05T12:30:00Z', channel: 'viator', event_type: 'booking.cancelled', status: 'failed', error_message: 'Falhou X' },
    { id: 'g4', created_at: '2026-11-05T13:30:00Z', channel: 'viator', event_type: 'ping', status: 'weird' },
  ],
  total: 37,
};

let spyErr; let spyWarn; let spyConfirm;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  spyConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  getStatus.mockReset().mockResolvedValue([VIATOR, GYG]);
  getLogs.mockReset().mockResolvedValue(LOGS);
  [connectChannel, disconnectChannel, syncManual].forEach(f => f.mockReset().mockResolvedValue({}));
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
  const r = render(<Integrations />);
  await screen.findByText('Viator', { selector: 'p' });
  return r;
}
/* o primeiro ascendente do nome que contem botoes: o cartao do canal */
const cartao = (nome) => {
  let e = screen.getByText(nome, { selector: 'p' });
  while (e && !e.querySelector('button')) e = e.parentElement;
  return e;
};
const dialogo = () => screen.getByRole('dialog');
const campo = (etiqueta) => within(dialogo()).getByText(etiqueta).parentElement.querySelector('input');
const celulas = (tr) => [...tr.querySelectorAll('td')].map(td => td.textContent);

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Channel Manager: cartoes dos canais', () => {
  it('carrega_estado_e_logs_20_e_mostra_o_cabecalho', async () => {
    await montar();
    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(getLogs).toHaveBeenCalledWith({ limit: 20 });
    expect(screen.getByText('Integracoes')).toBeInTheDocument();
    expect(screen.getByText('Channel Manager — Viator e GetYourGuide')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
  });

  it('em_carga_mostra_o_spinner_e_nao_os_cartoes', () => {
    getStatus.mockReturnValue(new Promise(() => {}));
    getLogs.mockReturnValue(new Promise(() => {}));
    const { container } = render(<Integrations />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Viator', { selector: 'p' })).not.toBeInTheDocument();
    expect(screen.queryByText('Logs de integracao')).not.toBeInTheDocument();
  });

  it('canal_ligado_mostra_Ligado_supplier_ultimo_sync_e_erro_de_sync', async () => {
    await montar();
    const c = cartao('Viator');
    expect(c).toHaveTextContent('Plataforma de experiencias da TripAdvisor');
    expect(c).toHaveTextContent('Ligado');
    expect(c).not.toHaveTextContent('Desligado');
    expect(c).toHaveTextContent('Supplier ID: SUP-1');
    expect(norm(c.textContent)).toContain(`Ultimo sync: ${fmt('2026-11-05T10:30:00Z')}`);
    expect(c).toHaveTextContent('Token expirado');
    expect(within(c).getByRole('button', { name: 'Sincronizar' })).toBeInTheDocument();
    expect(within(c).getByRole('button', { name: 'Desligar' })).toBeInTheDocument();
    expect(within(c).queryByRole('button', { name: 'Configurar' })).not.toBeInTheDocument();
    expect(c.closest('.opacity-80')).toBeNull();
  });

  it('canal_desligado_ou_nao_configurado_mostra_Desligado_Configurar_e_fica_esbatido', async () => {
    getStatus.mockResolvedValue([{ ...VIATOR, configured: false }, GYG]);
    await montar();
    for (const nome of ['Viator', 'GetYourGuide']) {
      const c = cartao(nome);
      expect(c).toHaveTextContent('Desligado');
      expect(c).not.toHaveTextContent('Ultimo sync');
      expect(within(c).getByRole('button', { name: 'Configurar' })).toBeInTheDocument();
      expect(c.closest('.opacity-80')).not.toBeNull();
    }
  });

  it('ultimo_sync_em_falta_mostra_travessao', async () => {
    getStatus.mockResolvedValue([{ ...VIATOR, last_sync_at: null, sync_error: null, supplier_id: null }, GYG]);
    await montar();
    expect(cartao('Viator')).toHaveTextContent('Ultimo sync: —');
    expect(cartao('Viator')).not.toHaveTextContent('Supplier ID');
  });

  it('getStatus_a_falhar_deixa_a_pagina_sem_canais_e_regista_console.error', async () => {
    getStatus.mockRejectedValue(new Error('x'));
    render(<Integrations />);
    expect(await screen.findByText('Logs de integracao')).toBeInTheDocument();
    expect(screen.queryByText('Viator', { selector: 'p' })).not.toBeInTheDocument();
    expect(screen.getByText('0 evento(s)')).toBeInTheDocument();
    expect(spyErr).toHaveBeenCalled();
    spyErr.mockClear();
  });

  it('actualizar_recarrega', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Viator', { selector: 'p' })).toBeInTheDocument();
  });

  it('sincronizar_chama_syncManual_e_recarrega_apos_2s', async () => {
    let resolver;
    syncManual.mockReturnValue(new Promise(r => { resolver = r; }));
    await montar();
    vi.useFakeTimers();
    try {
      fireEvent.click(within(cartao('Viator')).getByRole('button', { name: 'Sincronizar' }));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(syncManual).toHaveBeenCalledWith('viator');
      expect(within(cartao('Viator')).getByRole('button', { name: /Sincronizar/ })).toBeDisabled();
      await act(async () => { resolver({}); await vi.advanceTimersByTimeAsync(1999); });
      expect(getStatus).toHaveBeenCalledTimes(1);
      expect(within(cartao('Viator')).getByRole('button', { name: /Sincronizar/ })).not.toBeDisabled();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(getStatus).toHaveBeenCalledTimes(2);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    } finally { vi.useRealTimers(); }
  });

  it('desligar_chama_disconnectChannel_sem_confirmacao_e_recarrega', async () => {
    await montar();
    fireEvent.click(within(cartao('Viator')).getByRole('button', { name: 'Desligar' }));
    await waitFor(() => expect(disconnectChannel).toHaveBeenCalledWith('viator'));
    await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(2));
    expect(spyConfirm).not.toHaveBeenCalled();
    expect(await screen.findByText('Viator', { selector: 'p' })).toBeInTheDocument();
  });
});

describe('Channel Manager: ligar um canal', () => {
  it('configurar_abre_o_modal_do_canal_com_os_campos_certos_e_vazios_de_cada_vez', async () => {
    await montar();
    fireEvent.click(within(cartao('GetYourGuide')).getByRole('button', { name: 'Configurar' }));
    expect(within(dialogo()).getByText('Configurar GetYourGuide')).toBeInTheDocument();
    expect(within(dialogo()).getByText('Plataforma global de actividades e tours')).toBeInTheDocument();
    expect(campo('API Key')).toHaveAttribute('type', 'password');
    expect(campo('Product IDs (separados por virgula)')).toHaveAttribute('type', 'text');
    expect(within(dialogo()).queryByText('Supplier ID')).not.toBeInTheDocument();
    fireEvent.change(campo('API Key'), { target: { value: 'k1' } });
    fireEvent.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(within(cartao('GetYourGuide')).getByRole('button', { name: 'Configurar' }));
    expect(campo('API Key')).toHaveValue('');
  });

  it('viator_pede_API_Key_e_Supplier_ID_obrigatorios', async () => {
    getStatus.mockResolvedValue([{ channel: 'viator', is_active: false }, GYG]);
    await montar();
    fireEvent.click(within(cartao('Viator')).getByRole('button', { name: 'Configurar' }));
    /* o ui/Input so usa required para o asterisco da etiqueta: o campo nao leva o atributo (comportamento existente) */
    expect(within(dialogo()).getByText('API Key').textContent).toBe('API Key*');
    expect(within(dialogo()).getByText('Supplier ID').textContent).toBe('Supplier ID*');
    expect(campo('API Key')).not.toBeRequired();
  });

  it('ligar_envia_os_campos_e_product_ids_como_lista_sem_vazios_e_fecha_e_recarrega', async () => {
    await montar();
    fireEvent.click(within(cartao('GetYourGuide')).getByRole('button', { name: 'Configurar' }));
    fireEvent.change(campo('API Key'), { target: { value: 'k1' } });
    fireEvent.change(campo('Product IDs (separados por virgula)'), { target: { value: 'p1, p2,, p3 ' } });
    fireEvent.submit(dialogo().querySelector('form'));
    await waitFor(() => expect(connectChannel).toHaveBeenCalledWith('getyourguide', { api_key: 'k1', product_ids: ['p1', 'p2', 'p3'] }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(2));
    cleanup();
    connectChannel.mockClear();
    getStatus.mockResolvedValue([{ channel: 'viator', is_active: false }, GYG]);
    await montar();
    fireEvent.click(within(cartao('Viator')).getByRole('button', { name: 'Configurar' }));
    fireEvent.change(campo('API Key'), { target: { value: 'kv' } });
    fireEvent.change(campo('Supplier ID'), { target: { value: 'S9' } });
    fireEvent.submit(dialogo().querySelector('form'));
    await waitFor(() => expect(connectChannel).toHaveBeenCalledWith('viator', { api_key: 'kv', supplier_id: 'S9' }));
  });

  it('ligar_com_erro_mostra_a_mensagem_do_servidor_ou_errors.generic_e_o_modal_fica_aberto', async () => {
    await montar();
    fireEvent.click(within(cartao('GetYourGuide')).getByRole('button', { name: 'Configurar' }));
    connectChannel.mockRejectedValueOnce({ response: { data: { error: 'Chave invalida' } } });
    fireEvent.submit(dialogo().querySelector('form'));
    expect(await screen.findByText('Chave invalida')).toBeInTheDocument();
    connectChannel.mockRejectedValueOnce(new Error('x'));
    fireEvent.submit(dialogo().querySelector('form'));
    expect(await screen.findByText('Ocorreu um erro. Tente novamente.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('Channel Manager: webhooks e logs', () => {
  it('webhooks_mostram_os_dois_urls_com_a_origem_com_5173_trocada_por_3001', async () => {
    await montar();
    expect(screen.getByText('URLs de webhook para configurar nas plataformas:')).toBeInTheDocument();
    const origem = window.location.origin.replace('5173', '3001');
    expect(screen.getByText(`${origem}/api/v1/integrations/webhooks/viator`)).toBeInTheDocument();
    expect(screen.getByText(`${origem}/api/v1/integrations/webhooks/getyourguide`)).toBeInTheDocument();
  });

  it('tabela_de_logs_com_data_canal_evento_estado_ref_e_erro_e_contagem', async () => {
    await montar();
    expect(screen.getByText('37 evento(s)')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Data', 'Canal', 'Evento', 'Estado', 'Ref. OTA', 'Erro']);
    const linhas = screen.getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(4);
    expect(celulas(linhas[0]).map(norm)).toEqual([fmt('2026-11-05T10:30:00Z'), 'viator', 'booking.created', 'processed', 'BR-1', '—']);
    expect(celulas(linhas[1]).slice(1)).toEqual(['getyourguide', 'booking.updated', 'received', '—', '—']);
    expect(celulas(linhas[2]).slice(3)).toEqual(['failed', '—', 'Falhou X']);
    expect(celulas(linhas[3]).slice(3, 4)).toEqual(['weird']);
  });

  it('logs_sem_dados_ou_total_mostram_zero', async () => {
    getLogs.mockResolvedValue({});
    await montar();
    expect(screen.getByText('0 evento(s)')).toBeInTheDocument();
  });
});

/* ───────────────────────── design system ───────────────────────── */

describe('Channel Manager: design system', () => {
  it('o_cartao_do_canal_e_Card_e_o_avatar_usa_tokens', async () => {
    await montar();
    expect(cartao('Viator').closest('[class*="app:rounded-sm"]')).not.toBeNull();
    expect(cartao('GetYourGuide').closest('[class*="app:rounded-sm"]')).not.toBeNull();
    expect(screen.getByText('V').className).toContain('bg-ocean-700');
    expect(screen.getByText('G').className).toContain('bg-sand-600');
  });

  it('desligar_usa_o_token_de_erro_no_hover', async () => {
    await montar();
    const b = screen.getByRole('button', { name: 'Desligar' });
    expect(b.className).toContain('hover:text-[var(--error)]');
    expect(b.className).not.toContain('hover:text-error');
  });

  it('os_campos_do_modal_tem_nome_acessivel', async () => {
    getStatus.mockResolvedValue([{ channel: 'viator', is_active: false }, GYG]);
    await montar();
    fireEvent.click(within(cartao('Viator')).getByRole('button', { name: 'Configurar' }));
    expect(within(dialogo()).getByLabelText('API Key')).toBeInTheDocument();
    expect(within(dialogo()).getByLabelText('Supplier ID')).toBeInTheDocument();
    fireEvent.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(within(cartao('GetYourGuide')).getByRole('button', { name: 'Configurar' }));
    expect(within(dialogo()).getByLabelText('Product IDs (separados por virgula)')).toBeInTheDocument();
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error_com_os_dois_canais_e_o_modal_com_erro', async () => {
    await montar();
    let html = document.body.innerHTML;
    fireEvent.click(within(cartao('GetYourGuide')).getByRole('button', { name: 'Configurar' }));
    connectChannel.mockRejectedValueOnce(new Error('x'));
    fireEvent.submit(dialogo().querySelector('form'));
    await screen.findByText('Ocorreu um erro. Tente novamente.');
    html += document.body.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  });
});
