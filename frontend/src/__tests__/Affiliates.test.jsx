import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Affiliates from '../pages/Affiliates';
import useAuthStore from '../store/authStore';
import {
  listAffiliates, createAffiliate, updateAffiliate, deleteAffiliate, createAffiliatePayment,
  getAffiliateConfig, updateAffiliateConfig,
} from '../services/affiliatesService';
import { getBookingLink } from '../services/marketingService';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

vi.mock('../services/affiliatesService', () => ({
  listAffiliates: vi.fn(), createAffiliate: vi.fn(), updateAffiliate: vi.fn(), deleteAffiliate: vi.fn(),
  createAffiliatePayment: vi.fn(), getAffiliateConfig: vi.fn(), updateAffiliateConfig: vi.fn(),
}));
vi.mock('../services/marketingService', () => ({ getBookingLink: vi.fn() }));

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;
const HOJE = new Date().toISOString().slice(0, 10);

const AFILIADOS = [
  { id: 'a1', name: 'João Silva', email: 'joao@x.cv', code: 'JOA3K9', commission_pct: 12, active: true, bookings_count: 10, commission_paid: 100, commission_pending: 50 },
  { id: 'a2', name: 'Maria Lopes', email: 'm@x.cv', code: 'MAR1', commission_pct: 10, active: false, bookings_count: 4, commission_paid: 20, commission_pending: 0 },
  { id: 'a3', name: '', email: '', code: 'SEMNOME', commission_pct: 0, bookings_count: 0 },
];
const CONFIG = { active: true, commission_pct: 15, min_booking_value: 30 };

let spyErr; let spyWarn; let clip; let aberta;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  clip = vi.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: clip }, configurable: true });
  aberta = vi.spyOn(window, 'open').mockImplementation(() => null);
  useAuthStore.setState({ token: 'tok', operator: { id: 'op1', slug: 'sal' } });
  listAffiliates.mockReset().mockResolvedValue(AFILIADOS);
  getAffiliateConfig.mockReset().mockResolvedValue(CONFIG);
  getBookingLink.mockReset().mockResolvedValue({ url: 'https://saldesk.cv/book/demo' });
  [createAffiliate, updateAffiliate, deleteAffiliate, createAffiliatePayment, updateAffiliateConfig].forEach(f => f.mockReset());
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  useAuthStore.setState({ token: null, operator: null });
  vi.restoreAllMocks();
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

async function montar(primeiro = 'João Silva') {
  const r = render(<Affiliates />);
  await screen.findByText(primeiro);
  return r;
}
const linha = (nome) => screen.getByText(nome, { selector: 'p' }).closest('div.items-start.gap-3');
const kpi = (rotulo) => screen.getByText(rotulo).closest('article').querySelector('p.font-display').textContent;
const novoAfiliado = () => screen.getAllByText('Novo afiliado').find(e => e.closest('button')).closest('button');
const programa = () => screen.getByText(/^Programa (activo|inactivo)$/).closest('button');
const separador = (rotulo) => screen.getAllByText(rotulo).find(e => e.closest('button, [role="tab"]')).closest('button, [role="tab"]');

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Afiliados: lista', () => {
  it('lista_afiliados_com_nome_email_codigo_comissao_e_estatisticas', async () => {
    await montar();
    const l = linha('João Silva');
    expect(l).toHaveTextContent('joao@x.cv · JOA3K9 · 12% comissão');
    expect(l).toHaveTextContent('10Reservas');
    expect(l).toHaveTextContent('€100Pago');
    expect(l).toHaveTextContent('€50Pendente');
    expect(l).toHaveTextContent('J'); /* inicial */
    expect(linha('Maria Lopes')).toHaveTextContent('€20Pago');
  });

  it('a_ligacao_usa_o_slug_do_operador_ou_o_do_link_de_reservas', async () => {
    await montar();
    expect(linha('João Silva')).toHaveTextContent('https://saldesk.cv/book/sal?ref=JOA3K9');
    expect(getBookingLink).not.toHaveBeenCalled();
    cleanup();
    useAuthStore.setState({ operator: { id: 'op1' } });
    await montar();
    await waitFor(() => expect(linha('João Silva')).toHaveTextContent('https://saldesk.cv/book/demo?ref=JOA3K9'));
  });

  it('kpis_activos_reservas_comissao_paga_e_pendente', async () => {
    await montar();
    expect(kpi('Afiliados activos')).toBe('2'); /* active !== false */
    expect(kpi('Reservas geradas')).toBe('14');
    expect(kpi('Comissão paga')).toBe('€120');
    expect(kpi('Comissão pendente')).toBe('€50');
  });

  it('inactivo_fica_esbatido_e_o_estado_alterna_com_updateAffiliate', async () => {
    updateAffiliate.mockImplementation(async (id, d) => ({ ...AFILIADOS.find(a => a.id === id), ...d }));
    await montar();
    expect(linha('Maria Lopes').closest('.opacity-60')).not.toBeNull();
    expect(linha('João Silva').closest('.opacity-60')).toBeNull();
    fireEvent.click(within(linha('João Silva')).getAllByRole('button')[1]);
    await waitFor(() => expect(updateAffiliate).toHaveBeenCalledWith('a1', { active: false }));
    await waitFor(() => expect(linha('João Silva').closest('.opacity-60')).not.toBeNull());
    fireEvent.click(within(linha('Maria Lopes')).getAllByRole('button')[1]);
    await waitFor(() => expect(updateAffiliate).toHaveBeenCalledWith('a2', { active: true }));
  });

  it('afiliado_sem_nome_mostra_a_inicial_interrogacao', async () => {
    await montar();
    const sem = screen.getByText('SEMNOME', { selector: 'span' }).closest('div.items-start.gap-3');
    expect(sem).toHaveTextContent('?');
  });

  it('copiar_e_whatsapp', async () => {
    await montar();
    const link = 'https://saldesk.cv/book/sal?ref=JOA3K9';
    fireEvent.click(within(linha('João Silva')).getByText('Copiar'));
    expect(clip).toHaveBeenCalledWith(link);
    expect(await within(linha('João Silva')).findByText('Copiado')).toBeInTheDocument();
    fireEvent.click(within(linha('João Silva')).getByText('WA'));
    expect(aberta).toHaveBeenCalledWith(`https://wa.me/?text=${encodeURIComponent(`Reserve o seu tour: ${link}`)}`, '_blank', 'noopener');
  });

  it('programa_alterna_chama_updateAffiliateConfig_e_reverte_se_falha', async () => {
    updateAffiliateConfig.mockResolvedValueOnce({});
    await montar();
    expect(programa()).toHaveTextContent('Programa activo');
    fireEvent.click(programa());
    await waitFor(() => expect(updateAffiliateConfig).toHaveBeenCalledWith({ active: false, commission_pct: 15, min_booking_value: 30 }));
    expect(programa()).toHaveTextContent('Programa inactivo');
    updateAffiliateConfig.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(programa());
    await waitFor(() => expect(updateAffiliateConfig).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(programa()).toHaveTextContent('Programa inactivo')); /* reverteu a falha */
  });

  it('sem_afiliados_mostra_o_vazio_e_servicos_a_falhar_dao_os_valores_por_omissao', async () => {
    listAffiliates.mockResolvedValue([]);
    render(<Affiliates />);
    expect(await screen.findByText('Sem afiliados registados')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Novo afiliado/ })[1]);
    expect(screen.getByRole('dialog')).toHaveTextContent('Novo afiliado');
    cleanup();
    listAffiliates.mockRejectedValue(new Error('x'));
    getAffiliateConfig.mockRejectedValue(new Error('x'));
    render(<Affiliates />);
    expect(await screen.findByText('Sem afiliados registados')).toBeInTheDocument();
    expect(programa()).toHaveTextContent('Programa inactivo'); /* DEFAULT_CONF */
  });
});

describe('Afiliados: modais e acções', () => {
  it('criar_gera_o_codigo_a_partir_do_nome_so_uma_vez_e_envia_os_valores_e_recarrega', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    const sufixo = (0.123456789).toString(36).substring(2, 5).toUpperCase();
    createAffiliate.mockResolvedValue({});
    await montar();
    fireEvent.click(novoAfiliado());
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Novo afiliado');
    const codigo = within(dlg).getByPlaceholderText('Ex: JOA3K9');
    expect(codigo).toHaveValue('');
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: João Silva'), { target: { value: 'Ana Costa' } });
    await waitFor(() => expect(codigo).toHaveValue('ANA' + sufixo));
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: João Silva'), { target: { value: 'Outro Nome' } });
    expect(codigo).toHaveValue('ANA' + sufixo); /* so quando o codigo esta vazio */
    fireEvent.change(codigo, { target: { value: ' ana77 ' } });
    fireEvent.change(within(dlg).getByPlaceholderText('joao@exemplo.com'), { target: { value: 'ana@x.cv' } });
    expect(within(dlg).getByRole('spinbutton')).toHaveValue(15); /* comissao global */
    const antes = listAffiliates.mock.calls.length;
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar afiliado' }));
    await waitFor(() => expect(createAffiliate).toHaveBeenCalledWith({ name: 'Outro Nome', email: 'ana@x.cv', commission_pct: 15, code: 'ANA77', active: true }));
    await waitFor(() => expect(listAffiliates.mock.calls.length).toBeGreaterThan(antes));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('nomes_curtos_ou_sem_letras_geram_prefixos_de_enchimento', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await montar();
    fireEvent.click(novoAfiliado());
    const dlg = screen.getByRole('dialog');
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: João Silva'), { target: { value: 'Jo' } });
    await waitFor(() => expect(within(dlg).getByPlaceholderText('Ex: JOA3K9').value).toMatch(/^JOX/));
  });

  it('codigo_duplicado_mostra_a_mensagem_propria_e_outro_erro_a_generica', async () => {
    createAffiliate.mockRejectedValueOnce({ response: { data: { code: 'DUPLICATE_CODE' } } });
    await montar();
    fireEvent.click(novoAfiliado());
    const dlg = screen.getByRole('dialog');
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: João Silva'), { target: { value: 'Ana' } });
    fireEvent.change(within(dlg).getByPlaceholderText('joao@exemplo.com'), { target: { value: 'a@x.cv' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar afiliado' }));
    expect(await within(dlg).findByText('Já existe um afiliado com este código.')).toBeInTheDocument();
    createAffiliate.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar afiliado' }));
    expect(await within(dlg).findByText('Erro ao guardar afiliado.')).toBeInTheDocument();
  });

  it('editar_chama_updateAffiliate_com_o_id_e_os_valores', async () => {
    updateAffiliate.mockResolvedValue({});
    await montar();
    fireEvent.click(within(linha('João Silva')).getAllByRole('button')[2]);
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Editar afiliado');
    expect(within(dlg).getByPlaceholderText('Ex: João Silva')).toHaveValue('João Silva');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateAffiliate).toHaveBeenCalledWith('a1', { name: 'João Silva', email: 'joao@x.cv', commission_pct: 12, code: 'JOA3K9', active: true }));
  });

  it('eliminar_pede_confirmacao_e_chama_deleteAffiliate', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    deleteAffiliate.mockResolvedValue();
    await montar();
    fireEvent.click(within(linha('João Silva')).getAllByRole('button')[3]);
    expect(confirmar).toHaveBeenCalledWith('Eliminar este afiliado?');
    expect(deleteAffiliate).not.toHaveBeenCalled();
    confirmar.mockReturnValue(true);
    fireEvent.click(within(linha('João Silva')).getAllByRole('button')[3]);
    await waitFor(() => expect(deleteAffiliate).toHaveBeenCalledWith('a1'));
    await waitFor(() => expect(screen.queryByText('João Silva')).toBeNull());
  });

  it('pagamento_exige_montante_valido_e_chama_createAffiliatePayment_e_recarrega', async () => {
    createAffiliatePayment.mockResolvedValue({});
    await montar();
    fireEvent.click(within(linha('João Silva')).getByTitle('Registar pagamento'));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Pagamento — João Silva');
    expect(dlg).toHaveTextContent('TOTAL PAGO€100.00');
    expect(dlg).toHaveTextContent('PENDENTE€50.00');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Registar pagamento' }));
    expect(await within(dlg).findByText('Introduza um montante válido.')).toBeInTheDocument();
    expect(createAffiliatePayment).not.toHaveBeenCalled();
    fireEvent.change(within(dlg).getByRole('spinbutton'), { target: { value: '20' } });
    const antes = listAffiliates.mock.calls.length;
    fireEvent.click(within(dlg).getByRole('button', { name: 'Registar pagamento' }));
    await waitFor(() => expect(createAffiliatePayment).toHaveBeenCalledWith('a1', { amount: 20, payment_date: HOJE, note: 'Pagamento de comissão' }));
    await waitFor(() => expect(listAffiliates.mock.calls.length).toBeGreaterThan(antes));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('falha_ao_registar_pagamento_mostra_o_erro', async () => {
    createAffiliatePayment.mockRejectedValue(new Error('x'));
    await montar();
    fireEvent.click(within(linha('João Silva')).getByTitle('Registar pagamento'));
    const dlg = screen.getByRole('dialog');
    fireEvent.change(within(dlg).getByRole('spinbutton'), { target: { value: '20' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Registar pagamento' }));
    expect(await within(dlg).findByText('Erro ao registar pagamento.')).toBeInTheDocument();
  });
});

/* ───────────────────────── design system: estrutura, lista e modais ───────────────────────── */

describe('Afiliados com o design system (estrutura, lista e modais)', () => {
  it('os_tres_separadores_sao_tabs_com_aria_selected', async () => {
    await montar();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Afiliados' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Configuração' }));
    expect(await screen.findByText('Configuração global do programa')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Configuração' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Afiliados' })).toHaveAttribute('aria-selected', 'false');
  });

  it('o_botao_do_programa_tem_aria_pressed', async () => {
    await montar();
    expect(screen.getByRole('button', { name: 'Programa activo', pressed: true })).toBeInTheDocument();
    cleanup();
    getAffiliateConfig.mockResolvedValue({ ...CONFIG, active: false });
    await montar();
    expect(screen.getByRole('button', { name: 'Programa inactivo', pressed: false })).toBeInTheDocument();
  });

  it('os_botoes_de_icone_e_os_campos_dos_modais_tem_nome_acessivel', async () => {
    await montar();
    ['Registar pagamento João Silva', 'Desactivar João Silva', 'Editar João Silva', 'Eliminar João Silva'].forEach(n => expect(screen.getByRole('button', { name: n })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Activar Maria Lopes' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar João Silva' }));
    let modal = within(screen.getByRole('dialog'));
    ['Nome', 'Email', 'Comissão (%)', 'Código de afiliado'].forEach(r => expect(modal.getByLabelText(r)).toBeInTheDocument());
    fireEvent.click(modal.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Registar pagamento João Silva' }));
    modal = within(screen.getByRole('dialog'));
    ['Montante a pagar (€)', 'Data do pagamento', 'Nota'].forEach(r => expect(modal.getByLabelText(r)).toBeInTheDocument());
  });

  it('o_vazio_usa_o_EmptyState', async () => {
    listAffiliates.mockResolvedValue([]);
    render(<Affiliates />);
    expect(await screen.findByText('Sem afiliados registados')).toHaveClass('font-display');
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error_na_lista_e_nos_modais_com_erro', async () => {
    createAffiliatePayment.mockRejectedValue(new Error('x'));
    const { container } = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Registar pagamento João Silva' }));
    fireEvent.change(within(screen.getByRole('dialog')).getByRole('spinbutton'), { target: { value: '20' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Registar pagamento' }));
    await screen.findByText('Erro ao registar pagamento.');
    const html = container.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html.replace(/hover:text-error/g, '').replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  });
});

/* ───────────────────────── Tarefa 5: configuracao e analytics ───────────────────────── */

describe('Afiliados: configuração', () => {
  const abrirConfig = async () => { await montar(); fireEvent.click(separador('Configuração')); await screen.findByText('Configuração global do programa'); };

  it('mostra_os_valores_e_alterar_actualiza_como_numero', async () => {
    await abrirConfig();
    const [comissao, minimo] = screen.getAllByRole('spinbutton');
    expect(comissao).toHaveValue(15);
    expect(minimo).toHaveValue(30);
    fireEvent.change(comissao, { target: { value: '20' } });
    expect(comissao).toHaveValue(20);
    expect(screen.getByText('Percentagem padrão para novos afiliados. Pode ser sobreposta por afiliado.')).toBeInTheDocument();
    expect(screen.getByText('Valor mínimo da reserva para a comissão ser aplicada. 0 = sem mínimo.')).toBeInTheDocument();
  });

  it('guardar_chama_updateAffiliateConfig_e_mostra_Guardado_2s', async () => {
    updateAffiliateConfig.mockResolvedValue({});
    await abrirConfig();
    fireEvent.change(screen.getAllByRole('spinbutton')[1], { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuração' }));
    await waitFor(() => expect(updateAffiliateConfig).toHaveBeenCalledWith({ active: true, commission_pct: 15, min_booking_value: 45 }));
    expect(await screen.findByRole('button', { name: 'Guardado' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar configuração' })).toBeInTheDocument(), { timeout: 3500 });
  });

  it('mostra_o_texto_do_portal_do_afiliado', async () => {
    await abrirConfig();
    expect(screen.getByText('Portal do afiliado:')).toBeInTheDocument();
    expect(screen.getByText('saldesk.cv/afiliado/[CODIGO]')).toBeInTheDocument();
    expect(screen.getByText('?ref=CODIGO')).toBeInTheDocument();
  });
});

describe('Afiliados: analytics', () => {
  const abrirAnalytics = async () => { await montar(); fireEvent.click(separador('Analytics')); await screen.findByText('Top afiliados por reservas'); };

  it('ranking_ordena_por_reservas_com_barra_proporcional_e_pago', async () => {
    const { container } = await montar();
    fireEvent.click(separador('Analytics'));
    await screen.findByText('Top afiliados por reservas');
    const nomes = [...container.querySelectorAll('p.truncate')].map(p => p.textContent);
    expect(nomes).toEqual(['João Silva', 'Maria Lopes', '']);
    expect(screen.getByText('10 reservas · €100 pago')).toBeInTheDocument();
    expect(screen.getByText('4 reservas · €20 pago')).toBeInTheDocument();
    const barras = [...container.querySelectorAll('div[style*="width"]')].map(b => b.style.width);
    expect(barras).toEqual(['100%', '40%', '0%']);
    const medalhas = [...container.querySelectorAll('span.rounded-full.shrink-0')].map(m => m.textContent);
    expect(medalhas).toEqual(['1', '2', '3']);
  });

  it('sem_reservas_a_barra_fica_a_zero_e_sem_afiliados_mostra_o_vazio', async () => {
    listAffiliates.mockResolvedValue([{ id: 'z', name: 'Zero', email: 'z@x.cv', code: 'Z', commission_pct: 1 }]);
    const { container } = await montar('Zero');
    fireEvent.click(separador('Analytics'));
    await screen.findByText('Top afiliados por reservas');
    expect(container.querySelector('div[style*="width"]').style.width).toBe('0%');
    cleanup();
    listAffiliates.mockResolvedValue([]);
    render(<Affiliates />);
    await screen.findByText('Sem afiliados registados');
    fireEvent.click(separador('Analytics'));
    expect(await screen.findByText('Sem dados de afiliados ainda.')).toBeInTheDocument();
  });
});

describe('Afiliados com o design system (configuração e analytics)', () => {
  it('os_dois_campos_da_configuracao_sao_Input_com_nome_acessivel', async () => {
    await montar();
    fireEvent.click(screen.getByRole('tab', { name: 'Configuração' }));
    expect(await screen.findByLabelText('Comissão global (%)')).toHaveValue(15);
    expect(screen.getByLabelText('Mínimo de reserva (€)')).toHaveValue(30);
  });

  it('o_botao_guardado_usa_o_token_de_sucesso', async () => {
    updateAffiliateConfig.mockResolvedValue({});
    await montar();
    fireEvent.click(screen.getByRole('tab', { name: 'Configuração' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar configuração' }));
    const guardado = await screen.findByRole('button', { name: 'Guardado' });
    expect(guardado.className).toContain('var(--success)');
    expect(guardado.className).not.toMatch(HEX);
  });

  it('as_medalhas_usam_tokens_que_existem_e_o_vazio_e_EmptyState', async () => {
    const { container } = await montar();
    fireEvent.click(screen.getByRole('tab', { name: 'Analytics' }));
    await screen.findByText('Top afiliados por reservas');
    const medalhas = [...container.querySelectorAll('span.rounded-full.shrink-0')];
    expect(medalhas[0].className).toContain('var(--sand-300)');
    expect(container.innerHTML).not.toMatch(/sand-(?:700|200)/);
    cleanup();
    listAffiliates.mockResolvedValue([]);
    render(<Affiliates />);
    await screen.findByText('Sem afiliados registados');
    fireEvent.click(screen.getByRole('tab', { name: 'Analytics' }));
    expect(await screen.findByText('Sem dados de afiliados ainda.')).toHaveClass('font-display');
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error_nos_tres_separadores', async () => {
    updateAffiliateConfig.mockResolvedValue({});
    const { container } = await montar();
    let html = container.innerHTML;
    fireEvent.click(screen.getByRole('tab', { name: 'Configuração' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar configuração' }));
    await screen.findByRole('button', { name: 'Guardado' });
    html += container.innerHTML;
    fireEvent.click(screen.getByRole('tab', { name: 'Analytics' }));
    await screen.findByText('Top afiliados por reservas');
    html += container.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html.replace(/hover:text-error/g, '').replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  });
});

/* ───────────────────────── painel em ingles ───────────────────────── */

describe('Afiliados em ingles', () => {
  const novoAfiliadoEn = () => screen.getAllByText('New affiliate').find(e => e.closest('button')).closest('button');
  const DADOS = ['João Silva', 'Maria Lopes', 'joao@x.cv', 'm@x.cv'];
  beforeEach(() => { useUiStore.setState({ lang: 'en' }); });
  afterEach(() => { cleanup(); useUiStore.setState({ lang: 'pt' }); });

  it('a_lista_mostra_os_textos_em_ingles_sem_portugues_nem_chaves_cruas', async () => {
    await montar();
    expect(screen.getByText('Affiliate programme')).toBeInTheDocument();
    expect(screen.getByText('Manage affiliates and commissions on referred bookings')).toBeInTheDocument();
    expect(screen.getByText(/^Programme (active|inactive)$/).closest('button')).toHaveTextContent('Programme active');
    expect(kpi('Active affiliates')).toBe('2');
    expect(kpi('Bookings generated')).toBe('14');
    expect(kpi('Commission paid')).toBe('€120');
    expect(kpi('Commission pending')).toBe('€50');
    const l = linha('João Silva');
    expect(l).toHaveTextContent('joao@x.cv · JOA3K9 · 12% commission');
    expect(l).toHaveTextContent('10Bookings');
    expect(l).toHaveTextContent('€100Paid');
    expect(l).toHaveTextContent('€50Pending');
    expect(within(l).getByLabelText('Record payment João Silva')).toBeInTheDocument();
    expect(within(l).getByLabelText('Deactivate João Silva')).toBeInTheDocument();
    expect(within(linha('Maria Lopes')).getByLabelText('Activate Maria Lopes')).toBeInTheDocument();
    expect(within(l).getByLabelText('Edit João Silva')).toBeInTheDocument();
    expect(within(l).getByLabelText('Delete João Silva')).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['affiliatesPage', 'common'])).toEqual([]);
  });

  it('os_valores_em_euros_usam_os_separadores_do_ingles', async () => {
    listAffiliates.mockResolvedValue([{ ...AFILIADOS[0], commission_paid: 1250.5, commission_pending: 0 }]);
    await montar();
    expect(kpi('Commission paid')).toBe('€1,251');
    expect(linha('João Silva')).toHaveTextContent('€1,251Paid');
    fireEvent.click(within(linha('João Silva')).getByTitle('Record payment'));
    expect(screen.getByRole('dialog')).toHaveTextContent('TOTAL PAID€1,250.50');
  });

  it('o_texto_enviado_pelo_whatsapp_fica_em_portugues', async () => {
    await montar();
    fireEvent.click(within(linha('João Silva')).getByText('WA'));
    const link = 'https://saldesk.cv/book/sal?ref=JOA3K9';
    expect(aberta).toHaveBeenCalledWith(`https://wa.me/?text=${encodeURIComponent(`Reserve o seu tour: ${link}`)}`, '_blank', 'noopener');
  });

  it('os_separadores_de_configuracao_e_analytics_em_ingles', async () => {
    await montar();
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(await screen.findByText('Global programme settings')).toBeInTheDocument();
    expect(screen.getByText('Default percentage for new affiliates. It can be overridden per affiliate.')).toBeInTheDocument();
    expect(screen.getByText('Minimum booking value for the commission to apply. 0 = no minimum.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeInTheDocument();
    expect(document.body.textContent).toContain('Affiliate portal: Each affiliate can open their dashboard at saldesk.cv/afiliado/[CODIGO] with their registered email. Bookings made through the link (?ref=CODIGO) are assigned to the affiliate automatically.');
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    fireEvent.click(screen.getByRole('tab', { name: 'Analytics' }));
    expect(await screen.findByText('Top affiliates by bookings')).toBeInTheDocument();
    expect(screen.getByText('10 bookings · €100 paid')).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    cleanup();
    listAffiliates.mockResolvedValue([]);
    render(<Affiliates />);
    await screen.findByText('No affiliates registered');
    expect(screen.getByText('Create your first affiliate and share their affiliate link.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Analytics' }));
    expect(await screen.findByText('No affiliate data yet.')).toBeInTheDocument();
    expect(portuguesNoEcra()).toEqual([]);
  });

  it('criar_em_ingles_envia_os_mesmos_valores_gravados', async () => {
    createAffiliate.mockResolvedValue({});
    await montar();
    fireEvent.click(novoAfiliadoEn());
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('New affiliate');
    fireEvent.change(within(dlg).getByPlaceholderText('E.g. John Smith'), { target: { value: 'Ana Costa' } });
    fireEvent.change(within(dlg).getByPlaceholderText('E.g. JOH3K9'), { target: { value: ' ana77 ' } });
    fireEvent.change(within(dlg).getByPlaceholderText('john@example.com'), { target: { value: 'ana@x.cv' } });
    expect(portuguesNoEcra(['Ana Costa'], dlg)).toEqual([]);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Create affiliate' }));
    await waitFor(() => expect(createAffiliate).toHaveBeenCalledWith({ name: 'Ana Costa', email: 'ana@x.cv', commission_pct: 15, code: 'ANA77', active: true }));
  });

  it('codigo_duplicado_e_outro_erro_em_ingles', async () => {
    createAffiliate.mockRejectedValueOnce({ response: { data: { code: 'DUPLICATE_CODE' } } });
    await montar();
    fireEvent.click(novoAfiliadoEn());
    const dlg = screen.getByRole('dialog');
    fireEvent.change(within(dlg).getByPlaceholderText('E.g. John Smith'), { target: { value: 'Ana' } });
    fireEvent.change(within(dlg).getByPlaceholderText('john@example.com'), { target: { value: 'a@x.cv' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Create affiliate' }));
    expect(await within(dlg).findByText('An affiliate with this code already exists.')).toBeInTheDocument();
    createAffiliate.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Create affiliate' }));
    expect(await within(dlg).findByText('Could not save the affiliate.')).toBeInTheDocument();
  });

  it('pagamento_em_ingles_valida_o_montante_e_grava_a_nota_por_omissao_em_portugues', async () => {
    createAffiliatePayment.mockResolvedValue({});
    await montar();
    fireEvent.click(within(linha('João Silva')).getByTitle('Record payment'));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Payment — João Silva');
    expect(dlg).toHaveTextContent('TOTAL PAID€100.00');
    expect(dlg).toHaveTextContent('PENDING€50.00');
    expect(within(dlg).getByDisplayValue('Pagamento de comissão')).toBeInTheDocument();
    expect(portuguesNoEcra([...DADOS, 'Pagamento de comissão'], dlg)).toEqual([]);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Record payment' }));
    expect(await within(dlg).findByText('Enter a valid amount.')).toBeInTheDocument();
    fireEvent.change(within(dlg).getByRole('spinbutton'), { target: { value: '20' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(createAffiliatePayment).toHaveBeenCalledWith('a1', { amount: 20, payment_date: HOJE, note: 'Pagamento de comissão' }));
  });

  it('eliminar_pede_confirmacao_em_ingles_e_apaga_o_mesmo_id', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    deleteAffiliate.mockResolvedValue();
    await montar();
    fireEvent.click(within(linha('João Silva')).getByLabelText('Delete João Silva'));
    expect(confirmar).toHaveBeenCalledWith('Delete this affiliate?');
    await waitFor(() => expect(deleteAffiliate).toHaveBeenCalledWith('a1'));
  });
});

/* ───────────────────────── estilo Mare ───────────────────────── */

describe('Afiliados: estilo Mare', () => {
  const eMare = (el) => {
    expect(el).not.toBeNull();
    expect(el.className).toContain('bg-white');
    expect(el.className).toContain('border-mare-card');
    expect(el.className).toContain('rounded-[18px]');
  };
  const LONGO = 'a'.repeat(90);

  it('mostra_o_eyebrow_da_area_Crescimento_tambem_a_carregar', async () => {
    listAffiliates.mockReturnValue(new Promise(() => {}));
    render(<Affiliates />);
    expect(document.querySelector('[data-eyebrow]')).toHaveTextContent('Crescimento');
    cleanup();
    listAffiliates.mockResolvedValue(AFILIADOS);
    await montar();
    expect(document.querySelector('[data-eyebrow]')).toHaveTextContent('Crescimento');
  });

  it('os_totais_sao_MareStat_com_os_mesmos_valores', async () => {
    await montar();
    for (const [rotulo, valor] of [['Afiliados activos', '2'], ['Reservas geradas', '14'], ['Comissão paga', '€120'], ['Comissão pendente', '€50']]) {
      const artigo = screen.getByText(rotulo).closest('article');
      eMare(artigo);
      expect(artigo.querySelector('[data-mare-stat-tint]')).not.toBeNull();
      expect(artigo.querySelector('p.font-display')).toHaveTextContent(valor);
    }
  });

  it('cada_afiliado_esta_num_cartao_Mare_e_os_valores_sao_mono', async () => {
    await montar();
    const l = linha('João Silva');
    eMare(l.closest('article'));
    expect(within(l).getByText('€100').className).toContain('font-mono');
    expect(within(l).getByText('€100').className).toContain('tabular-nums');
    expect(within(l).getByText('10').className).toContain('font-mono');
    expect(within(l).getByText('JOA3K9').className).toContain('font-mono');
    expect(within(l).getByText('12% comissão').className).toContain('font-mono');
  });

  it('o_vazio_esta_num_cartao_Mare', async () => {
    listAffiliates.mockResolvedValue([]);
    render(<Affiliates />);
    eMare((await screen.findByText('Sem afiliados registados')).closest('section'));
  });

  it('os_botoes_de_icone_tem_44px_no_telemovel_e_o_eliminar_mantem_o_hover_vermelho', async () => {
    await montar();
    for (const n of ['Registar pagamento João Silva', 'Desactivar João Silva', 'Editar João Silva', 'Eliminar João Silva']) {
      expect(screen.getByRole('button', { name: n }).className).toContain('min-h-11');
    }
    expect(screen.getByRole('button', { name: 'Eliminar João Silva' }).className).toContain('hover:bg-[var(--error-light)]');
  });

  it('a_ligacao_longa_quebra_dentro_da_caixa_e_o_botao_copiar_fica', async () => {
    useAuthStore.setState({ operator: { id: 'op1', slug: LONGO } });
    await montar();
    const ligacao = `https://saldesk.cv/book/${LONGO}?ref=JOA3K9`;
    const p = within(linha('João Silva')).getByText(ligacao);
    expect(p.className).toContain('break-all');
    expect(p.className).toContain('font-mono');
    expect(p.className).not.toContain('truncate');
    expect(p.parentElement.className).toContain('min-w-0');
    fireEvent.click(within(linha('João Silva')).getByText('Copiar'));
    expect(clip).toHaveBeenCalledWith(ligacao);
    expect(await within(linha('João Silva')).findByText('Copiado')).toBeInTheDocument();
  });

  it('configuracao_e_analytics_estao_em_cartoes_Mare_com_titulo_de_secao', async () => {
    await montar();
    fireEvent.click(screen.getByRole('tab', { name: 'Configuração' }));
    const titulo = await screen.findByText('Configuração global do programa');
    expect(titulo.tagName).toBe('H2');
    eMare(titulo.closest('section'));
    fireEvent.click(screen.getByRole('tab', { name: 'Analytics' }));
    const top = await screen.findByText('Top afiliados por reservas');
    expect(top.tagName).toBe('H2');
    eMare(top.closest('section'));
    expect(screen.getByText('10 reservas · €100 pago').className).toContain('font-mono');
  });

  it('o_vazio_do_analytics_esta_num_cartao_Mare', async () => {
    listAffiliates.mockResolvedValue([]);
    render(<Affiliates />);
    await screen.findByText('Sem afiliados registados');
    fireEvent.click(screen.getByRole('tab', { name: 'Analytics' }));
    eMare((await screen.findByText('Sem dados de afiliados ainda.')).closest('section'));
  });
});
