import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Loyalty from '../pages/Loyalty';
import { listCustomers } from '../services/customersService';
import {
  getLoyaltyConfig, updateLoyaltyConfig,
  getCustomerLoyaltyHistory, adjustCustomerPoints, redeemCustomerPoints,
} from '../services/loyaltyService';

vi.mock('../services/customersService', () => ({ listCustomers: vi.fn() }));
vi.mock('../services/loyaltyService', () => ({
  getLoyaltyConfig: vi.fn(), updateLoyaltyConfig: vi.fn(),
  getCustomerLoyaltyHistory: vi.fn(), adjustCustomerPoints: vi.fn(), redeemCustomerPoints: vi.fn(),
}));

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;

const NIVEIS = [
  { name: 'Bronze', min: 0,   max: 100,  discount_pct: 5,  reward: '5% desconto em todas as reservas' },
  { name: 'Prata',  min: 101, max: 499,  discount_pct: 10, reward: '10% desconto + upgrade gratuito disponivel' },
  { name: 'Ouro',   min: 500, max: null, discount_pct: 15, reward: '15% desconto + tour gratuito por ano' },
];

let spyErr; let spyWarn;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  getLoyaltyConfig.mockReset().mockResolvedValue({});
  updateLoyaltyConfig.mockReset().mockResolvedValue({});
  listCustomers.mockReset().mockResolvedValue([]);
  getCustomerLoyaltyHistory.mockReset().mockResolvedValue([]);
  adjustCustomerPoints.mockReset();
  redeemCustomerPoints.mockReset();
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
  const r = render(<Loyalty />);
  await screen.findByText(/^Programa (activo|inactivo)$/);
  return r;
}
/* o interruptor e o primeiro botao do bloco do estado do programa */
const interruptor = () => screen.getByText(/^Programa (activo|inactivo)$/).parentElement.parentElement.querySelector('button');
/* campo (input) de uma etiqueta visivel: etiqueta e campo sao irmaos dentro do mesmo bloco */
const campo = (etiqueta) => screen.getByText(etiqueta).parentElement.querySelector('input');
/* cabecalho clicavel do nivel: o p com o intervalo fica dentro do bloco de texto, dentro do cabecalho */
const cabecalhoNivel = (intervalo) => screen.getByText(intervalo).parentElement.parentElement;
const abrirNivel = (intervalo) => fireEvent.click(cabecalhoNivel(intervalo));
const separador = (rotulo) => screen.getAllByText(rotulo).find(e => e.closest('button')).closest('button');

/* ───────────────────────── caracterizacao: estrutura e configuracao ───────────────────────── */

describe('Fidelidade: cabecalho, estado e configuracao', () => {
  it('mostra_o_cabecalho_e_o_estado_inactivo_por_omissao', async () => {
    await montar();
    expect(screen.getByText('Programa de Fidelidade')).toBeInTheDocument();
    expect(screen.getByText('Configure niveis, pontos e recompensas')).toBeInTheDocument();
    expect(screen.getByText('Programa inactivo')).toBeInTheDocument();
    expect(screen.getByText('Active o programa para comecar a atribuir pontos aos clientes.')).toBeInTheDocument();
    expect(screen.getByText('Regra de acumulacao')).toBeInTheDocument();
    expect(screen.getByText('Niveis e recompensas')).toBeInTheDocument();
    expect(campo('Pontos por Euro gasto')).toHaveValue(1);
    expect(screen.getByText('0–100 pts · 5% desconto')).toBeInTheDocument();
    expect(screen.getByText('101–499 pts · 10% desconto')).toBeInTheDocument();
    expect(screen.getByText('500–∞ pts · 15% desconto')).toBeInTheDocument();
  });

  it('config_carregada_substitui_os_valores_por_omissao_e_mostra_programa_activo', async () => {
    getLoyaltyConfig.mockResolvedValue({
      active: true, points_per_euro: 2,
      levels: [{ name: 'Bronze', min: 0, max: 50, discount_pct: 3, reward: 'R1' }, { name: 'Prata', min: 51, max: 200, discount_pct: 7, reward: 'R2' }, { name: 'Ouro', min: 201, max: null, discount_pct: 12, reward: 'R3' }],
    });
    await montar();
    expect(screen.getByText('Programa activo')).toBeInTheDocument();
    expect(screen.getByText('Os clientes acumulam pontos automaticamente apos cada reserva.')).toBeInTheDocument();
    expect(campo('Pontos por Euro gasto')).toHaveValue(2);
    expect(screen.getByText('Ex: reserva de €100 = 200 pontos.')).toBeInTheDocument();
    expect(screen.getByText('0–50 pts · 3% desconto')).toBeInTheDocument();
    expect(screen.getByText('201–∞ pts · 12% desconto')).toBeInTheDocument();
  });

  it('getLoyaltyConfig_a_falhar_mantem_a_configuracao_por_omissao', async () => {
    getLoyaltyConfig.mockRejectedValue(new Error('x'));
    await montar();
    expect(screen.getByText('Programa inactivo')).toBeInTheDocument();
    expect(screen.getByText('0–100 pts · 5% desconto')).toBeInTheDocument();
  });

  it('em_carga_mostra_o_spinner', () => {
    getLoyaltyConfig.mockReturnValue(new Promise(() => {}));
    const { container } = render(<Loyalty />);
    expect(screen.getByText('Programa de Fidelidade')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Regra de acumulacao')).not.toBeInTheDocument();
  });

  it('interruptor_chama_updateLoyaltyConfig_com_active_invertido_e_levels_e_points_per_euro', async () => {
    await montar();
    fireEvent.click(interruptor());
    expect(updateLoyaltyConfig).toHaveBeenCalledWith({ active: true, points_per_euro: 1, levels: NIVEIS });
    expect(await screen.findByText('Programa activo')).toBeInTheDocument();
    fireEvent.click(interruptor());
    expect(updateLoyaltyConfig).toHaveBeenLastCalledWith({ active: false, points_per_euro: 1, levels: NIVEIS });
    expect(await screen.findByText('Programa inactivo')).toBeInTheDocument();
  });

  it('falha_ao_guardar_mantem_a_interface_optimista', async () => {
    updateLoyaltyConfig.mockRejectedValue(new Error('x'));
    await montar();
    fireEvent.click(interruptor());
    await waitFor(() => expect(updateLoyaltyConfig).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Programa activo')).toBeInTheDocument();
  });

  it('alterar_pontos_por_euro_chama_updateLoyaltyConfig_com_numero_e_actualiza_o_exemplo', async () => {
    await montar();
    expect(screen.getByText('Ex: reserva de €100 = 100 pontos.')).toBeInTheDocument();
    fireEvent.change(campo('Pontos por Euro gasto'), { target: { value: '2.5' } });
    expect(updateLoyaltyConfig).toHaveBeenCalledWith({ active: false, points_per_euro: 2.5, levels: NIVEIS });
    expect(screen.getByText('Ex: reserva de €100 = 250 pontos.')).toBeInTheDocument();
    /* campo vazio vira 0 e envia um pedido por alteracao (decisao 10d) */
    fireEvent.change(campo('Pontos por Euro gasto'), { target: { value: '' } });
    expect(updateLoyaltyConfig).toHaveBeenLastCalledWith({ active: false, points_per_euro: 0, levels: NIVEIS });
    expect(updateLoyaltyConfig).toHaveBeenCalledTimes(2);
  });
});

describe('Fidelidade: niveis', () => {
  it('niveis_mostram_nome_intervalo_e_desconto', async () => {
    await montar();
    expect(screen.getAllByText('Bronze').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Prata').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Ouro').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('500–∞ pts · 15% desconto')).toBeInTheDocument();
    expect(screen.queryByText('Desconto (%)')).not.toBeInTheDocument();
  });

  it('abrir_nivel_edita_desconto_recompensa_e_maximo_so_nos_dois_primeiros', async () => {
    await montar();
    abrirNivel('0–100 pts · 5% desconto');
    expect(campo('Desconto (%)')).toHaveValue(5);
    expect(campo('Descricao da recompensa')).toHaveValue('5% desconto em todas as reservas');
    expect(campo('Pontos maximo (nivel Bronze)')).toHaveValue(100);
    abrirNivel('0–100 pts · 5% desconto');
    expect(screen.queryByText('Desconto (%)')).not.toBeInTheDocument();
    abrirNivel('500–∞ pts · 15% desconto');
    expect(campo('Desconto (%)')).toHaveValue(15);
    expect(screen.queryByText('Pontos maximo (nivel Ouro)')).not.toBeInTheDocument();
  });

  it('guardar_nivel_chama_updateLoyaltyConfig_com_os_niveis_actualizados_e_fecha', async () => {
    await montar();
    abrirNivel('0–100 pts · 5% desconto');
    fireEvent.change(campo('Desconto (%)'), { target: { value: '9' } });
    fireEvent.change(campo('Descricao da recompensa'), { target: { value: 'Premio X' } });
    fireEvent.change(campo('Pontos maximo (nivel Bronze)'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(updateLoyaltyConfig).toHaveBeenCalledWith({
      active: false, points_per_euro: 1,
      levels: [{ name: 'Bronze', min: 0, max: 150, discount_pct: 9, reward: 'Premio X' }, NIVEIS[1], NIVEIS[2]],
    });
    expect(screen.queryByText('Desconto (%)')).not.toBeInTheDocument();
    expect(screen.getByText('0–150 pts · 9% desconto')).toBeInTheDocument();
  });

  it('maximo_vazio_vira_sem_limite', async () => {
    await montar();
    abrirNivel('101–499 pts · 10% desconto');
    fireEvent.change(campo('Pontos maximo (nivel Prata)'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(updateLoyaltyConfig.mock.calls[0][0].levels[1].max).toBeNull();
  });

  it('cancelar_nivel_repoe_o_rascunho_e_fecha', async () => {
    await montar();
    abrirNivel('0–100 pts · 5% desconto');
    fireEvent.change(campo('Desconto (%)'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('Desconto (%)')).not.toBeInTheDocument();
    expect(updateLoyaltyConfig).not.toHaveBeenCalled();
    abrirNivel('0–100 pts · 5% desconto');
    expect(campo('Desconto (%)')).toHaveValue(5);
  });

  it('o_separador_Clientes_so_carrega_a_lista_ao_abrir', async () => {
    await montar();
    expect(listCustomers).not.toHaveBeenCalled();
    fireEvent.click(separador('Clientes'));
    await waitFor(() => expect(listCustomers).toHaveBeenCalledWith({}));
  });
});

/* ───────────────────────── design system: estrutura, configuracao e niveis ───────────────────────── */

describe('Fidelidade: design system (estrutura e niveis)', () => {
  it('separadores_Configuracao_e_Clientes_sao_Tabs', async () => {
    await montar();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Configuracao' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Clientes' })).toHaveAttribute('aria-selected', 'false');
  });

  it('o_interruptor_tem_nome_e_aria_pressed', async () => {
    await montar();
    const b = screen.getByRole('button', { name: 'Programa de fidelidade' });
    expect(b).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(b);
    expect(await screen.findByRole('button', { name: 'Programa de fidelidade', pressed: true })).toBeInTheDocument();
    expect(screen.getByText('Programa activo').className).toContain('var(--success)');
  });

  it('o_nivel_e_Badge_com_a_variante_certa_e_nome_desconhecido_cai_em_Bronze', async () => {
    getLoyaltyConfig.mockResolvedValue({ levels: [...NIVEIS.slice(0, 2), { name: 'Platina', min: 500, max: null, discount_pct: 20, reward: 'P' }, NIVEIS[2]] });
    await montar();
    const selo = (nome) => screen.getAllByText(nome).find(e => e.className.includes('inline-flex'));
    expect(selo('Bronze').className).toContain('var(--warning-light)');
    expect(selo('Prata').className).toContain('bg-n-100');
    expect(selo('Ouro').className).toContain('bg-sand-50');
    expect(selo('Platina').className).toContain('var(--warning-light)');
  });

  it('o_cabecalho_do_nivel_tem_aria_expanded_e_abre_com_Enter_e_Espaco', async () => {
    await montar();
    const cab = cabecalhoNivel('0–100 pts · 5% desconto');
    expect(cab).toHaveAttribute('role', 'button');
    expect(cab).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(cab, { key: 'Enter' });
    expect(cab).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Desconto (%)')).toBeInTheDocument();
    fireEvent.keyDown(cab, { key: ' ' });
    expect(cab).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Desconto (%)')).not.toBeInTheDocument();
  });

  it('os_campos_da_configuracao_e_dos_niveis_tem_nome_acessivel', async () => {
    await montar();
    expect(screen.getByLabelText('Pontos por Euro gasto')).toHaveValue(1);
    abrirNivel('0–100 pts · 5% desconto');
    expect(screen.getByLabelText('Desconto (%)')).toHaveValue(5);
    expect(screen.getByLabelText('Descricao da recompensa')).toBeInTheDocument();
    expect(screen.getByLabelText('Pontos maximo (nivel Bronze)')).toHaveValue(100);
  });

  it('sem_hexadecimais_cores_nomeadas_text_error_nem_style_inline_com_a_config_activa_e_um_nivel_aberto', async () => {
    getLoyaltyConfig.mockResolvedValue({ active: true });
    const { container } = await montar();
    abrirNivel('101–499 pts · 10% desconto');
    const html = container.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
  });
});

/* ───────────────────────── caracterizacao: clientes e modal de pontos ───────────────────────── */

const norm = (t) => t.replace(/\s/g, ' ');
const CLIENTES = [
  { id: 'c3', name: 'Carla Lopes', email: null, loyalty_points: 40 },
  { id: 'c1', name: 'Ana Silva', email: 'ana@x.test', total_visits: 5, loyalty_points: 1500 },
  { id: 'c4', name: 'Diogo Zero', email: 'd@x.test', total_visits: 1, loyalty_points: null },
  { id: 'c2', name: 'Bruno Dias', email: 'bruno@x.test', total_visits: 2, loyalty_points: '150' },
];
const linha = (nome) => screen.getByText(nome).closest('tr');
const nomesPorOrdem = () => screen.getAllByRole('row').slice(1).map(r => r.querySelector('td').textContent);
const chip = (rotulo) => screen.getAllByText(rotulo).find(e => e.closest('button')).closest('button');
const cartaoNivel = (rotulo) => screen.getAllByText(rotulo).find(e => e.tagName === 'P').previousSibling.textContent;
const visitas = (tr) => tr.querySelectorAll('td')[2].textContent;
async function abrirClientes(lista = CLIENTES) {
  listCustomers.mockResolvedValue(lista);
  const r = await montar();
  fireEvent.click(separador('Clientes'));
  await screen.findByText(lista[0].name);
  return r;
}
const ajustar = (nome) => fireEvent.click(linha(nome).querySelector('button'));
const modo = (rotulo) => screen.getAllByText(rotulo).find(e => e.closest('button')).closest('button');

describe('Fidelidade: clientes', () => {
  it('ordena_por_pontos_decrescentes_e_mostra_nome_email_visitas_pontos_nivel_e_recompensa', async () => {
    await abrirClientes();
    expect(nomesPorOrdem()).toEqual(['Ana Silva', 'Bruno Dias', 'Carla Lopes', 'Diogo Zero']);
    const t = norm(linha('Ana Silva').textContent);
    expect(t).toContain('ana@x.test');
    expect(t).toContain(norm(`${(1500).toLocaleString('pt-PT')} pts`));
    expect(t).toContain('Ouro');
    expect(t).toContain('15% desconto + tour gratuito por ano');
    expect(visitas(linha('Ana Silva'))).toBe('5');
    expect(norm(linha('Bruno Dias').textContent)).toContain('Prata');
  });

  it('o_nivel_e_o_maior_min_atingido_e_pontos_em_falta_sao_zero', async () => {
    await abrirClientes([
      { id: 'a', name: 'P100', loyalty_points: 100 }, { id: 'b', name: 'P101', loyalty_points: 101 },
      { id: 'c', name: 'P499', loyalty_points: 499 }, { id: 'd', name: 'P500', loyalty_points: 500 },
      { id: 'e', name: 'PNulo', loyalty_points: null }, { id: 'f', name: 'PEmFalta' },
    ]);
    const nivel = (n) => ['Bronze', 'Prata', 'Ouro'].find(l => norm(linha(n).textContent).includes(l));
    expect(nivel('P100')).toBe('Bronze');
    expect(nivel('P101')).toBe('Prata');
    expect(nivel('P499')).toBe('Prata');
    expect(nivel('P500')).toBe('Ouro');
    expect(nivel('PNulo')).toBe('Bronze');
    expect(norm(linha('PEmFalta').textContent)).toContain('0 pts');
  });

  it('email_e_visitas_em_falta_mostram_travessao_e_zero', async () => {
    await abrirClientes();
    const celulas = [...linha('Carla Lopes').querySelectorAll('td')].map(td => td.textContent);
    expect(celulas[1]).toBe('—');
    expect(celulas[2]).toBe('0');
  });

  it('so_o_primeiro_com_pontos_leva_a_estrela', async () => {
    await abrirClientes();
    expect(linha('Ana Silva').querySelector('svg.lucide-star')).toBeInTheDocument();
    expect(linha('Bruno Dias').querySelector('svg.lucide-star')).not.toBeInTheDocument();
    cleanup();
    await abrirClientes([{ id: 'z', name: 'Zero', loyalty_points: 0 }]);
    expect(linha('Zero').querySelector('svg.lucide-star')).not.toBeInTheDocument();
  });

  it('cartoes_total_e_clientes_por_nivel', async () => {
    await abrirClientes();
    expect(cartaoNivel('Total clientes')).toBe('4');
    expect(cartaoNivel('Bronze')).toBe('2');
    expect(cartaoNivel('Prata')).toBe('1');
    expect(cartaoNivel('Ouro')).toBe('1');
  });

  it('pesquisa_por_nome_ou_email_e_filtro_por_nivel_e_vazio_com_filtros', async () => {
    await abrirClientes();
    const pesquisa = screen.getByPlaceholderText('Pesquisar cliente...');
    fireEvent.change(pesquisa, { target: { value: 'BRUNO' } });
    expect(nomesPorOrdem()).toEqual(['Bruno Dias']);
    fireEvent.change(pesquisa, { target: { value: 'x.test' } });
    expect(nomesPorOrdem()).toEqual(['Ana Silva', 'Bruno Dias', 'Diogo Zero']);
    fireEvent.change(pesquisa, { target: { value: '' } });
    fireEvent.click(chip('Prata'));
    expect(nomesPorOrdem()).toEqual(['Bruno Dias']);
    fireEvent.click(chip('Bronze'));
    expect(nomesPorOrdem()).toEqual(['Carla Lopes', 'Diogo Zero']);
    fireEvent.change(pesquisa, { target: { value: 'ana' } });
    expect(screen.getByText('Sem clientes encontrados.')).toBeInTheDocument();
    fireEvent.click(chip('Todos'));
    expect(nomesPorOrdem()).toEqual(['Ana Silva']);
  });

  it('sem_clientes_mostra_o_vazio', async () => {
    listCustomers.mockResolvedValue([]);
    await montar();
    fireEvent.click(separador('Clientes'));
    expect(await screen.findByText('Sem clientes encontrados.')).toBeInTheDocument();
    expect(cartaoNivel('Total clientes')).toBe('0');
  });

  it('listCustomers_a_falhar_ou_nulo_nao_rebenta', async () => {
    listCustomers.mockRejectedValue(new Error('x'));
    await montar();
    fireEvent.click(separador('Clientes'));
    expect(await screen.findByText('Sem clientes encontrados.')).toBeInTheDocument();
    cleanup();
    listCustomers.mockResolvedValue(null);
    await montar();
    fireEvent.click(separador('Clientes'));
    expect(await screen.findByText('Sem clientes encontrados.')).toBeInTheDocument();
  });

  it('em_carga_mostra_o_spinner_e_nao_a_tabela', async () => {
    listCustomers.mockReturnValue(new Promise(() => {}));
    const { container } = await montar();
    fireEvent.click(separador('Clientes'));
    await waitFor(() => expect(container.querySelector('.animate-spin')).toBeInTheDocument());
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Sem clientes encontrados.')).not.toBeInTheDocument();
  });
});

describe('Fidelidade: modal de pontos', () => {
  it('abrir_o_modal_mostra_pontos_actuais_nivel_e_o_resgate_do_nivel', async () => {
    await abrirClientes();
    ajustar('Carla Lopes');
    expect(await screen.findByText('Pontos — Carla Lopes')).toBeInTheDocument();
    expect(screen.getByText('Pontos actuais').nextSibling.textContent).toBe('40');
    expect(screen.getByText('Resgatar nivel Bronze')).toBeInTheDocument();
    expect(screen.getByText('Troca todo o saldo por um voucher de 5% (uso unico).')).toBeInTheDocument();
    await waitFor(() => expect(getCustomerLoyaltyHistory).toHaveBeenCalledWith('c3'));
  });

  it('ajustar_adicionar_e_remover_chama_adjustCustomerPoints_com_delta_com_sinal_e_motivo_e_limpa_os_campos', async () => {
    adjustCustomerPoints.mockResolvedValue({ loyalty_points: 90 });
    await abrirClientes();
    ajustar('Carla Lopes');
    await screen.findByText('Pontos — Carla Lopes');
    fireEvent.change(campo('Quantidade de pontos'), { target: { value: '50' } });
    fireEvent.change(campo('Motivo'), { target: { value: 'Brinde' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }));
    await waitFor(() => expect(adjustCustomerPoints).toHaveBeenCalledWith('c3', 50, 'Brinde'));
    await waitFor(() => expect(campo('Quantidade de pontos')).toHaveValue(null));
    expect(campo('Motivo')).toHaveValue('');
    expect(screen.getByText('Pontos actuais').nextSibling.textContent).toBe('90');
    expect(norm(linha('Carla Lopes').textContent)).toContain('90 pts');
    await waitFor(() => expect(getCustomerLoyaltyHistory).toHaveBeenCalledTimes(2));
    adjustCustomerPoints.mockResolvedValue({ loyalty_points: 80 });
    fireEvent.click(modo('Remover'));
    fireEvent.change(campo('Quantidade de pontos'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }));
    await waitFor(() => expect(adjustCustomerPoints).toHaveBeenLastCalledWith('c3', -10, ''));
  });

  it('valor_invalido_mostra_Introduza um valor valido.', async () => {
    await abrirClientes();
    ajustar('Carla Lopes');
    await screen.findByText('Pontos — Carla Lopes');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }));
    expect(screen.getByText('Introduza um valor valido.')).toBeInTheDocument();
    fireEvent.change(campo('Quantidade de pontos'), { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }));
    expect(screen.getByText('Introduza um valor valido.')).toBeInTheDocument();
    expect(adjustCustomerPoints).not.toHaveBeenCalled();
  });

  it('falha_ao_ajustar_mostra_Erro ao actualizar pontos.', async () => {
    adjustCustomerPoints.mockRejectedValue(new Error('x'));
    await abrirClientes();
    ajustar('Carla Lopes');
    await screen.findByText('Pontos — Carla Lopes');
    fireEvent.change(campo('Quantidade de pontos'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }));
    expect(await screen.findByText('Erro ao actualizar pontos.')).toBeInTheDocument();
  });

  it('resultado_previsto_nunca_negativo_e_mostra_o_novo_nivel_so_se_muda', async () => {
    await abrirClientes();
    ajustar('Carla Lopes');
    await screen.findByText('Pontos — Carla Lopes');
    expect(screen.queryByText('Resultado')).not.toBeInTheDocument();
    fireEvent.change(campo('Quantidade de pontos'), { target: { value: '70' } });
    let caixa = screen.getByText('Resultado').parentElement;
    expect(norm(caixa.textContent)).toContain('110 pts');
    expect(caixa).toHaveTextContent('Prata');
    fireEvent.click(modo('Remover'));
    fireEvent.change(campo('Quantidade de pontos'), { target: { value: '100' } });
    caixa = screen.getByText('Resultado').parentElement;
    expect(norm(caixa.textContent)).toContain('0 pts');
    expect(caixa).not.toHaveTextContent('Prata');
    expect(caixa).not.toHaveTextContent('Bronze');
  });

  it('resgatar_chama_redeemCustomerPoints_mostra_voucher_codigo_e_validade_em_UTC', async () => {
    redeemCustomerPoints.mockResolvedValue({ voucher: { code: 'FID-AB12', value: 5, expires_at: '2027-01-15T00:00:00Z' }, loyalty_points: 0 });
    await abrirClientes();
    ajustar('Carla Lopes');
    await screen.findByText('Pontos — Carla Lopes');
    fireEvent.click(screen.getByRole('button', { name: 'Resgatar' }));
    expect(await screen.findByText('Voucher gerado — 5% de desconto')).toBeInTheDocument();
    expect(redeemCustomerPoints).toHaveBeenCalledWith('c3');
    expect(screen.getByText('FID-AB12')).toBeInTheDocument();
    expect(screen.getByText(`Uso unico, valido ate ${new Date('2027-01-15T00:00:00Z').toLocaleDateString('pt-PT', { timeZone: 'UTC' })}.`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resgatar' })).not.toBeInTheDocument();
    expect(screen.getByText('Pontos actuais').nextSibling.textContent).toBe('0');
    expect(norm(linha('Carla Lopes').textContent)).toContain('0 pts');
    await waitFor(() => expect(getCustomerLoyaltyHistory).toHaveBeenCalledTimes(2));
  });

  it('resgatar_fica_desactivado_sem_pontos_e_erro_do_servidor_ou_generico', async () => {
    await abrirClientes();
    ajustar('Diogo Zero');
    await screen.findByText('Pontos — Diogo Zero');
    expect(screen.getByRole('button', { name: 'Resgatar' })).toBeDisabled();
    cleanup();
    redeemCustomerPoints.mockRejectedValueOnce({ response: { data: { error: 'Saldo insuficiente' } } });
    await abrirClientes();
    ajustar('Carla Lopes');
    await screen.findByText('Pontos — Carla Lopes');
    fireEvent.click(screen.getByRole('button', { name: 'Resgatar' }));
    expect(await screen.findByText('Saldo insuficiente')).toBeInTheDocument();
    redeemCustomerPoints.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(screen.getByRole('button', { name: 'Resgatar' }));
    expect(await screen.findByText('Erro ao resgatar pontos.')).toBeInTheDocument();
  });

  it('copiar_codigo_chama_clipboard_e_mostra_o_visto_1500ms', async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    redeemCustomerPoints.mockResolvedValue({ voucher: { code: 'FID-AB12', value: 5, expires_at: '2027-01-15T00:00:00Z' }, loyalty_points: 0 });
    await abrirClientes();
    ajustar('Carla Lopes');
    await screen.findByText('Pontos — Carla Lopes');
    fireEvent.click(screen.getByRole('button', { name: 'Resgatar' }));
    await screen.findByText('FID-AB12');
    const copiar = screen.getByTitle('Copiar codigo');
    fireEvent.click(copiar);
    expect(writeText).toHaveBeenCalledWith('FID-AB12');
    await waitFor(() => expect(copiar.querySelector('svg.lucide-check')).toBeInTheDocument());
    await waitFor(() => expect(copiar.querySelector('svg.lucide-check')).not.toBeInTheDocument(), { timeout: 3000 });
  });

  it('historico_lista_movimentos_com_sinal_e_o_vazio_diz_Sem movimentos ainda.', async () => {
    getCustomerLoyaltyHistory.mockResolvedValue([
      { id: 'h1', type: 'earn', points: 50, reason: 'Reserva', created_at: '2026-11-01T12:00:00Z' },
      { id: 'h2', type: 'redeem', points: -30, created_at: '2026-11-02T12:00:00Z' },
      { id: 'h3', type: 'manual_adjust', points: 10, reason: '', created_at: '2026-11-03T12:00:00Z' },
      { id: 'h4', type: 'outro', points: -1, created_at: '2026-11-04T12:00:00Z' },
    ]);
    await abrirClientes();
    ajustar('Carla Lopes');
    expect(await screen.findByText('Ganho')).toBeInTheDocument();
    expect(screen.getByText('Resgate')).toBeInTheDocument();
    expect(screen.getByText('Ajuste manual')).toBeInTheDocument();
    expect(screen.getByText('outro')).toBeInTheDocument();
    expect(screen.getByText('+50')).toBeInTheDocument();
    expect(screen.getByText('-30')).toBeInTheDocument();
    expect(screen.getByText('+10')).toBeInTheDocument();
    expect(screen.getByText(/· Reserva/)).toBeInTheDocument();
    expect(screen.getByText(new Date('2026-11-01T12:00:00Z').toLocaleDateString('pt-PT'))).toBeInTheDocument();
    cleanup();
    getCustomerLoyaltyHistory.mockRejectedValue(new Error('x'));
    await abrirClientes();
    ajustar('Carla Lopes');
    expect(await screen.findByText('Sem movimentos ainda.')).toBeInTheDocument();
  });

  it('fechar_fecha_o_modal', async () => {
    await abrirClientes();
    ajustar('Carla Lopes');
    await screen.findByText('Pontos — Carla Lopes');
    fireEvent.click(screen.getAllByRole('button', { name: 'Fechar' })[0]);
    expect(screen.queryByText('Pontos — Carla Lopes')).not.toBeInTheDocument();
  });
});

/* ───────────────────────── design system: clientes e modal de pontos ───────────────────────── */

describe('Fidelidade: design system (clientes e modal)', () => {
  it('a_tabela_e_Table_com_as_sete_colunas', async () => {
    await abrirClientes();
    expect(screen.getByRole('table')).toBeInTheDocument();
    const cab = screen.getAllByRole('columnheader').map(h => h.textContent);
    expect(cab).toEqual(['Cliente', 'Email', 'Visitas', 'Pontos', 'Nivel', 'Recompensa', '']);
  });

  it('o_nivel_na_tabela_e_Badge_e_os_chips_tem_aria_pressed', async () => {
    await abrirClientes();
    const selo = within(linha('Ana Silva')).getByText('Ouro');
    expect(selo.className).toContain('bg-sand-50');
    expect(screen.getByRole('button', { name: 'Todos', pressed: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Prata' }));
    expect(screen.getByRole('button', { name: 'Prata', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todos', pressed: false })).toBeInTheDocument();
  });

  it('pesquisa_e_botao_de_icone_tem_nome_acessivel', async () => {
    await abrirClientes();
    expect(screen.getByLabelText('Pesquisar cliente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajustar pontos Ana Silva' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajustar pontos Diogo Zero' })).toBeInTheDocument();
  });

  it('os_campos_e_o_seletor_do_modal_tem_nome_e_aria_pressed', async () => {
    await abrirClientes();
    ajustar('Carla Lopes');
    await screen.findByText('Pontos — Carla Lopes');
    expect(screen.getByLabelText('Quantidade de pontos')).toBeInTheDocument();
    expect(screen.getByLabelText('Motivo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar', pressed: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(screen.getByRole('button', { name: 'Remover', pressed: true })).toBeInTheDocument();
  });

  it('o_botao_de_copiar_tem_nome_acessivel', async () => {
    redeemCustomerPoints.mockResolvedValue({ voucher: { code: 'FID-AB12', value: 5, expires_at: '2027-01-15T00:00:00Z' }, loyalty_points: 0 });
    await abrirClientes();
    ajustar('Carla Lopes');
    await screen.findByText('Pontos — Carla Lopes');
    fireEvent.click(screen.getByRole('button', { name: 'Resgatar' }));
    await screen.findByText('FID-AB12');
    expect(screen.getByRole('button', { name: 'Copiar codigo' })).toBeInTheDocument();
  });

  it('o_vazio_e_EmptyState', async () => {
    listCustomers.mockResolvedValue([]);
    await montar();
    fireEvent.click(separador('Clientes'));
    expect(await screen.findByText('Sem clientes encontrados.')).toHaveClass('font-display');
  });

  it('sem_hexadecimais_cores_nomeadas_text_error_nem_style_de_cor_nos_dois_separadores_e_no_modal', async () => {
    adjustCustomerPoints.mockRejectedValue(new Error('x'));
    redeemCustomerPoints.mockResolvedValue({ voucher: { code: 'FID-AB12', value: 5, expires_at: '2027-01-15T00:00:00Z' }, loyalty_points: 0 });
    getCustomerLoyaltyHistory.mockResolvedValue([
      { id: 'h1', type: 'earn', points: 50, created_at: '2026-11-01T12:00:00Z' },
      { id: 'h2', type: 'redeem', points: -30, created_at: '2026-11-02T12:00:00Z' },
      { id: 'h3', type: 'manual_adjust', points: 10, created_at: '2026-11-03T12:00:00Z' },
    ]);
    getLoyaltyConfig.mockResolvedValue({ active: true });
    await abrirClientes();
    let html = document.body.innerHTML;
    ajustar('Carla Lopes');
    await screen.findByText('Ganho');
    fireEvent.change(campo('Quantidade de pontos'), { target: { value: '70' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }));
    await screen.findByText('Erro ao actualizar pontos.');
    html += document.body.innerHTML;
    fireEvent.click(screen.getByRole('button', { name: 'Resgatar' }));
    await screen.findByText('FID-AB12');
    html += document.body.innerHTML;
    expect(html).not.toMatch(HEX);
    expect(html).not.toMatch(NOMEADAS);
    expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
    const comCor = [...document.body.querySelectorAll('[style]')].filter(e => /color|background/.test(e.getAttribute('style')));
    expect(comCor).toHaveLength(0);
  });
});
