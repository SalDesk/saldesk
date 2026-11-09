import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
