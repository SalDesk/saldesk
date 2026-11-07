import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Groups from '../pages/Groups';
import { listGroups, createGroup, updateGroup, deleteGroup, createGroupPayment } from '../services/groupsService';
import { listUnits } from '../services/unitsService';

vi.mock('../services/groupsService', () => ({
  listGroups: vi.fn(), createGroup: vi.fn(), updateGroup: vi.fn(), deleteGroup: vi.fn(), createGroupPayment: vi.fn(),
}));
vi.mock('../services/unitsService', () => ({ listUnits: vi.fn() }));

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;
const norm = (t) => t.replace(/\s/g, ' ');
function dia(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); }
function fmtDate(d) { return norm(new Date(d + 'T00:00:00Z').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })); }

const UNIDADES = [{ id: 'u1', name: 'Kite', base_price: 50 }, { id: 'u2', name: 'Mergulho', base_price: 40 }];
const GRUPOS = [
  { id: 'g1', company: 'Empresa Alfa', event_type: 'team_building', guests: 20, date: dia(20), status: 'pedido', tour_ids: ['u1', 'u2'], discount_pct: 15, signal_pct: 30, days_before: 7, proposal_expires: dia(10), notes: 'Alergias', payments: [{ date: '2026-11-01', note: 'Sinal', amount: 300 }], created_at: '2026-11-05T10:00:00Z' },
  { id: 'g2', company: 'Hotel Beta', event_type: 'casamento', guests: 50, status: 'confirmado', tour_ids: [], created_at: '2026-11-06T10:00:00Z' },
  { id: 'g3', company: 'Escola Gama', event_type: 'turismo', guests: 30, status: 'concluido', created_at: '2026-11-04T10:00:00Z' },
  { id: 'g4', company: 'Cancelada SA', event_type: 'outro', guests: 10, status: 'cancelado', created_at: '2026-11-03T10:00:00Z' },
  { id: 'g5', company: 'Analise Lda', event_type: 'incentivo', guests: 12, status: 'em_analise', created_at: '2026-11-02T10:00:00Z' },
  { id: 'g6', company: 'Proposta Lda', event_type: 'incentivo', guests: 8, status: 'proposta_enviada', created_at: '2026-11-01T10:00:00Z' },
];

let spyErr; let spyWarn;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  listGroups.mockReset().mockResolvedValue(GRUPOS);
  listUnits.mockReset().mockResolvedValue(UNIDADES);
  [createGroup, updateGroup, deleteGroup, createGroupPayment].forEach(f => f.mockReset());
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

async function montar(primeiro = 'Empresa Alfa') {
  const r = render(<Groups />);
  await screen.findByText(primeiro);
  return r;
}
const cartao = (nome) => screen.getByText(nome, { selector: 'p' }).closest('div.overflow-hidden');
const abrir = (nome) => fireEvent.click(screen.getByText(nome, { selector: 'p' }).closest('div.cursor-pointer'));
const chip = (rotulo) => screen.getAllByText(rotulo).find(e => e.closest('button')).closest('button');
const novaCotacao = () => screen.getAllByText('Nova cotacao').find(e => e.closest('button')).closest('button');
const kpi = (rotulo) => screen.getByText(rotulo).previousSibling.textContent;
const empresasPorOrdem = () => [...document.querySelectorAll('p.truncate')].map(p => p.textContent);

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Grupos: lista', () => {
  it('lista_cotacoes_com_empresa_tipo_pessoas_data_e_estado', async () => {
    await montar();
    const c = cartao('Empresa Alfa');
    expect(c).toHaveTextContent(`Team Building · 20 pax · ${fmtDate(dia(20))}`);
    expect(within(c).getByText('Pedido')).toBeInTheDocument();
    expect(cartao('Hotel Beta')).toHaveTextContent('Casamento / Evento · 50 pax');
    expect(cartao('Hotel Beta')).not.toHaveTextContent(' · ' + '—');
  });

  it('abre_e_fecha_o_cartao_com_tours_condicoes_notas_e_pagamentos', async () => {
    await montar();
    expect(cartao('Empresa Alfa')).not.toHaveTextContent('Tours pretendidos');
    abrir('Empresa Alfa');
    const c = cartao('Empresa Alfa');
    expect(c).toHaveTextContent('Tours pretendidos');
    expect(within(c).getByText(/Kite — €50\/pax/)).toBeInTheDocument();
    expect(within(c).getByText(/Mergulho — €40\/pax/)).toBeInTheDocument();
    expect(c).toHaveTextContent('Desconto15%');
    expect(c).toHaveTextContent('Sinal30%');
    expect(c).toHaveTextContent('Pagamento final7d antes');
    expect(c).toHaveTextContent(`Proposta valida ate${fmtDate(dia(10))}`);
    expect(c).toHaveTextContent('Alergias');
    expect(c).toHaveTextContent(`${fmtDate('2026-11-01')} · Sinal`);
    expect(c).toHaveTextContent('Total pago€300.00');
    abrir('Empresa Alfa');
    expect(cartao('Empresa Alfa')).not.toHaveTextContent('Tours pretendidos');
  });

  it('condicoes_com_valores_por_omissao', async () => {
    await montar();
    abrir('Hotel Beta');
    const c = cartao('Hotel Beta');
    expect(c).toHaveTextContent('Desconto—');
    expect(c).toHaveTextContent('Sinal30%');
    expect(c).toHaveTextContent('Pagamento final7d antes');
    expect(c).toHaveTextContent('Proposta valida ate—');
    expect(c).not.toHaveTextContent('Pagamentos recebidos');
  });

  it('kpis_total_confirmados_e_pax_de_confirmados_e_concluidos', async () => {
    await montar();
    expect(kpi('Total cotacoes')).toBe('6');
    expect(kpi('Confirmados')).toBe('1');
    expect(kpi('Pax confirmados')).toBe('80');
  });

  it('ordena_por_created_at_decrescente', async () => {
    await montar();
    expect(empresasPorOrdem()).toEqual(['Hotel Beta', 'Empresa Alfa', 'Escola Gama', 'Cancelada SA', 'Analise Lda', 'Proposta Lda']);
  });

  it('pesquisa_por_empresa_filtro_por_estado_e_vazios', async () => {
    await montar();
    fireEvent.change(screen.getByPlaceholderText('Pesquisar empresa ou grupo...'), { target: { value: 'ALFA' } });
    expect(empresasPorOrdem()).toEqual(['Empresa Alfa']);
    fireEvent.change(screen.getByPlaceholderText('Pesquisar empresa ou grupo...'), { target: { value: '' } });
    fireEvent.click(chip('Confirmado'));
    expect(empresasPorOrdem()).toEqual(['Hotel Beta']);
    fireEvent.click(chip('Cancelado'));
    expect(empresasPorOrdem()).toEqual(['Cancelada SA']);
    fireEvent.click(chip('Todos'));
    expect(empresasPorOrdem()).toHaveLength(6);
    fireEvent.change(screen.getByPlaceholderText('Pesquisar empresa ou grupo...'), { target: { value: 'zzz' } });
    expect(screen.getByText('Nenhuma cotacao corresponde aos filtros.')).toBeInTheDocument();
    expect(screen.queryByText('Regista a primeira cotacao para grupo ou evento corporativo.')).toBeNull();
  });

  it('sem_cotacoes_mostra_o_vazio_com_botao_e_servicos_a_falhar_nao_rebentam', async () => {
    listGroups.mockResolvedValue([]);
    render(<Groups />);
    expect(await screen.findByText('Regista a primeira cotacao para grupo ou evento corporativo.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Nova cotacao/ })[1]);
    expect(screen.getByRole('dialog')).toHaveTextContent('Nova cotacao de grupo');
    cleanup();
    listGroups.mockRejectedValue(new Error('x'));
    listUnits.mockRejectedValue(new Error('x'));
    render(<Groups />);
    expect(await screen.findByText('Sem cotacoes')).toBeInTheDocument();
    cleanup();
    listGroups.mockReturnValue(new Promise(() => {}));
    listUnits.mockReturnValue(new Promise(() => {}));
    render(<Groups />);
    expect(screen.getByText('Grupos e Eventos Corporativos')).toBeInTheDocument();
    expect(screen.queryByText('Total cotacoes')).toBeNull();
  });
});

describe('Grupos: accoes', () => {
  it('avancar_estado_so_para_os_quatro_primeiros_estados', async () => {
    await montar();
    const botao = (nome) => { abrir(nome); return within(cartao(nome)).queryByText(/Avancar para:/); };
    expect(botao('Empresa Alfa')).toHaveTextContent('Avancar para: Em analise');
    expect(botao('Analise Lda')).toHaveTextContent('Avancar para: Proposta enviada');
    expect(botao('Proposta Lda')).toHaveTextContent('Avancar para: Confirmado');
    expect(botao('Hotel Beta')).toHaveTextContent('Avancar para: Concluido');
    expect(botao('Escola Gama')).toBeNull();
    expect(botao('Cancelada SA')).toBeNull();
  });

  it('avancar_chama_updateGroup_com_o_estado_seguinte_e_actualiza_o_selo', async () => {
    updateGroup.mockImplementation(async (id, d) => ({ ...GRUPOS.find(g => g.id === id), ...d }));
    await montar();
    abrir('Empresa Alfa');
    fireEvent.click(within(cartao('Empresa Alfa')).getByText(/Avancar para:/));
    await waitFor(() => expect(updateGroup).toHaveBeenCalledWith('g1', { status: 'em_analise' }));
    await waitFor(() => expect(within(cartao('Empresa Alfa')).getAllByText('Em analise').length).toBeGreaterThan(0));
  });

  it('registar_pagamento_chama_createGroupPayment_e_fecha_so_com_montante_positivo', async () => {
    createGroupPayment.mockImplementation(async (id, p) => ({ ...GRUPOS[0], payments: [...GRUPOS[0].payments, p] }));
    await montar();
    abrir('Empresa Alfa');
    fireEvent.click(within(cartao('Empresa Alfa')).getByText('Registar pagamento'));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Pagamento — Empresa Alfa');
    expect(dlg).toHaveTextContent('Total pago ate agora: €300.00');
    expect(dlg.querySelector('input[type="date"]')).toHaveValue(new Date().toISOString().slice(0, 10));
    expect(within(dlg).getByPlaceholderText('Ex: Sinal, Pagamento final...')).toHaveValue('Sinal');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Registar' }));
    expect(createGroupPayment).not.toHaveBeenCalled(); /* sem montante */
    fireEvent.change(within(dlg).getByRole('spinbutton'), { target: { value: '150' } });
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: Sinal, Pagamento final...'), { target: { value: 'Final' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Registar' }));
    await waitFor(() => expect(createGroupPayment).toHaveBeenCalledWith('g1', { amount: 150, date: new Date().toISOString().slice(0, 10), note: 'Final' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(cartao('Empresa Alfa')).toHaveTextContent('Total pago€450.00');
  });

  it('imprimir_proposta_chama_window_print', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});
    await montar();
    abrir('Empresa Alfa');
    fireEvent.click(within(cartao('Empresa Alfa')).getByText('Imprimir proposta'));
    expect(imprimir).toHaveBeenCalledTimes(1);
  });

  it('eliminar_pede_confirmacao_e_chama_deleteGroup', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    deleteGroup.mockResolvedValue();
    await montar();
    abrir('Empresa Alfa');
    const apagar = () => within(cartao('Empresa Alfa')).getAllByRole('button').at(-1);
    fireEvent.click(apagar());
    expect(confirmar).toHaveBeenCalledWith('Eliminar esta cotacao?');
    expect(deleteGroup).not.toHaveBeenCalled();
    confirmar.mockReturnValue(true);
    fireEvent.click(apagar());
    await waitFor(() => expect(deleteGroup).toHaveBeenCalledWith('g1'));
    await waitFor(() => expect(screen.queryByText('Empresa Alfa')).toBeNull());
  });
});

describe('Grupos: formulario', () => {
  it('criar_envia_numeros_e_mostra_o_preco_estimado_com_e_sem_desconto', async () => {
    createGroup.mockImplementation(async (d) => ({ id: 'gn', created_at: '2026-11-08T10:00:00Z', ...d }));
    await montar();
    fireEvent.click(novaCotacao());
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Nova cotacao de grupo');
    expect(within(dlg).queryByText('Estado')).toBeNull();
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: Empresa ABC'), { target: { value: 'Empresa Nova' } });
    fireEvent.change(dlg.querySelector('input[type="date"]'), { target: { value: '2027-02-01' } });
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: 20'), { target: { value: '20' } });
    fireEvent.click(within(dlg).getByText(/Kite — €50\/pax/));
    expect(dlg).toHaveTextContent('Preco estimado c/ desconto: €1000'); /* 50 * 20, sem desconto */
    fireEvent.change(within(dlg).getByPlaceholderText('Ex: 15'), { target: { value: '10' } });
    expect(dlg).toHaveTextContent('Preco estimado c/ desconto: €900');
    expect(dlg).toHaveTextContent('(20 pax × 10% desconto)');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar cotacao' }));
    await waitFor(() => expect(createGroup).toHaveBeenCalledTimes(1));
    expect(createGroup).toHaveBeenCalledWith(expect.objectContaining({
      company: 'Empresa Nova', event_type: 'team_building', guests: 20, budget: 0, discount_pct: 10, signal_pct: 30, days_before: 7, tour_ids: ['u1'], status: 'pedido', date: '2027-02-01',
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Empresa Nova')).toBeInTheDocument();
  });

  it('editar_mostra_o_estado_e_chama_updateGroup_com_o_id_e_a_falha_mostra_o_erro', async () => {
    updateGroup.mockRejectedValueOnce(new Error('x'));
    await montar();
    abrir('Empresa Alfa');
    fireEvent.click(within(cartao('Empresa Alfa')).getAllByRole('button').at(-2));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Editar cotacao');
    expect(within(dlg).getByPlaceholderText('Ex: Empresa ABC')).toHaveValue('Empresa Alfa');
    const estado = within(dlg).getAllByRole('combobox')[1];
    expect(Array.from(estado.options).map(o => o.textContent)).toEqual(['Pedido', 'Em analise', 'Proposta enviada', 'Confirmado', 'Concluido', 'Cancelado']);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }));
    expect(await within(dlg).findByText('Erro ao guardar cotacao.')).toBeInTheDocument();
    updateGroup.mockImplementation(async (id, d) => ({ ...GRUPOS[0], ...d }));
    fireEvent.change(estado, { target: { value: 'confirmado' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateGroup).toHaveBeenLastCalledWith('g1', expect.objectContaining({ status: 'confirmado', company: 'Empresa Alfa', guests: 20 })));
  });
});

/* ───────────────────────── design system ───────────────────────── */

describe('Grupos com o design system', () => {
  it('o_estado_e_Badge_com_a_variante_certa', async () => {
    await montar();
    const selo = (nome, texto) => within(cartao(nome)).getAllByText(texto).find(e => e.className.includes('inline-flex'));
    expect(selo('Empresa Alfa', 'Pedido').className).toContain('bg-n-100');
    expect(selo('Analise Lda', 'Em analise').className).toContain('var(--warning)');
    expect(selo('Proposta Lda', 'Proposta enviada').className).toContain('var(--info)');
    expect(selo('Hotel Beta', 'Confirmado').className).toContain('var(--success)');
    expect(selo('Cancelada SA', 'Cancelado').className).toContain('var(--error)');
  });

  it('os_chips_tem_aria_pressed_e_a_pesquisa_nome_acessivel', async () => {
    await montar();
    expect(screen.getByRole('button', { name: 'Todos', pressed: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmado', pressed: false }));
    expect(screen.getByRole('button', { name: 'Confirmado', pressed: true })).toBeInTheDocument();
    expect(screen.getByLabelText('Pesquisar empresa ou grupo')).toBeInTheDocument();
  });

  it('o_cabecalho_do_cartao_e_um_botao_com_aria_expanded_que_abre_com_teclado', async () => {
    await montar();
    const cab = screen.getByRole('button', { name: /^Empresa Alfa/, expanded: false });
    fireEvent.keyDown(cab, { key: 'Enter' });
    expect(screen.getByRole('button', { name: /^Empresa Alfa/, expanded: true })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: /^Empresa Alfa/, expanded: true }), { key: ' ' });
    expect(screen.getByRole('button', { name: /^Empresa Alfa/, expanded: false })).toBeInTheDocument();
  });

  it('os_botoes_de_icone_e_os_campos_dos_modais_tem_nome_acessivel', async () => {
    await montar();
    abrir('Empresa Alfa');
    expect(screen.getByRole('button', { name: 'Eliminar Empresa Alfa' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar Empresa Alfa' }));
    let modal = within(screen.getByRole('dialog'));
    ['Empresa / Grupo', 'Tipo de evento', 'Data pretendida', 'Numero de pessoas', 'Desconto de grupo (%)', 'Orcamento estimado (€)', 'Sinal (%)', 'Restante X dias antes', 'Validade da proposta', 'Notas especiais', 'Estado']
      .forEach(r => expect(modal.getByLabelText(r)).toBeInTheDocument());
    fireEvent.click(modal.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(within(cartao('Empresa Alfa')).getByText('Registar pagamento'));
    modal = within(screen.getByRole('dialog'));
    ['Montante recebido (€)', 'Data', 'Descricao'].forEach(r => expect(modal.getByLabelText(r)).toBeInTheDocument());
  });

  it('o_vazio_usa_o_EmptyState', async () => {
    listGroups.mockResolvedValue([]);
    render(<Groups />);
    expect(await screen.findByText('Sem cotacoes')).toHaveClass('font-display');
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error_com_tudo_aberto', async () => {
    updateGroup.mockRejectedValue(new Error('x'));
    const { container } = await montar();
    abrir('Empresa Alfa');
    abrir('Cancelada SA');
    fireEvent.click(within(cartao('Empresa Alfa')).getAllByRole('button').at(-2));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }));
    await screen.findByText('Erro ao guardar cotacao.');
    const html = container.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  });
});
