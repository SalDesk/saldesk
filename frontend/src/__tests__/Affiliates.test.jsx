import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Affiliates from '../pages/Affiliates';
import useAuthStore from '../store/authStore';
import {
  listAffiliates, createAffiliate, updateAffiliate, deleteAffiliate, createAffiliatePayment,
  getAffiliateConfig, updateAffiliateConfig,
} from '../services/affiliatesService';
import { getBookingLink } from '../services/marketingService';

vi.mock('../services/affiliatesService', () => ({
  listAffiliates: vi.fn(), createAffiliate: vi.fn(), updateAffiliate: vi.fn(), deleteAffiliate: vi.fn(),
  createAffiliatePayment: vi.fn(), getAffiliateConfig: vi.fn(), updateAffiliateConfig: vi.fn(),
}));
vi.mock('../services/marketingService', () => ({ getBookingLink: vi.fn() }));

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;
const HOJE = new Date().toISOString().slice(0, 10);

const AFILIADOS = [
  { id: 'a1', name: 'Joao Silva', email: 'joao@x.cv', code: 'JOA3K9', commission_pct: 12, active: true, bookings_count: 10, commission_paid: 100, commission_pending: 50 },
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

async function montar(primeiro = 'Joao Silva') {
  const r = render(<Affiliates />);
  await screen.findByText(primeiro);
  return r;
}
const linha = (nome) => screen.getByText(nome, { selector: 'p' }).closest('div.items-start.gap-3');
const kpi = (rotulo) => screen.getByText(rotulo).previousSibling.textContent;
const novoAfiliado = () => screen.getAllByText('Novo afiliado').find(e => e.closest('button')).closest('button');
const programa = () => screen.getByText(/^Programa (activo|inactivo)$/).closest('button');
const separador = (rotulo) => screen.getAllByText(rotulo).find(e => e.closest('button, [role="tab"]')).closest('button, [role="tab"]');

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Afiliados: lista', () => {
  it('lista_afiliados_com_nome_email_codigo_comissao_e_estatisticas', async () => {
    await montar();
    const l = linha('Joao Silva');
    expect(l).toHaveTextContent('joao@x.cv · JOA3K9 · 12% comissao');
    expect(l).toHaveTextContent('10Reservas');
    expect(l).toHaveTextContent('€100Pago');
    expect(l).toHaveTextContent('€50Pendente');
    expect(l).toHaveTextContent('J'); /* inicial */
    expect(linha('Maria Lopes')).toHaveTextContent('€20Pago');
  });

  it('a_ligacao_usa_o_slug_do_operador_ou_o_do_link_de_reservas', async () => {
    await montar();
    expect(linha('Joao Silva')).toHaveTextContent('https://saldesk.cv/book/sal?ref=JOA3K9');
    expect(getBookingLink).not.toHaveBeenCalled();
    cleanup();
    useAuthStore.setState({ operator: { id: 'op1' } });
    await montar();
    await waitFor(() => expect(linha('Joao Silva')).toHaveTextContent('https://saldesk.cv/book/demo?ref=JOA3K9'));
  });

  it('kpis_activos_reservas_comissao_paga_e_pendente', async () => {
    await montar();
    expect(kpi('Afiliados activos')).toBe('2'); /* active !== false */
    expect(kpi('Reservas geradas')).toBe('14');
    expect(kpi('Comissao paga')).toBe('€120');
    expect(kpi('Comissao pendente')).toBe('€50');
  });

  it('inactivo_fica_esbatido_e_o_estado_alterna_com_updateAffiliate', async () => {
    updateAffiliate.mockImplementation(async (id, d) => ({ ...AFILIADOS.find(a => a.id === id), ...d }));
    await montar();
    expect(linha('Maria Lopes').closest('.opacity-60')).not.toBeNull();
    expect(linha('Joao Silva').closest('.opacity-60')).toBeNull();
    fireEvent.click(within(linha('Joao Silva')).getAllByRole('button')[1]);
    await waitFor(() => expect(updateAffiliate).toHaveBeenCalledWith('a1', { active: false }));
    await waitFor(() => expect(linha('Joao Silva').closest('.opacity-60')).not.toBeNull());
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
    fireEvent.click(within(linha('Joao Silva')).getByText('Copiar'));
    expect(clip).toHaveBeenCalledWith(link);
    expect(await within(linha('Joao Silva')).findByText('Copiado')).toBeInTheDocument();
    fireEvent.click(within(linha('Joao Silva')).getByText('WA'));
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

describe('Afiliados: modais e accoes', () => {
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
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: Joao Silva'), { target: { value: 'Ana Costa' } });
    await waitFor(() => expect(codigo).toHaveValue('ANA' + sufixo));
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: Joao Silva'), { target: { value: 'Outro Nome' } });
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
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: Joao Silva'), { target: { value: 'Jo' } });
    await waitFor(() => expect(within(dlg).getByPlaceholderText('Ex: JOA3K9').value).toMatch(/^JOX/));
  });

  it('codigo_duplicado_mostra_a_mensagem_propria_e_outro_erro_a_generica', async () => {
    createAffiliate.mockRejectedValueOnce({ response: { data: { code: 'DUPLICATE_CODE' } } });
    await montar();
    fireEvent.click(novoAfiliado());
    const dlg = screen.getByRole('dialog');
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: Joao Silva'), { target: { value: 'Ana' } });
    fireEvent.change(within(dlg).getByPlaceholderText('joao@exemplo.com'), { target: { value: 'a@x.cv' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar afiliado' }));
    expect(await within(dlg).findByText('Ja existe um afiliado com este codigo.')).toBeInTheDocument();
    createAffiliate.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar afiliado' }));
    expect(await within(dlg).findByText('Erro ao guardar afiliado.')).toBeInTheDocument();
  });

  it('editar_chama_updateAffiliate_com_o_id_e_os_valores', async () => {
    updateAffiliate.mockResolvedValue({});
    await montar();
    fireEvent.click(within(linha('Joao Silva')).getAllByRole('button')[2]);
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Editar afiliado');
    expect(within(dlg).getByPlaceholderText('Ex: Joao Silva')).toHaveValue('Joao Silva');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateAffiliate).toHaveBeenCalledWith('a1', { name: 'Joao Silva', email: 'joao@x.cv', commission_pct: 12, code: 'JOA3K9', active: true }));
  });

  it('eliminar_pede_confirmacao_e_chama_deleteAffiliate', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    deleteAffiliate.mockResolvedValue();
    await montar();
    fireEvent.click(within(linha('Joao Silva')).getAllByRole('button')[3]);
    expect(confirmar).toHaveBeenCalledWith('Eliminar este afiliado?');
    expect(deleteAffiliate).not.toHaveBeenCalled();
    confirmar.mockReturnValue(true);
    fireEvent.click(within(linha('Joao Silva')).getAllByRole('button')[3]);
    await waitFor(() => expect(deleteAffiliate).toHaveBeenCalledWith('a1'));
    await waitFor(() => expect(screen.queryByText('Joao Silva')).toBeNull());
  });

  it('pagamento_exige_montante_valido_e_chama_createAffiliatePayment_e_recarrega', async () => {
    createAffiliatePayment.mockResolvedValue({});
    await montar();
    fireEvent.click(within(linha('Joao Silva')).getByTitle('Registar pagamento'));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Pagamento — Joao Silva');
    expect(dlg).toHaveTextContent('TOTAL PAGO€100.00');
    expect(dlg).toHaveTextContent('PENDENTE€50.00');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Registar pagamento' }));
    expect(await within(dlg).findByText('Introduza um montante valido.')).toBeInTheDocument();
    expect(createAffiliatePayment).not.toHaveBeenCalled();
    fireEvent.change(within(dlg).getByRole('spinbutton'), { target: { value: '20' } });
    const antes = listAffiliates.mock.calls.length;
    fireEvent.click(within(dlg).getByRole('button', { name: 'Registar pagamento' }));
    await waitFor(() => expect(createAffiliatePayment).toHaveBeenCalledWith('a1', { amount: 20, payment_date: HOJE, note: 'Pagamento de comissao' }));
    await waitFor(() => expect(listAffiliates.mock.calls.length).toBeGreaterThan(antes));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('falha_ao_registar_pagamento_mostra_o_erro', async () => {
    createAffiliatePayment.mockRejectedValue(new Error('x'));
    await montar();
    fireEvent.click(within(linha('Joao Silva')).getByTitle('Registar pagamento'));
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
    fireEvent.click(screen.getByRole('tab', { name: 'Configuracao' }));
    expect(await screen.findByText('Configuracao global do programa')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Configuracao' })).toHaveAttribute('aria-selected', 'true');
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
    ['Registar pagamento Joao Silva', 'Desactivar Joao Silva', 'Editar Joao Silva', 'Eliminar Joao Silva'].forEach(n => expect(screen.getByRole('button', { name: n })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Activar Maria Lopes' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar Joao Silva' }));
    let modal = within(screen.getByRole('dialog'));
    ['Nome', 'Email', 'Comissao (%)', 'Codigo de afiliado'].forEach(r => expect(modal.getByLabelText(r)).toBeInTheDocument());
    fireEvent.click(modal.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Registar pagamento Joao Silva' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Registar pagamento Joao Silva' }));
    fireEvent.change(within(screen.getByRole('dialog')).getByRole('spinbutton'), { target: { value: '20' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Registar pagamento' }));
    await screen.findByText('Erro ao registar pagamento.');
    const html = container.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  });
});
