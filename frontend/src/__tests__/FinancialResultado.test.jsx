import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ResultadoTab from '../pages/financial/ResultadoTab';
import { fmtEixo, fmtDica } from '../pages/financial/shared';
import { exportExcel, exportPdf, getReceita } from '../services/financeiroService';
import { listExpenses, getSalaryPayments } from '../services/expensesService';
import { coresDosGraficos, dadosDoGrafico } from './helpers/rechartsMock';
import { MES, norm, eur, cve } from './helpers/financeFixtures';

vi.mock('../services/financeiroService', () => ({ exportExcel: vi.fn(), exportPdf: vi.fn(), getReceita: vi.fn() }));
vi.mock('../services/expensesService', () => ({ listExpenses: vi.fn(), getSalaryPayments: vi.fn() }));
vi.mock('recharts', async () => (await import('./helpers/rechartsMock')).makeRechartsMock());

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const AGORA = new Date();
const MES_NUM = AGORA.getMonth() + 1;
const ANO_NUM = AGORA.getFullYear();
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const MES_ANT_D = new Date(ANO_NUM, AGORA.getMonth() - 1, 1);
const MES_ANT = ym(MES_ANT_D);

const PERIODO = { inicio: `${MES}-01`, fim: `${MES}-28` };
const RESUMO = { atual: { receita: 1000, num_reservas: 10 } };
const DESPESAS = [
  { id: 'e1', amount: 300, date: `${MES}-05` },
  { id: 'e2', amount: 100, date: `${MES}-28` },
  { id: 'e3', amount: 500, date: `${MES_ANT}-10` },
];
const PAGAMENTOS = [
  { staffId: 's1', month: MES_NUM, year: ANO_NUM, amount: 200 },
  { staffId: 's1', month: MES_ANT_D.getMonth() + 1, year: MES_ANT_D.getFullYear(), amount: 50 },
];
/* a forma real da API: GET /financial/receita?granularidade=month devolve { periodo: 'YYYY-MM', receita, num_reservas } */
const MENSAL = [
  { periodo: MES, receita: 700, num_reservas: 7 },
  { periodo: MES_ANT, receita: 500.4, num_reservas: 5 },
];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

let spyErr; let spyWarn;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  listExpenses.mockResolvedValue(DESPESAS);
  getSalaryPayments.mockResolvedValue(PAGAMENTOS);
  exportExcel.mockResolvedValue();
  exportPdf.mockResolvedValue();
  getReceita.mockResolvedValue(MENSAL);
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

async function montar(props = {}) {
  const r = render(<ResultadoTab resumo={RESUMO} currency="EUR" periodo={PERIODO} {...props} />);
  await screen.findByText('Decomposição do resultado');
  return r;
}
const cartao = (rotulo) => screen.getByText(rotulo, { selector: 'p' });
const valor = (rotulo) => norm(cartao(rotulo).closest('article').querySelector('p.font-display').textContent);
/* o tom vem da pequena caixa (ou ponto) do MareStat: turquesa = bom, areia = aviso, sem marca = neutro */
function tom(el) {
  const marca = el && el.querySelector('[data-mare-stat-tint]');
  if (!marca) return 'neutro';
  if (/turquoise/.test(marca.className)) return 'bom';
  if (/sand/.test(marca.className)) return 'aviso';
  return 'neutro';
}
const tomDe = (rotulo) => tom(cartao(rotulo).closest('article'));

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Resultado', () => {
  it('despesas_so_do_periodo_seleccionado_nao_do_mes_corrente', async () => {
    await montar();
    expect(valor('Despesas operacionais')).toBe(eur(400)); /* e1 + e2; e3 e do mes anterior */
  });

  it('periodo_de_dois_meses_soma_despesas_e_folha_dos_dois', async () => {
    await montar({ periodo: { inicio: `${MES_ANT}-01`, fim: `${MES}-28` } });
    expect(valor('Despesas operacionais')).toBe(eur(900));
    expect(valor('Folha salarial')).toBe(eur(250)); /* 200 + 50 por ano-mes */
  });

  it('folha_so_dos_pagamentos_do_periodo_por_ano_mes', async () => {
    await montar();
    expect(valor('Folha salarial')).toBe(eur(200));
  });

  it('resultado_e_receita_menos_despesas_menos_folha_e_margem_sobre_a_receita', async () => {
    await montar();
    expect(valor('Receita bruta')).toBe(eur(1000));
    expect(valor('Resultado líquido')).toBe(eur(400)); /* 1000 - 400 - 200 */
    expect(valor('Margem')).toBe('40.0%');
    expect(valor('Reservas no período')).toBe('10');
  });

  it('margem_com_tom_bom_ou_aviso_nos_limiares_20_e_0', async () => {
    await montar({ resumo: { atual: { receita: 750 } } }); /* resultado 150 => 20% exacto */
    expect(valor('Margem')).toBe('20.0%');
    expect(tomDe('Margem')).toBe('bom');
    cleanup();
    await montar({ resumo: { atual: { receita: 700 } } }); /* 100 => 14.3% */
    expect(tomDe('Margem')).toBe('aviso');
    cleanup();
    await montar({ resumo: { atual: { receita: 600 } } }); /* 0 => 0.0% */
    expect(valor('Margem')).toBe('0.0%');
    expect(tomDe('Margem')).toBe('aviso');
    cleanup();
    await montar({ resumo: { atual: { receita: 100 } } }); /* -500 */
    expect(tomDe('Margem')).toBe('aviso');
    expect(tomDe('Resultado líquido')).toBe('aviso');
    cleanup();
    await montar();
    expect(tomDe('Margem')).toBe('bom');
    expect(tomDe('Resultado líquido')).toBe('bom');
    expect(tomDe('Despesas operacionais')).toBe('neutro');
    expect(tomDe('Folha salarial')).toBe('neutro');
  });

  it('sem_receita_a_margem_e_zero_e_os_dados_em_falta_dao_travessao', async () => {
    await montar({ resumo: null });
    expect(valor('Receita bruta')).toBe(eur(0));
    expect(valor('Margem')).toBe('0.0%');
    expect(valor('Reservas no período')).toBe('—');
  });

  it('decomposicao_mostra_sinais_e_o_valor_absoluto_do_resultado', async () => {
    await montar();
    const caixa = screen.getByText('Decomposição do resultado').parentElement;
    expect(within(caixa).getByText(`+ ${eur(1000)}`)).toBeInTheDocument();
    expect(within(caixa).getByText(`− ${eur(400)}`)).toBeInTheDocument();
    expect(within(caixa).getByText(`− ${eur(200)}`)).toBeInTheDocument();
    expect(within(caixa).getByText(`+ ${eur(400)}`)).toBeInTheDocument();
    cleanup();
    await montar({ resumo: { atual: { receita: 100 } } });
    const outra = screen.getByText('Decomposição do resultado').parentElement;
    expect(within(outra).getByText(`− ${eur(500)}`, { selector: 'span.text-base' })).toBeInTheDocument();
  });

  it('grafico_dos_ultimos_6_meses_soma_despesas_e_folha_por_mes', async () => {
    await montar();
    const d = dadosDoGrafico('bar');
    expect(d).toHaveLength(6);
    const esperados = Array.from({ length: 6 }, (_, i) => MESES_PT[new Date(ANO_NUM, AGORA.getMonth() - (5 - i), 1).getMonth()]);
    expect(d.map(x => x.name)).toEqual(esperados);
    const atual = d[5]; const anterior = d[4];
    expect(atual.despesas).toBe(300 + 100 + 200);
    expect(anterior.despesas).toBe(500 + 50);
    expect(d[0].despesas).toBe(0);
    expect(screen.getByText('Receitas vs Despesas — últimos 6 meses')).toBeInTheDocument();
  });

  it('receita_do_grafico_vem_da_API_mensal_dos_ultimos_6_meses_com_a_forma_real_periodo_receita', async () => {
    await montar();
    const d = dadosDoGrafico('bar');
    expect(d[5].receita).toBe(700);
    expect(d[4].receita).toBe(500);
    expect(d.slice(0, 4).map(x => x.receita)).toEqual([0, 0, 0, 0]);
    const inicio = ymd(new Date(ANO_NUM, AGORA.getMonth() - 5, 1));
    const fim = ymd(new Date(ANO_NUM, AGORA.getMonth() + 1, 0));
    expect(getReceita).toHaveBeenCalledTimes(1);
    expect(getReceita).toHaveBeenCalledWith(inicio, fim, 'month');
  });

  it('o_intervalo_pedido_atravessa_a_viragem_do_ano_sem_ficar_limitado_ao_ano_corrente', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2027, 1, 10, 12, 0, 0));
    try {
      await montar();
      expect(getReceita).toHaveBeenCalledWith('2026-09-01', '2027-02-28', 'month');
    } finally { vi.useRealTimers(); }
  });

  it('getReceita_a_falhar_ou_nulo_deixa_o_grafico_a_zero_sem_rebentar', async () => {
    getReceita.mockRejectedValue(new Error('x'));
    await montar();
    expect(dadosDoGrafico('bar').map(x => x.receita)).toEqual([0, 0, 0, 0, 0, 0]);
    cleanup();
    getReceita.mockResolvedValue(null);
    await montar();
    expect(dadosDoGrafico('bar').map(x => x.receita)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('exportar_chama_exportPdf_e_exportExcel_com_o_periodo', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }));
    await waitFor(() => expect(exportPdf).toHaveBeenCalledWith(PERIODO.inicio, PERIODO.fim));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));
    await waitFor(() => expect(exportExcel).toHaveBeenCalledWith(PERIODO.inicio, PERIODO.fim));
  });

  it('moeda_cve_converte_os_cartoes_e_tambem_o_grafico', async () => {
    const { unmount } = await montar();
    const eur = dadosDoGrafico('bar');
    unmount();
    await montar({ currency: 'CVE' });
    expect(valor('Receita bruta')).toBe(cve(1000));
    expect(valor('Resultado líquido')).toBe(cve(400));
    const emCve = dadosDoGrafico('bar');
    expect(eur[5].receita).toBe(700);
    expect(emCve[5].receita).toBe(700 * 110);
    emCve.forEach((m, i) => expect(m.despesas).toBe(eur[i].despesas * 110));
  });

  it('os_eixos_e_a_dica_do_grafico_seguem_a_moeda', () => {
    expect(fmtEixo(77000, 'CVE')).toBe('77k CVE');
    expect(fmtEixo(500, 'CVE')).toBe('500 CVE');
    expect(fmtEixo(7000, 'EUR')).toBe('€7k');
    expect(fmtEixo(500, 'EUR')).toBe('€500');
    expect(fmtDica(77000, 'CVE')).toBe(`${(77000).toLocaleString('pt-PT')} CVE`);
    expect(fmtDica(700, 'EUR')).toBe('€700');
  });

  it('em_carga_mostra_o_spinner', () => {
    listExpenses.mockReturnValue(new Promise(() => {}));
    render(<ResultadoTab resumo={RESUMO} currency="EUR" periodo={PERIODO} />);
    expect(screen.queryByText('Decomposição do resultado')).toBeNull();
  });
});

/* ───────────────────────── design system ───────────────────────── */

describe('Resultado com o design system', () => {
  it('os_tons_dos_quadros_nao_tingem_o_valor_e_a_decomposicao_usa_tokens', async () => {
    await montar();
    expect(cartao('Resultado líquido').closest('article').querySelector('p.font-display').className).not.toMatch(/success|error|warning/);
    const caixa = screen.getByText('Decomposição do resultado').parentElement;
    expect(within(caixa).getByText(`− ${eur(400)}`).className).toContain('var(--error)');
    expect(within(caixa).getByText(`+ ${eur(400)}`).className).toContain('var(--success)');
    cleanup();
    await montar({ resumo: { atual: { receita: 700 } } });
    expect(tomDe('Margem')).toBe('aviso');
  });

  it('as_cores_do_grafico_sao_tokens', async () => {
    await montar();
    const cores = coresDosGraficos();
    expect(cores).toHaveLength(5); /* grelha, dois eixos e duas barras: a dica e a caixa partilhada, sem borda propria */
    expect(cores.filter(c => !/^var\(--/.test(c))).toEqual([]);
  });

  it('sem_hexadecimais_cores_nomeadas_ou_text_error', async () => {
    await montar();
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/);
    expect(html).not.toMatch(/(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border)-(?:green|yellow|blue|red)-\d/);
    expect(html).not.toMatch(/text-error/);
    expect(html).not.toMatch(/text-\[#/);
  });
});

/* ───────────────────────── estilo Mare ───────────────────────── */

const CARTAO_MARE = ['bg-white', 'border', 'border-mare-card', 'rounded-[18px]'];
/* o valor do quadro MareStat (sem depender da ordem dos elementos) */
const valorMare = (rotulo) => norm(cartao(rotulo).closest('article').querySelector('p.font-display').textContent);

describe('Resultado no estilo Mare', () => {
  it('os_seis_quadros_sao_MareStat_com_os_mesmos_valores', async () => {
    await montar();
    for (const r of ['Receita bruta', 'Despesas operacionais', 'Folha salarial', 'Resultado líquido', 'Margem', 'Reservas no período']) {
      expect(cartao(r).closest('article')).toHaveClass(...CARTAO_MARE);
    }
    expect(valorMare('Receita bruta')).toBe(eur(1000));
    expect(valorMare('Despesas operacionais')).toBe(eur(400));
    expect(valorMare('Folha salarial')).toBe(eur(200));
    expect(valorMare('Resultado líquido')).toBe(eur(400));
    expect(valorMare('Margem')).toBe('40.0%');
    expect(valorMare('Reservas no período')).toBe('10');
  });

  it('o_tom_do_quadro_acompanha_o_sinal_e_a_margem_sem_tingir_o_valor', async () => {
    const tinta = (rotulo) => cartao(rotulo).closest('article').querySelector('[data-mare-stat-tint]');
    await montar();
    expect(tinta('Resultado líquido').className).toContain('turquoise');
    expect(tinta('Margem').className).toContain('turquoise');
    cleanup();
    await montar({ resumo: { atual: { receita: 700 } } });
    expect(tinta('Margem').className).toContain('sand');
    cleanup();
    await montar({ resumo: { atual: { receita: 100 } } });
    expect(tinta('Resultado líquido').className).toContain('sand');
  });

  it('o_grafico_e_a_decomposicao_sao_cartoes_Mare_com_titulo_Sora', async () => {
    await montar();
    for (const titulo of ['Receitas vs Despesas — últimos 6 meses', 'Decomposição do resultado']) {
      const h = screen.getByText(titulo, { selector: 'h3' });
      expect(h).toHaveClass('font-display', 'text-lg', 'font-semibold', 'text-ocean-900');
      expect(h.closest('.border-mare-card')).toHaveClass(...CARTAO_MARE, 'p-[22px]');
    }
  });

  it('os_valores_da_decomposicao_usam_mono_tabular', async () => {
    await montar();
    const caixa = screen.getByText('Decomposição do resultado').parentElement;
    const v = within(caixa).getByText(`+ ${eur(1000)}`);
    expect(v).toHaveClass('font-mono', 'tabular-nums');
  });

  it('o_grafico_segue_a_linguagem_dos_graficos_sem_grelha_vertical_e_com_as_mesmas_series', async () => {
    await montar();
    const barras = document.querySelector('[data-chart="bar"]');
    expect(barras.getAttribute('data-grid-vertical')).toBe('false');
    expect(JSON.parse(barras.getAttribute('data-keys'))).toEqual(['receita', 'despesas']);
  });

  it('acertos_finais_ticks_de_12_px_e_dica_partilhada_do_grafico', async () => {
    await montar();
    const barras = document.querySelector('[data-chart="bar"]');
    expect(JSON.parse(barras.getAttribute('data-tick-sizes'))).toEqual([12, 12]);
    expect(barras.getAttribute('data-tooltip-custom')).toBe('true');
    expect(barras.getAttribute('data-tooltip-styled')).toBe('false');
  });

  it('sem_dados_o_grafico_mantem_os_seis_meses_a_zero', async () => {
    getReceita.mockResolvedValue([]);
    listExpenses.mockResolvedValue([]);
    getSalaryPayments.mockResolvedValue([]);
    await montar();
    const d = dadosDoGrafico('bar');
    expect(d).toHaveLength(6);
    expect(d.every(m => m.receita === 0 && m.despesas === 0)).toBe(true);
  });
});
