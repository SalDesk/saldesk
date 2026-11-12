import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Marketing from '../pages/Marketing';
import useAuthStore from '../store/authStore';
import { getBookingLink, getMarketingStats, getWidgetCode, getQrCode, getReferrals } from '../services/marketingService';
import { listUnits } from '../services/unitsService';

vi.mock('../services/marketingService', () => ({
  getBookingLink: vi.fn(), getMarketingStats: vi.fn(), getWidgetCode: vi.fn(), getQrCode: vi.fn(), getReferrals: vi.fn(),
}));
vi.mock('../services/unitsService', () => ({ listUnits: vi.fn() }));

const norm = (t) => t.replace(/\s/g, ' ');
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const STORAGE_KEY = 'saldesk_social_posts_v1';

const UNIDADES = [{ id: 'u1', name: 'Buggy Tour' }, { id: 'u2', name: 'Kite Aula' }];
const WIDGET_SERVIDOR = '<!-- SalDesk Widget — Sal Aventura -->\n<iframe id="saldesk-widget-demo" src="https://app.saldesk.cv/book/demo?widget=1" width="100%" height="500" frameborder="0" title="Reservar em Sal Aventura"></iframe>';
const STATS = { profile_views: 120, clicks: 45, bookings_direct: 9, conversion_rate: 20, sources: { direct: 5, booking_com: 3, viator: 1, outro: 2 } };
const INDICACOES = {
  referral_link: 'https://saldesk.cv/operadores.html?ref=demo', total: 3, convertidos: 1,
  referred: [
    { id: 'r1', nome_negocio: 'Hotel A', created_at: '2026-11-01T12:00:00Z', status: 'convertido' },
    { id: 'r2', nome: 'Rent B', status: 'contactado' },
    { id: 'r3', nome_negocio: 'Cafe C', status: 'xyz' },
  ],
};

let spyErr; let spyWarn; let writeText; let origCreate; let origRevoke;
beforeEach(() => {
  localStorage.clear();
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  origCreate = URL.createObjectURL; origRevoke = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:qr');
  URL.revokeObjectURL = vi.fn();
  writeText = vi.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  useAuthStore.setState({ token: 'tok', operator: { id: 'op1', slug: 'demo', name: 'Sal Aventura' } });
  getBookingLink.mockReset().mockResolvedValue({ url: 'https://saldesk.cv/book/demo' });
  getMarketingStats.mockReset().mockResolvedValue(STATS);
  getWidgetCode.mockReset().mockResolvedValue({ html: WIDGET_SERVIDOR });
  getQrCode.mockReset().mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
  getReferrals.mockReset().mockResolvedValue(INDICACOES);
  listUnits.mockReset().mockResolvedValue(UNIDADES);
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
  URL.createObjectURL = origCreate; URL.revokeObjectURL = origRevoke;
  useAuthStore.setState({ token: null, operator: null });
  localStorage.clear();
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

/* aguarda que a pagina assente: o QR gerado (ou, sem QR, o pedido feito) */
async function montar({ semQr = false } = {}) {
  const r = render(<Marketing />);
  await screen.findByText('Marketing');
  if (semQr) {
    await waitFor(() => expect(getQrCode).toHaveBeenCalled());
    await act(async () => {});
  } else {
    await screen.findByAltText('QR Code');
  }
  return r;
}
const separador = (rotulo) => screen.getAllByText(rotulo).find(e => e.closest('button')).closest('button');
const abrir = async (rotulo, ancora) => { fireEvent.click(separador(rotulo)); await screen.findByText(ancora); };
const campo = (etiqueta, tag = 'input') => screen.getByText(etiqueta).parentElement.querySelector(tag);
const amostras = (container) => [...container.querySelectorAll('button[style]')];
const valorKpi = (rotulo) => screen.getByText(rotulo).previousSibling.textContent;
const ultimaChamadaQr = () => getQrCode.mock.calls[getQrCode.mock.calls.length - 1][0];

/* ───────────────────────── caracterizacao: pagina ───────────────────────── */

describe('Marketing: montagem', () => {
  it('pede_ao_montar_ligacao_codigo_estatisticas_unidades_e_indicacoes', async () => {
    await montar();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('Ferramentas de divulgacao e planeador de conteudos')).toBeInTheDocument();
    expect(getBookingLink).toHaveBeenCalledTimes(1);
    expect(getWidgetCode).toHaveBeenCalledTimes(1);
    expect(getMarketingStats).toHaveBeenCalledTimes(1);
    expect(listUnits).toHaveBeenCalledTimes(1);
    expect(getReferrals).toHaveBeenCalledTimes(1);
    expect(getQrCode).toHaveBeenCalledTimes(1);
  });

  it('abre_no_separador_QR_Code_e_o_planeador_nao_tem_separador', async () => {
    await montar();
    expect(screen.getByText('QR Code para')).toBeInTheDocument();
    const rotulos = ['QR Code', 'Widget', 'Indicacoes', 'Estatisticas'];
    rotulos.forEach(r => expect(separador(r)).toBeInTheDocument());
    expect(screen.queryByText('Planeador')).not.toBeInTheDocument();
    expect(screen.queryByText('Planeador de Social Media')).not.toBeInTheDocument();
  });

  it('getBookingLink_getMarketingStats_e_getReferrals_a_falhar_dao_os_valores_por_omissao', async () => {
    getBookingLink.mockRejectedValue(new Error('x'));
    getMarketingStats.mockRejectedValue(new Error('x'));
    getReferrals.mockRejectedValue(new Error('x'));
    await montar();
    await abrir('Estatisticas', 'Visitas ao perfil');
    expect(valorKpi('Visitas ao perfil')).toBe('0');
    expect(valorKpi('Taxa de conversao')).toBe('0%');
    expect(screen.getByText('https://saldesk.cv/book/demo')).toBeInTheDocument();
    await abrir('Indicacoes', 'O seu link de indicacao');
    expect(screen.getByText('https://saldesk.cv/operadores.html?ref=demo')).toBeInTheDocument();
    expect(valorKpi('Indicacoes enviadas')).toBe('0');
    expect(screen.getByText('Ainda nao indicou nenhum operador.')).toBeInTheDocument();
  });

  it('sem_slug_as_ligacoes_por_omissao_ficam_vazias', async () => {
    useAuthStore.setState({ operator: { id: 'op1', name: 'Sem Slug' } });
    getBookingLink.mockRejectedValue(new Error('x'));
    getReferrals.mockRejectedValue(new Error('x'));
    await montar();
    await abrir('Estatisticas', 'Visitas ao perfil');
    expect(screen.queryByText('Link de reserva directa')).not.toBeInTheDocument();
    await abrir('Indicacoes', 'O seu link de indicacao');
    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('getWidgetCode_e_listUnits_a_falhar_nao_rebentam', async () => {
    getWidgetCode.mockRejectedValue(new Error('x'));
    listUnits.mockRejectedValue(new Error('x'));
    await montar();
    expect([...campo('QR Code para', 'select').options].map(o => o.textContent)).toEqual(['Perfil publico — link de reserva']);
    await abrir('Widget', 'Codigo HTML');
    expect(document.querySelector('pre')).toBeNull();
    expect(screen.getByText('Nao foi possivel gerar o codigo do widget. Recarrega a pagina e tenta de novo.')).toBeInTheDocument();
  });

  it('listUnits_nulo_nao_rebenta', async () => {
    listUnits.mockResolvedValue(null);
    await montar();
    expect(campo('QR Code para', 'select').options).toHaveLength(1);
  });
});

/* ───────────────────────── caracterizacao: Codigo QR ───────────────────────── */

describe('Marketing: Codigo QR', () => {
  it('gera_ao_montar_com_size_300_e_color_sem_cardinal_e_mostra_o_endereco', async () => {
    await montar();
    expect(getQrCode).toHaveBeenCalledWith({ size: '300', color: '0D5470' });
    expect(screen.getByAltText('QR Code')).toHaveAttribute('src', 'blob:qr');
    expect(screen.getByText('saldesk.cv/book/demo')).toBeInTheDocument();
    expect(screen.getByText('Tamanho — 300px')).toBeInTheDocument();
    expect([...campo('QR Code para', 'select').options].map(o => o.textContent)).toEqual(['Perfil publico — link de reserva', 'Buggy Tour', 'Kite Aula']);
  });

  it('mudar_a_unidade_regenera_com_unit_id_e_o_endereco_acompanha', async () => {
    await montar();
    fireEvent.change(campo('QR Code para', 'select'), { target: { value: 'u1' } });
    await waitFor(() => expect(getQrCode).toHaveBeenCalledTimes(2));
    expect(ultimaChamadaQr()).toEqual({ size: '300', color: '0D5470', unit_id: 'u1' });
    expect(await screen.findByText('saldesk.cv/book/demo/servico/u1')).toBeInTheDocument();
    fireEvent.change(campo('QR Code para', 'select'), { target: { value: '' } });
    await waitFor(() => expect(getQrCode).toHaveBeenCalledTimes(3));
    expect(ultimaChamadaQr()).toEqual({ size: '300', color: '0D5470' });
  });

  it('mudar_cor_ou_tamanho_so_regenera_com_Gerar_preview_e_o_texto_da_cor_acompanha', async () => {
    const { container } = await montar();
    expect(screen.getByText('#0D5470')).toBeInTheDocument();
    fireEvent.click(amostras(container)[1]);
    expect(screen.getByText('#062A38')).toBeInTheDocument();
    fireEvent.change(container.querySelector('input[type="range"]'), { target: { value: '400' } });
    expect(screen.getByText('Tamanho — 400px')).toBeInTheDocument();
    expect(getQrCode).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Gerar preview' }));
    await waitFor(() => expect(getQrCode).toHaveBeenCalledTimes(2));
    expect(ultimaChamadaQr()).toEqual({ size: '400', color: '062A38' });
  });

  it('o_seletor_de_cor_actualiza_a_cor_e_o_pedido', async () => {
    const { container } = await montar();
    fireEvent.change(container.querySelector('input[type="color"]'), { target: { value: '#112233' } });
    expect(screen.getByText('#112233')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar preview' }));
    await waitFor(() => expect(getQrCode).toHaveBeenCalledTimes(2));
    expect(ultimaChamadaQr().color).toBe('112233');
  });

  it('o_preview_mostra_o_spinner_a_imagem_ou_o_icone', async () => {
    getQrCode.mockReturnValue(new Promise(() => {}));
    const { container } = await montar({ semQr: true });
    expect(container.querySelector('svg.animate-spin[width="32"]')).toBeInTheDocument();
    expect(screen.queryByAltText('QR Code')).not.toBeInTheDocument();
    cleanup();
    getQrCode.mockReset().mockRejectedValue(new Error('x'));
    const r2 = await montar({ semQr: true });
    expect(r2.container.querySelector('svg.animate-spin[width="32"]')).not.toBeInTheDocument();
    expect(screen.queryByAltText('QR Code')).not.toBeInTheDocument();
    expect(r2.container.querySelector('svg.text-n-200')).toBeInTheDocument();
  });

  it('PNG_descarrega_qrcode_unidade_slug_ou_saldesk_png', async () => {
    const cliques = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { cliques.push({ href: this.href, download: this.download }); });
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'PNG' }));
    expect(cliques).toEqual([{ href: 'blob:qr', download: 'qrcode-demo.png' }]);
    fireEvent.change(campo('QR Code para', 'select'), { target: { value: 'u2' } });
    await screen.findByText('saldesk.cv/book/demo/servico/u2');
    await screen.findByAltText('QR Code');
    fireEvent.click(screen.getByRole('button', { name: 'PNG' }));
    expect(cliques[1].download).toBe('qrcode-u2.png');
    cleanup();
    useAuthStore.setState({ operator: { id: 'op1' } });
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'PNG' }));
    expect(cliques[2].download).toBe('qrcode-saldesk.png');
  });

  it('SVG_embrulha_o_PNG_num_svg_com_o_tamanho_numerico', async () => {
    const cliques = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { cliques.push({ href: this.href, download: this.download }); });
    const drawImage = vi.fn();
    const proto = HTMLCanvasElement.prototype;
    const origCtx = proto.getContext; const origUrl = proto.toDataURL;
    proto.getContext = vi.fn(() => ({ drawImage }));
    proto.toDataURL = vi.fn(() => 'data:image/png;base64,AAA');
    const origImage = window.Image;
    class FakeImage { set src(v) { this._src = v; queueMicrotask(() => this.onload && this.onload()); } get src() { return this._src; } }
    window.Image = FakeImage;
    let blobSvg = null;
    URL.createObjectURL = vi.fn((b) => { if (b.type === 'image/svg+xml') blobSvg = b; return 'blob:x'; });
    try {
      await montar();
      fireEvent.change(document.querySelector('input[type="range"]'), { target: { value: '400' } });
      fireEvent.click(screen.getByRole('button', { name: 'SVG' }));
      await waitFor(() => expect(cliques.length).toBe(1));
      expect(cliques[0].download).toBe('qrcode-demo.svg');
      expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 400, 400);
      const texto = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsText(blobSvg); });
      expect(texto).toBe('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="400" height="400"><image width="400" height="400" xlink:href="data:image/png;base64,AAA"/></svg>');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    } finally {
      proto.getContext = origCtx; proto.toDataURL = origUrl; window.Image = origImage;
    }
  });

  it('descargas_desactivadas_sem_preview_ou_a_carregar', async () => {
    getQrCode.mockRejectedValue(new Error('x'));
    await montar({ semQr: true });
    expect(screen.getByRole('button', { name: 'PNG' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'SVG' })).toBeDisabled();
    cleanup();
    getQrCode.mockReset().mockReturnValue(new Promise(() => {}));
    await montar({ semQr: true });
    expect(screen.getByRole('button', { name: 'PNG' })).toBeDisabled();
  });
});

/* ───────────────────────── caracterizacao: Widget ───────────────────────── */

describe('Marketing: Widget', () => {
  it('o_codigo_do_servidor_aparece_tal_como_vem_sem_seletor_de_cor', async () => {
    await montar();
    await abrir('Widget', 'Codigo HTML');
    expect(document.querySelector('pre').textContent).toBe(WIDGET_SERVIDOR);
    /* a cor nunca fez nada no codigo real (nao tem data-color): o seletor foi retirado */
    expect(screen.queryByText('Cor primaria')).toBeNull();
    expect(screen.queryByLabelText('Cor personalizada')).toBeNull();
  });

  it('sem_codigo_do_servidor_mostra_o_aviso_e_nao_oferece_copiar_nem_um_script_inexistente', async () => {
    getWidgetCode.mockResolvedValue('');
    await montar();
    await abrir('Widget', 'Codigo HTML');
    expect(document.querySelector('pre')).toBeNull();
    expect(screen.getByText('Nao foi possivel gerar o codigo do widget. Recarrega a pagina e tenta de novo.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar' })).toBeNull();
    expect(document.body.textContent).not.toContain('widget.js');
  });

  it('alternar_Codigo_Preview_mostra_o_widget_real_num_iframe_da_pagina_publica', async () => {
    await montar();
    await abrir('Widget', 'Codigo HTML');
    expect(document.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(document.querySelector('pre')).toBeNull();
    const quadro = screen.getByTitle('Pre-visualizacao do widget');
    expect(quadro.tagName).toBe('IFRAME');
    /* preview=1: abrir o preview nao conta como visita nas Estatisticas */
    expect(quadro.getAttribute('src')).toBe('/book/demo?widget=1&preview=1');
    fireEvent.click(screen.getByRole('button', { name: 'Codigo' }));
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('pre')).not.toBeNull();
  });

  it('o_iframe_do_preview_ajusta_a_altura_a_mensagem_do_widget_e_ignora_outras_origens', async () => {
    await montar();
    await abrir('Widget', 'Codigo HTML');
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    const quadro = screen.getByTitle('Pre-visualizacao do widget');
    const mensagem = (data, source) => act(() => { window.dispatchEvent(new MessageEvent('message', { data, source })); });
    mensagem({ type: 'saldesk-widget-resize', height: 812 }, quadro.contentWindow);
    expect(quadro.style.height).toBe('812px');
    mensagem({ type: 'saldesk-widget-resize', height: 1500 }, window);
    mensagem({ type: 'outra-coisa', height: 2000 }, quadro.contentWindow);
    expect(quadro.style.height).toBe('812px');
  });

  it('copiar_chama_clipboard_com_o_codigo_do_servidor_e_mostra_Copiado_2s', async () => {
    await montar();
    await abrir('Widget', 'Codigo HTML');
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(writeText).toHaveBeenCalledWith(WIDGET_SERVIDOR);
    expect(screen.getByRole('button', { name: 'Copiado' })).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
    expect(screen.getByRole('button', { name: 'Copiado' })).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    expect(screen.getByText('Cole este codigo no HTML do seu website onde quer que o formulario apareca.')).toBeInTheDocument();
  });

  it('avisa_que_o_pagamento_SISP_abre_em_ecra_inteiro_fora_do_site_do_operador', async () => {
    await montar();
    await abrir('Widget', 'Codigo HTML');
    expect(screen.getByText(/pagamento com cartao cabo-verdiano \(SISP\) abre em ecra inteiro/i)).toBeInTheDocument();
  });
});

/* ───────────────────────── caracterizacao: Indicacoes ───────────────────────── */

describe('Marketing: Indicacoes', () => {
  it('mostra_ligacao_contadores_e_lista_com_negocio_data_e_estado', async () => {
    await montar();
    await abrir('Indicacoes', 'O seu link de indicacao');
    expect(screen.getByText('Indique outro operador')).toBeInTheDocument();
    expect(screen.getByText('https://saldesk.cv/operadores.html?ref=demo')).toBeInTheDocument();
    expect(valorKpi('Indicacoes enviadas')).toBe('3');
    expect(valorKpi('Convertidas')).toBe('1');
    expect(screen.getByText('As suas indicacoes (3)')).toBeInTheDocument();
    const linhas = screen.getAllByRole('row').slice(1).map(r => [...r.querySelectorAll('td')].map(td => td.textContent));
    expect(linhas[0]).toEqual(['Hotel A', new Date('2026-11-01T12:00:00Z').toLocaleDateString('pt-PT'), 'Convertido']);
    expect(linhas[1]).toEqual(['Rent B', '—', 'Contactado']);
    expect(linhas[2]).toEqual(['Cafe C', '—', 'xyz']);
  });

  it('sem_indicacoes_mostra_o_vazio_e_contadores_a_zero', async () => {
    getReferrals.mockResolvedValue({ referral_link: 'x', referred: [] });
    await montar();
    await abrir('Indicacoes', 'O seu link de indicacao');
    expect(screen.getByText('As suas indicacoes (0)')).toBeInTheDocument();
    expect(screen.getByText('Ainda nao indicou nenhum operador.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(valorKpi('Indicacoes enviadas')).toBe('0');
    expect(valorKpi('Convertidas')).toBe('0');
  });

  it('em_carga_os_contadores_pulsam', async () => {
    getReferrals.mockReturnValue(new Promise(() => {}));
    const { container } = await montar();
    await abrir('Indicacoes', 'O seu link de indicacao');
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(2);
  });

  it('copiar_a_ligacao_chama_clipboard', async () => {
    await montar();
    await abrir('Indicacoes', 'O seu link de indicacao');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(writeText).toHaveBeenCalledWith('https://saldesk.cv/operadores.html?ref=demo');
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });
});

/* ───────────────────────── caracterizacao: Estatisticas ───────────────────────── */

function postsDoMes(extra = []) {
  const d = new Date();
  const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return [
    { id: 'a', scheduled_at: `${mes}-10T10:00`, status: 'agendado', text_pt: 'A' },
    { id: 'b', scheduled_at: `${mes}-12T10:00`, status: 'agendado', text_pt: 'B' },
    { id: 'c', scheduled_at: `${mes}-14T10:00`, status: 'publicado', text_pt: 'C' },
    { id: 'd', scheduled_at: `${d.getFullYear() - 1}-01-05T10:00`, status: 'publicado', text_pt: 'D' },
    ...extra,
  ];
}

describe('Marketing: Estatisticas', () => {
  it('kpis_com_valores_e_com_zero_por_omissao', async () => {
    await montar();
    await abrir('Estatisticas', 'Visitas ao perfil');
    expect(valorKpi('Visitas ao perfil')).toBe('120');
    expect(valorKpi('Cliques no link')).toBe('45');
    expect(valorKpi('Reservas via link')).toBe('9');
    expect(valorKpi('Taxa de conversao')).toBe('20%');
    expect(screen.getAllByText('ultimos 30 dias')).toHaveLength(3);
    expect(screen.getByText('cliques → reservas')).toBeInTheDocument();
    cleanup();
    getMarketingStats.mockResolvedValue({});
    await montar();
    await abrir('Estatisticas', 'Visitas ao perfil');
    expect(valorKpi('Visitas ao perfil')).toBe('0');
    expect(valorKpi('Taxa de conversao')).toBe('0%');
  });

  it('em_carga_os_cartoes_pulsam', async () => {
    getMarketingStats.mockReturnValue(new Promise(() => {}));
    const { container } = await montar();
    await abrir('Estatisticas', 'Visitas ao perfil');
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4);
  });

  it('posts_do_mes_lidos_do_localStorage_e_cancelados_so_se_maior_que_zero', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(postsDoMes()));
    await montar();
    await abrir('Estatisticas', 'Visitas ao perfil');
    expect(screen.getByText(`Posts — ${MONTHS_PT[new Date().getMonth()]}`)).toBeInTheDocument();
    expect(valorKpi('Total')).toBe('3');
    expect(valorKpi('Publicados')).toBe('1');
    expect(valorKpi('Agendados')).toBe('2');
    expect(screen.queryByText('Cancelados')).not.toBeInTheDocument();
    cleanup();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(postsDoMes([{ id: 'e', scheduled_at: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-20T10:00`, status: 'cancelado', text_pt: 'E' }])));
    await montar();
    await abrir('Estatisticas', 'Visitas ao perfil');
    expect(valorKpi('Cancelados')).toBe('1');
    expect(valorKpi('Total')).toBe('4');
  });

  it('localStorage_com_json_invalido_conta_zero_posts', async () => {
    localStorage.setItem(STORAGE_KEY, '{nao e json');
    await montar();
    await abrir('Estatisticas', 'Visitas ao perfil');
    expect(valorKpi('Total')).toBe('0');
  });

  it('origens_ordenadas_com_barra_proporcional_e_etiquetas_conhecidas', async () => {
    const { container } = await montar();
    await abrir('Estatisticas', 'Origem das reservas');
    const etiquetas = [...container.querySelectorAll('span.w-20')].map(s => s.textContent);
    expect(etiquetas).toEqual(['Directa', 'Booking', 'outro', 'Viator']);
    const larguras = [...container.querySelectorAll('div.h-full.rounded-full')].map(d => d.style.width);
    expect(larguras).toEqual(['100%', '60%', '40%', '20%']);
    expect([...container.querySelectorAll('span.w-8')].map(s => s.textContent)).toEqual(['5', '3', '2', '1']);
  });

  it('sem_sources_mostra_o_aviso_do_endpoint', async () => {
    getMarketingStats.mockResolvedValue({ profile_views: 1 });
    await montar();
    await abrir('Estatisticas', 'Origem das reservas');
    expect(screen.getByText(/Dados de origem nao disponiveis\. Configure o endpoint/)).toBeInTheDocument();
  });

  it('ligacao_de_reserva_com_copiar_e_Abrir_so_com_ligacao', async () => {
    await montar();
    await abrir('Estatisticas', 'Link de reserva directa');
    expect(screen.getByText('https://saldesk.cv/book/demo')).toBeInTheDocument();
    const abrirLink = screen.getByRole('link', { name: 'Abrir' });
    expect(abrirLink).toHaveAttribute('href', 'https://saldesk.cv/book/demo');
    expect(abrirLink).toHaveAttribute('target', '_blank');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(writeText).toHaveBeenCalledWith('https://saldesk.cv/book/demo');
    cleanup();
    getBookingLink.mockResolvedValue('');
    await montar();
    await abrir('Estatisticas', 'Visitas ao perfil');
    expect(screen.queryByText('Link de reserva directa')).not.toBeInTheDocument();
  });

  it('a_ligacao_pode_vir_como_texto_simples', async () => {
    getBookingLink.mockResolvedValue('https://saldesk.cv/book/outro');
    await montar();
    await abrir('Estatisticas', 'Link de reserva directa');
    expect(screen.getByText('https://saldesk.cv/book/outro')).toBeInTheDocument();
  });
});

/* ───────────────────────── design system: estrutura, Codigo QR e Widget ───────────────────────── */

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;
/* so os atributos class: as cores escolhidas (style, value, texto) sao dados funcionais */
const classes = (root) => [...root.querySelectorAll('[class]')].map(e => e.getAttribute('class')).join(' ');
const semCoresForaDosTokens = (html) => {
  expect(html).not.toMatch(HEX);
  expect(html).not.toMatch(NOMEADAS);
  expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  expect(html).not.toMatch(/bg-red-/);
};

describe('Marketing: design system (estrutura, QR e Widget)', () => {
  it('separadores_sao_Tabs_sem_icones', async () => {
    await montar();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'QR Code' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Widget' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Indicacoes' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Estatisticas' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'QR Code' }).querySelector('svg')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Widget' }));
    expect(screen.getByRole('tab', { name: 'Widget' })).toHaveAttribute('aria-selected', 'true');
  });

  it('as_amostras_de_cor_do_QR_tem_nome_e_aria_pressed', async () => {
    await montar();
    expect(screen.getByRole('button', { name: 'Cor #0D5470', pressed: true })).toBeInTheDocument();
    const outra = screen.getByRole('button', { name: 'Cor #062A38', pressed: false });
    fireEvent.click(outra);
    expect(screen.getByRole('button', { name: 'Cor #062A38', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cor #0D5470', pressed: false })).toBeInTheDocument();
  });

  it('os_campos_do_QR_tem_nome_acessivel', async () => {
    await montar();
    expect(screen.getByLabelText('QR Code para')).toBeInTheDocument();
    expect(screen.getByLabelText('Cor personalizada')).toHaveAttribute('type', 'color');
    expect(screen.getByLabelText('Tamanho do QR code')).toHaveAttribute('type', 'range');
  });

  it('o_widget_tem_Codigo_Preview_com_aria_pressed', async () => {
    await montar();
    await abrir('Widget', 'Codigo HTML');
    expect(screen.getByRole('button', { name: 'Codigo', pressed: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByRole('button', { name: 'Preview', pressed: true })).toBeInTheDocument();
  });

  it('o_botao_Copiar_e_type_button_e_copiado_usa_o_token_de_sucesso', async () => {
    await montar();
    await abrir('Widget', 'Codigo HTML');
    const b = screen.getByRole('button', { name: 'Copiar' });
    expect(b).toHaveAttribute('type', 'button');
    expect(b.className).toContain('bg-ocean-50');
    fireEvent.click(b);
    const copiado = await screen.findByRole('button', { name: 'Copiado' });
    expect(copiado.className).toContain('var(--success-light)');
    expect(copiado.className).toContain('var(--success)');
  });

  it('o_cartao_KPI_e_Card', async () => {
    await montar();
    await abrir('Estatisticas', 'Visitas ao perfil');
    expect(screen.getByText('Visitas ao perfil').closest('[class*="app:rounded-sm"]')).not.toBeNull();
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error_em_classes_nos_separadores_QR_e_Widget', async () => {
    const { container } = await montar();
    let html = classes(container);
    await abrir('Widget', 'Codigo HTML');
    html += classes(container);
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    html += classes(container);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await screen.findByRole('button', { name: 'Copiado' });
    html += classes(container);
    semCoresForaDosTokens(html);
  });
});

/* ───────────────────────── design system: Indicacoes e Estatisticas ───────────────────────── */

const ehCard = (el) => el.closest('[class*="app:rounded-sm"]') !== null;

describe('Marketing: design system (Indicacoes e Estatisticas)', () => {
  it('a_tabela_de_indicacoes_e_Table_com_as_tres_colunas', async () => {
    await montar();
    await abrir('Indicacoes', 'O seu link de indicacao');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Negocio', 'Data', 'Estado']);
    expect(ehCard(screen.getByText('O seu link de indicacao'))).toBe(true);
  });

  it('o_estado_da_indicacao_e_Badge_com_a_variante_certa', async () => {
    getReferrals.mockResolvedValue({
      referral_link: 'x', total: 5, convertidos: 1,
      referred: [
        { id: '1', nome: 'N', status: 'novo' }, { id: '2', nome: 'P', status: 'proposta_enviada' },
        { id: '3', nome: 'C', status: 'convertido' }, { id: '4', nome: 'D', status: 'descartado' }, { id: '5', nome: 'X', status: 'xyz' },
      ],
    });
    await montar();
    await abrir('Indicacoes', 'O seu link de indicacao');
    expect(screen.getByText('Novo').className).toContain('var(--info-light)');
    expect(screen.getByText('Proposta enviada').className).toContain('bg-sand-50');
    expect(screen.getByText('Convertido').className).toContain('var(--success-light)');
    expect(screen.getByText('Descartado').className).toContain('bg-n-100');
    expect(screen.getByText('xyz').className).toContain('var(--info-light)');
  });

  it('o_vazio_das_indicacoes_e_EmptyState', async () => {
    getReferrals.mockResolvedValue({ referral_link: 'x', referred: [] });
    await montar();
    await abrir('Indicacoes', 'O seu link de indicacao');
    expect(screen.getByText('Ainda nao indicou nenhum operador.')).toHaveClass('font-display');
  });

  it('os_blocos_das_estatisticas_sao_Card_e_os_numeros_dos_posts_usam_tokens', async () => {
    const d = new Date();
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: 'a', scheduled_at: `${mes}-10T10:00`, status: 'agendado', text_pt: 'A' },
      { id: 'c', scheduled_at: `${mes}-14T10:00`, status: 'publicado', text_pt: 'C' },
      { id: 'e', scheduled_at: `${mes}-20T10:00`, status: 'cancelado', text_pt: 'E' },
    ]));
    await montar();
    await abrir('Estatisticas', 'Origem das reservas');
    expect(ehCard(screen.getByText('Origem das reservas'))).toBe(true);
    expect(ehCard(screen.getByText('Link de reserva directa'))).toBe(true);
    expect(ehCard(screen.getByText(`Posts — ${MONTHS_PT[d.getMonth()]}`))).toBe(true);
    expect(screen.getByText('Publicados').previousSibling.className).toContain('var(--success)');
    expect(screen.getByText('Agendados').previousSibling.className).toContain('text-ocean-500');
    expect(screen.getByText('Cancelados').previousSibling.className).toContain('var(--error)');
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error_em_classes_nos_separadores_Indicacoes_e_Estatisticas', async () => {
    const d = new Date();
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'e', scheduled_at: `${mes}-20T10:00`, status: 'cancelado', text_pt: 'E' }]));
    const { container } = await montar();
    await abrir('Indicacoes', 'O seu link de indicacao');
    let html = classes(container);
    await abrir('Estatisticas', 'Origem das reservas');
    html += classes(container);
    semCoresForaDosTokens(html);
  });
});
