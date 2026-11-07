import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Vouchers from '../pages/Vouchers';
import useAuthStore from '../store/authStore';
import { listVouchers, createVoucher, updateVoucher, deleteVoucher } from '../services/vouchersService';
import { listUnits } from '../services/unitsService';
import { getBookingLink } from '../services/marketingService';

vi.mock('../services/vouchersService', () => ({
  listVouchers: vi.fn(), createVoucher: vi.fn(), updateVoucher: vi.fn(), deleteVoucher: vi.fn(),
}));
vi.mock('../services/unitsService', () => ({ listUnits: vi.fn() }));
vi.mock('../services/marketingService', () => ({ getBookingLink: vi.fn() }));

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;
function dia(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); }
const dataPt = (d) => new Date(d).toLocaleDateString('pt-PT', { timeZone: 'UTC' });

const UNIDADES = [{ id: 'u1', name: 'Kite' }, { id: 'u2', name: 'Mergulho' }];
const VOUCHERS = [
  { id: 'v1', code: 'VERAO20', type: 'percent', value: 20, min_amount: 50, expires_at: dia(60), max_uses: 10, uses_count: 3, unit_ids: ['u1'], active: true, created_at: '2026-11-05T10:00:00Z' },
  { id: 'v2', code: 'ESGOTADO', type: 'fixed', value: 10, min_amount: 0, expires_at: null, max_uses: 5, uses_count: 5, unit_ids: [], active: true, created_at: '2026-11-03T10:00:00Z' },
  { id: 'v3', code: 'EXPIRADO', type: 'percent', value: 15, expires_at: dia(-3), max_uses: 0, uses_count: 0, unit_ids: [], active: true, created_at: '2026-11-04T10:00:00Z' },
  { id: 'v4', code: 'INATIVO', type: 'percent', value: 5, expires_at: null, max_uses: 0, uses_count: 0, unit_ids: [], active: false, created_at: '2026-11-06T10:00:00Z' },
  { id: 'v5', code: 'BREVE', type: 'percent', value: 10, expires_at: dia(3), max_uses: 0, uses_count: 0, unit_ids: [], active: true, created_at: '2026-11-07T10:00:00Z' },
];

let spyErr; let spyWarn; let clip; let aberta;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  clip = vi.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: clip }, configurable: true });
  aberta = vi.spyOn(window, 'open').mockImplementation(() => null);
  useAuthStore.setState({ token: 'tok', operator: { id: 'op1', slug: 'sal' } });
  listVouchers.mockReset().mockResolvedValue(VOUCHERS);
  listUnits.mockReset().mockResolvedValue(UNIDADES);
  getBookingLink.mockReset().mockResolvedValue({ url: 'https://saldesk.cv/book/demo' });
  [createVoucher, updateVoucher, deleteVoucher].forEach(f => f.mockReset());
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

async function montar(primeiro = 'VERAO20') {
  const r = render(<Vouchers />);
  await screen.findByText(primeiro);
  return r;
}
const linha = (codigo) => screen.getByText(codigo, { selector: 'span' }).closest('tr');
const codigosPorOrdem = () => screen.getAllByRole('row').slice(1).map(r => within(r).getAllByRole('cell')[0].textContent.replace('Copiar', '').replace('Copiado', ''));
const kpi = (rotulo) => screen.getByText(rotulo).previousSibling.textContent;
const chip = (rotulo) => screen.getAllByText(rotulo).find(e => e.closest('button')).closest('button');
const novoVoucher = () => screen.getAllByText('Novo voucher').find(e => e.closest('button')).closest('button');

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Vouchers: lista', () => {
  it('lista_com_codigo_desconto_minimo_validade_usos_e_tours', async () => {
    await montar();
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Codigo', 'Desconto', 'Minimo', 'Validade', 'Usos', 'Tours', 'Estado', '']);
    const v1 = linha('VERAO20');
    expect(v1).toHaveTextContent('20%');
    expect(v1).toHaveTextContent('€50');
    expect(v1).toHaveTextContent(dataPt(dia(60)));
    expect(v1).toHaveTextContent('3/10');
    expect(v1).toHaveTextContent('1 tour(s)');
    const v2 = linha('ESGOTADO');
    expect(v2).toHaveTextContent('€10');
    expect(v2).toHaveTextContent('5/5');
    expect(v2).toHaveTextContent('Todos');
    expect(within(v2).getAllByText('—').length).toBeGreaterThanOrEqual(2); /* minimo e validade */
  });

  it('estado_inactivo_expirado_esgotado_activo_por_precedencia', async () => {
    listVouchers.mockResolvedValue([
      ...VOUCHERS,
      { id: 'v6', code: 'INAEXP', type: 'percent', value: 5, expires_at: dia(-9), max_uses: 0, uses_count: 0, active: false, created_at: '2026-11-01T10:00:00Z' },
      { id: 'v7', code: 'EXPESG', type: 'percent', value: 5, expires_at: dia(-9), max_uses: 2, uses_count: 2, active: true, created_at: '2026-11-02T10:00:00Z' },
    ]);
    await montar();
    const estado = (c) => within(linha(c)).getAllByRole('cell')[6].textContent;
    expect(estado('VERAO20')).toBe('Activo');
    expect(estado('ESGOTADO')).toBe('Esgotado');
    expect(estado('EXPIRADO')).toBe('Expirado');
    expect(estado('INATIVO')).toBe('Inactivo');
    expect(estado('INAEXP')).toBe('Inactivo'); /* inactivo ganha a expirado */
    expect(estado('EXPESG')).toBe('Expirado'); /* expirado ganha a esgotado */
  });

  it('aviso_de_expira_em_breve_so_em_activos_a_menos_de_7_dias', async () => {
    await montar();
    const aviso = (c) => linha(c).querySelector('svg.lucide-triangle-alert, svg.lucide-alert-triangle');
    expect(aviso('BREVE')).not.toBeNull();
    expect(aviso('VERAO20')).toBeNull();
    expect(aviso('EXPIRADO')).toBeNull();
  });

  it('kpis_total_activos_expirados_e_utilizacoes', async () => {
    await montar();
    expect(kpi('Total vouchers')).toBe('5');
    expect(kpi('Total utilizacoes')).toBe('8');
    expect(screen.getAllByText('Activos').find(e => e.tagName === 'P').previousSibling.textContent).toBe('2');
    expect(screen.getAllByText('Expirados').find(e => e.tagName === 'P').previousSibling.textContent).toBe('1');
  });

  it('ordena_por_created_at_decrescente_e_sem_created_at_nao_ordena', async () => {
    await montar();
    expect(codigosPorOrdem()).toEqual(['BREVE', 'INATIVO', 'VERAO20', 'EXPIRADO', 'ESGOTADO']);
    cleanup();
    listVouchers.mockResolvedValue([
      { id: 'a', code: 'PRIMEIRO', type: 'percent', value: 1, active: true },
      { id: 'b', code: 'SEGUNDO', type: 'percent', value: 2, active: true },
    ]);
    await montar('PRIMEIRO');
    expect(codigosPorOrdem()).toEqual(['PRIMEIRO', 'SEGUNDO']);
  });

  it('pesquisa_por_codigo_sem_maiusculas_filtro_por_estado_e_vazio', async () => {
    await montar();
    fireEvent.change(screen.getByPlaceholderText('Pesquisar codigo...'), { target: { value: 'ver' } });
    expect(codigosPorOrdem()).toEqual(['VERAO20']);
    fireEvent.change(screen.getByPlaceholderText('Pesquisar codigo...'), { target: { value: '' } });
    fireEvent.click(chip('Activos'));
    expect(codigosPorOrdem()).toEqual(['BREVE', 'VERAO20']);
    fireEvent.click(chip('Esgotados'));
    expect(codigosPorOrdem()).toEqual(['ESGOTADO']);
    fireEvent.click(chip('Expirados'));
    expect(codigosPorOrdem()).toEqual(['EXPIRADO']);
    fireEvent.click(chip('Todos'));
    expect(codigosPorOrdem()).toHaveLength(5);
    fireEvent.change(screen.getByPlaceholderText('Pesquisar codigo...'), { target: { value: 'zzz' } });
    expect(screen.getByText('Sem vouchers')).toBeInTheDocument();
  });

  it('sem_vouchers_mostra_o_vazio_e_em_carga_o_texto', async () => {
    listVouchers.mockResolvedValue([]);
    render(<Vouchers />);
    expect(await screen.findByText('Sem vouchers')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Criar voucher/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Novo voucher');
    cleanup();
    listVouchers.mockReturnValue(new Promise(() => {}));
    listUnits.mockReturnValue(new Promise(() => {}));
    getBookingLink.mockReturnValue(new Promise(() => {}));
    render(<Vouchers />);
    expect(screen.getByText('A carregar...')).toBeInTheDocument();
  });

  it('servicos_a_falhar_nao_rebentam', async () => {
    listVouchers.mockRejectedValue(new Error('x'));
    listUnits.mockRejectedValue(new Error('x'));
    getBookingLink.mockRejectedValue(new Error('x'));
    render(<Vouchers />);
    expect(await screen.findByText('Sem vouchers')).toBeInTheDocument();
  });

  it('copiar_chama_clipboard_e_mostra_Copiado_durante_2s', async () => {
    await montar();
    fireEvent.click(within(linha('VERAO20')).getByText('Copiar'));
    expect(clip).toHaveBeenCalledWith('VERAO20');
    expect(await within(linha('VERAO20')).findByText('Copiado')).toBeInTheDocument();
    await waitFor(() => expect(within(linha('VERAO20')).queryByText('Copiado')).toBeNull(), { timeout: 3000 });
  });
});

describe('Vouchers: formulario e accoes', () => {
  it('criar_valida_codigo_e_valor_e_envia_o_codigo_em_maiusculas', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    createVoucher.mockImplementation(async (d) => ({ id: 'vn', uses_count: 0, active: true, ...d }));
    await montar();
    fireEvent.click(novoVoucher());
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Novo voucher');
    const codigo = within(dlg).getByPlaceholderText('Ex: VERAO2025');
    expect(codigo).toHaveValue('AAAAAAAA'); /* gerado */
    fireEvent.change(codigo, { target: { value: '   ' } });
    fireEvent.submit(dlg.querySelector('form'));
    expect(await within(dlg).findByText('O codigo e obrigatorio.')).toBeInTheDocument();
    fireEvent.change(codigo, { target: { value: ' teste ' } });
    fireEvent.submit(dlg.querySelector('form'));
    expect(await within(dlg).findByText('O valor do desconto deve ser maior que zero.')).toBeInTheDocument();
    fireEvent.change(within(dlg).getByPlaceholderText('20'), { target: { value: '25' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar voucher' }));
    await waitFor(() => expect(createVoucher).toHaveBeenCalledTimes(1));
    expect(createVoucher).toHaveBeenCalledWith(expect.objectContaining({
      code: 'TESTE', type: 'percent', value: 25, min_amount: 0, max_uses: 0, unit_ids: [], active: true,
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('TESTE', { selector: 'span' })).toBeInTheDocument();
  });

  it('gerar_cria_um_codigo_de_8_caracteres_do_alfabeto', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    await montar();
    fireEvent.click(novoVoucher());
    fireEvent.click(screen.getByRole('button', { name: 'Gerar' }));
    expect(screen.getByPlaceholderText('Ex: VERAO2025')).toHaveValue('99999999');
  });

  it('tipo_fixo_muda_a_etiqueta_e_os_limites_do_valor', async () => {
    await montar();
    fireEvent.click(novoVoucher());
    const dlg = within(screen.getByRole('dialog'));
    const valor = dlg.getByPlaceholderText('20');
    expect(valor).toHaveAttribute('min', '1');
    expect(valor).toHaveAttribute('max', '100');
    expect(dlg.getByText('Desconto (%)')).toBeInTheDocument();
    fireEvent.change(dlg.getAllByRole('combobox')[0], { target: { value: 'fixed' } });
    const fixo = dlg.getByPlaceholderText('10.00');
    expect(fixo).toHaveAttribute('min', '0.01');
    expect(fixo).not.toHaveAttribute('max');
    expect(dlg.getByText('Desconto (€)')).toBeInTheDocument();
  });

  it('tours_aplicaveis_alternam_o_texto_e_vao_no_pedido', async () => {
    createVoucher.mockImplementation(async (d) => ({ id: 'vn', ...d }));
    await montar();
    fireEvent.click(novoVoucher());
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Aplicavel a todos os tours.');
    fireEvent.click(within(dlg).getByText('Kite'));
    expect(dlg).toHaveTextContent('1 tour(s) seleccionado(s).');
    fireEvent.change(within(dlg).getByPlaceholderText('20'), { target: { value: '5' } });
    fireEvent.change(within(dlg).getByPlaceholderText('0 = sem minimo'), { target: { value: '30' } });
    fireEvent.change(within(dlg).getByPlaceholderText('0 = ilimitado'), { target: { value: '4' } });
    fireEvent.change(dlg.querySelector('input[type="date"]'), { target: { value: '2027-01-31' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar voucher' }));
    await waitFor(() => expect(createVoucher).toHaveBeenCalledWith(expect.objectContaining({ unit_ids: ['u1'], min_amount: 30, max_uses: 4, expires_at: '2027-01-31' })));
  });

  it('editar_chama_updateVoucher_e_mostra_o_erro_do_servidor_ou_o_generico', async () => {
    updateVoucher.mockRejectedValueOnce({ response: { data: { error: 'Codigo duplicado' } } });
    await montar();
    fireEvent.click(within(linha('VERAO20')).getByTitle('Editar'));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Editar voucher');
    expect(within(dlg).getByPlaceholderText('Ex: VERAO2025')).toHaveValue('VERAO20');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }));
    expect(await within(dlg).findByText('Codigo duplicado')).toBeInTheDocument();
    updateVoucher.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }));
    expect(await within(dlg).findByText('Erro ao guardar voucher.')).toBeInTheDocument();
    updateVoucher.mockImplementation(async (id, d) => ({ ...VOUCHERS[0], ...d }));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateVoucher).toHaveBeenLastCalledWith('v1', expect.objectContaining({ code: 'VERAO20', value: 20, min_amount: 50, max_uses: 10 })));
  });

  it('activar_desactivar_chama_updateVoucher_com_active_invertido', async () => {
    updateVoucher.mockImplementation(async (id, d) => ({ ...VOUCHERS.find(v => v.id === id), ...d }));
    await montar();
    fireEvent.click(within(linha('VERAO20')).getByTitle('Desactivar'));
    await waitFor(() => expect(updateVoucher).toHaveBeenCalledWith('v1', { active: false }));
    await waitFor(() => expect(within(linha('VERAO20')).getAllByRole('cell')[6]).toHaveTextContent('Inactivo'));
    fireEvent.click(within(linha('INATIVO')).getByTitle('Activar'));
    await waitFor(() => expect(updateVoucher).toHaveBeenCalledWith('v4', { active: true }));
  });

  it('eliminar_pede_confirmacao_e_chama_deleteVoucher', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    deleteVoucher.mockResolvedValue();
    await montar();
    fireEvent.click(within(linha('VERAO20')).getByTitle('Eliminar'));
    expect(confirmar).toHaveBeenCalledWith('Eliminar este voucher?');
    expect(deleteVoucher).not.toHaveBeenCalled();
    confirmar.mockReturnValue(true);
    fireEvent.click(within(linha('VERAO20')).getByTitle('Eliminar'));
    await waitFor(() => expect(deleteVoucher).toHaveBeenCalledWith('v1'));
    await waitFor(() => expect(screen.queryByText('VERAO20')).toBeNull());
  });
});

describe('Vouchers: partilhar', () => {
  const msgPt = (link) => `Use o codigo *VERAO20* para obter 20% de desconto na sua proxima reserva. Valido ate ${dataPt(dia(60))}. Reserve em: ${link}`;
  const msgEn = (link) => `Use code *VERAO20* to get 20% off your next booking. Valido ate ${dataPt(dia(60))}. Book at: ${link}`;

  it('abre_o_modal_e_envia_as_mensagens_pt_e_en_por_whatsapp_e_email', async () => {
    await montar();
    fireEvent.click(within(linha('VERAO20')).getByTitle('Partilhar'));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Partilhar — VERAO20');
    expect(dlg).toHaveTextContent('20% de desconto');
    const link = 'https://saldesk.cv/book/demo';
    const enviar = within(dlg).getAllByRole('button', { name: /Enviar/ });
    fireEvent.click(enviar[0]);
    expect(aberta).toHaveBeenLastCalledWith(`https://wa.me/?text=${encodeURIComponent(msgPt(link))}`, '_blank', 'noopener');
    fireEvent.click(enviar[1]);
    expect(aberta).toHaveBeenLastCalledWith(`https://wa.me/?text=${encodeURIComponent(msgEn(link))}`, '_blank', 'noopener');
    fireEvent.click(within(dlg).getByRole('button', { name: /Email PT/ }));
    expect(aberta).toHaveBeenLastCalledWith(`mailto:?subject=${encodeURIComponent('Voucher especial para si')}&body=${encodeURIComponent(msgPt(link))}`, '_blank');
    fireEvent.click(within(dlg).getByRole('button', { name: /Email EN/ }));
    expect(aberta).toHaveBeenLastCalledWith(`mailto:?subject=${encodeURIComponent('Special voucher for you')}&body=${encodeURIComponent(msgEn(link))}`, '_blank');
    fireEvent.click(within(dlg).getAllByText('Copiar')[0]);
    expect(clip).toHaveBeenCalledWith(msgPt(link));
    expect((await within(dlg).findAllByText('Copiado')).length).toBeGreaterThan(0);
  });

  it('sem_ligacao_do_servidor_usa_o_slug_do_operador_e_sem_validade_nao_ha_frase_de_validade', async () => {
    getBookingLink.mockRejectedValue(new Error('x'));
    await montar();
    fireEvent.click(within(linha('ESGOTADO')).getByTitle('Partilhar'));
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: /Enviar/ })[0]);
    expect(aberta).toHaveBeenLastCalledWith(
      `https://wa.me/?text=${encodeURIComponent('Use o codigo *ESGOTADO* para obter €10 de desconto na sua proxima reserva. Reserve em: https://saldesk.cv/book/sal')}`,
      '_blank', 'noopener',
    );
  });
});

/* ───────────────────────── design system ───────────────────────── */

describe('Vouchers com o design system', () => {
  it('a_tabela_tem_role_table_e_o_estado_e_Badge_com_a_variante_certa', async () => {
    await montar();
    expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(8);
    const badge = (c) => within(within(linha(c)).getAllByRole('cell')[6]).getByText(/Activo|Esgotado|Expirado|Inactivo/);
    expect(badge('VERAO20').className).toContain('var(--success)');
    expect(badge('ESGOTADO').className).toContain('var(--warning)');
    expect(badge('INATIVO').className).toContain('var(--error)');
    expect(badge('EXPIRADO').className).toContain('bg-n-100');
  });

  it('os_chips_tem_aria_pressed_e_a_pesquisa_nome_acessivel', async () => {
    await montar();
    expect(screen.getByRole('button', { name: 'Todos', pressed: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Activos', pressed: false }));
    expect(screen.getByRole('button', { name: 'Activos', pressed: true })).toBeInTheDocument();
    expect(screen.getByLabelText('Pesquisar codigo')).toBeInTheDocument();
  });

  it('os_botoes_de_icone_e_os_campos_dos_modais_tem_nome_acessivel', async () => {
    await montar();
    ['Partilhar VERAO20', 'Editar VERAO20', 'Desactivar VERAO20', 'Eliminar VERAO20'].forEach(n => expect(screen.getByRole('button', { name: n })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Activar INATIVO' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar VERAO20' }));
    const modal = within(screen.getByRole('dialog'));
    ['Codigo', 'Tipo de desconto', 'Desconto (%)', 'Minimo de reserva (€)', 'Limite de usos', 'Valido ate'].forEach(r => expect(modal.getByLabelText(r)).toBeInTheDocument());
  });

  it('o_vazio_usa_o_EmptyState', async () => {
    listVouchers.mockResolvedValue([]);
    render(<Vouchers />);
    expect(await screen.findByText('Sem vouchers')).toHaveClass('font-display');
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error_com_o_modal_de_partilha_e_o_erro', async () => {
    updateVoucher.mockRejectedValue(new Error('x'));
    const { container } = await montar();
    fireEvent.click(within(linha('VERAO20')).getByTitle('Partilhar'));
    let html = container.innerHTML;
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button').find(b => /Fechar/.test(b.textContent) || b.getAttribute('aria-label') === 'Fechar'));
    fireEvent.click(within(linha('VERAO20')).getByTitle('Editar'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }));
    await screen.findByText('Erro ao guardar voucher.');
    html += container.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  });
});
