import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Analytics from '../pages/Analytics';
import { getAnalyticsStats, getReviewsStats, getMarketingStats } from '../services/analyticsService';
import { listCustomers } from '../services/customersService';
import { getResumo, getUnidades } from '../services/financeiroService';
import { listUnits } from '../services/unitsService';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';
import { coresDosGraficos } from './helpers/rechartsMock';

/* Sem rede: so os servicos da pagina sao simulados */
vi.mock('../services/analyticsService', () => ({
  getAnalyticsStats: vi.fn(),
  getReviewsStats: vi.fn(),
  getMarketingStats: vi.fn(),
}));
vi.mock('../services/customersService', () => ({ listCustomers: vi.fn() }));
vi.mock('../services/financeiroService', () => ({ getResumo: vi.fn(), getUnidades: vi.fn() }));
vi.mock('../services/unitsService', () => ({ listUnits: vi.fn() }));

/* O ResponsiveContainer real nao desenha nada no jsdom: o recharts e simulado pelo helper partilhado,
   que expoe cores, dados, chaves das series e a grelha de cada grafico */
vi.mock('recharts', async () => (await import('./helpers/rechartsMock')).makeRechartsMock());

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const CHAVE = 'saldesk_competition_v1';

/* mesma formula da pagina: ultimos 30 dias em UTC */
function intervalo() {
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 29);
  const f = d => d.toISOString().slice(0, 10);
  return [f(inicio), f(fim)];
}
function eur(v) { return `€${Math.round(Number(v || 0)).toLocaleString('pt-PT')}`; }

/* crescimento 25 (var 25,4 > 20) + ocupacao 20 (70 > 60) + avaliacoes 16 (rating 4,2 >= 4,0) + fidelizacao 15 = 76 */
const RESUMO = { atual: { receita: 1234, num_reservas: 18, taxa_ocupacao: 70 }, variacao: { receita: 25.4, num_reservas: -8.2 } };

const UNIDADES = [
  { id: 'u1', name: 'Buggy Tour', base_price: 60 },
  { id: 'u2', name: 'Mergulho', base_price: 45 },
  { id: 'u3', name: 'Kitesurf', base_price: 20 },
  { id: 'u4', name: 'Barco', base_price: 35 },
  { id: 'u5', name: 'Quad', base_price: 41 },
  { id: 'u6', name: 'Passeio', base_price: 30 },
  { id: 'u7', name: 'Snorkel', base_price: 25 },
  { id: 'u8', name: 'Pesca', base_price: 80 },
  { id: 'u9', name: 'Extra nono', base_price: 99 },
];

/* GET /financial/unidades: reservas dos ultimos 30 dias por tour (so os 5 mais reservados aparecem) */
const DESEMPENHO = [
  { id: 'u1', name: 'Buggy Tour', num_reservas: 20, receita: 900, taxa_ocupacao: 40 },
  { id: 'u2', name: 'Mergulho', num_reservas: 15, receita: 600, taxa_ocupacao: 30 },
  { id: 'u3', name: 'Kitesurf', num_reservas: 10, receita: 300, taxa_ocupacao: 20 },
  { id: 'u4', name: 'Barco', num_reservas: 5, receita: 100, taxa_ocupacao: 10 },
  { id: 'u5', name: 'Quad', num_reservas: 2, receita: 0, taxa_ocupacao: 5 },
  { id: 'u6', name: 'Passeio', num_reservas: 25, receita: 1200, taxa_ocupacao: 50 },
  { id: 'u7', name: 'Snorkel', num_reservas: 1, receita: 0, taxa_ocupacao: 1 },
];

const CLIENTES = [
  { country_code: 'PT' }, { country_code: 'PT' }, { country_code: 'PT' },
  { country_code: 'GB' }, { country_code: 'GB' },
  { country_code: 'DE' }, { country_code: 'XX' },
  {}, { country_code: null },
];

/* classifica a cor do arco do medidor em bom / aviso / mau */
function tom(texto) {
  if (/--success/.test(texto)) return 'bom';
  if (/--sand-500/.test(texto)) return 'aviso';
  if (/--error/.test(texto)) return 'mau';
  return 'outro';
}

/* o ponto do quadro (MareStat sem icone) diz o tom: turquesa = bom, areia = aviso, oceano = neutro */
function tomDoQuadro(valorEl) {
  const ponto = valorEl.closest('article').querySelector('[data-mare-stat-tint]');
  if (!ponto) return 'neutro';
  if (/turquoise/.test(ponto.className)) return 'bom';
  if (/sand/.test(ponto.className)) return 'aviso';
  return 'neutro';
}

describe('Analytics', () => {
  let errSpy;
  let warnSpy;
  let abrir;
  let aleatorio;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    aleatorio = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    localStorage.clear();
    getResumo.mockReset().mockResolvedValue(RESUMO);
    getReviewsStats.mockReset().mockResolvedValue({ average: 4.2, total: 10 });
    getAnalyticsStats.mockReset().mockResolvedValue({});
    getMarketingStats.mockReset().mockResolvedValue({});
    listCustomers.mockReset().mockResolvedValue(CLIENTES);
    listUnits.mockReset().mockResolvedValue(UNIDADES);
    getUnidades.mockReset().mockResolvedValue(DESEMPENHO);
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    /* a guarda conta ANTES de restaurar os espioes */
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    vi.restoreAllMocks();
    expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  async function abre() {
    const r = render(
      <MemoryRouter future={FUTURE}>
        <Analytics />
      </MemoryRouter>
    );
    await screen.findByText('Score de Saúde do Negócio');
    return r;
  }

  /* cada seccao e um cartao: sobe do titulo ate ao cartao branco */
  function cartao(titulo) {
    return screen.getByText(titulo, { selector: 'h3' }).closest('section');
  }
  function resumo() {
    return screen.getByText('Resumo — Últimos 30 dias').parentElement;
  }
  /* valor de um quadro de numeros (MareStat): o rotulo e o valor vivem no mesmo <article> */
  function valor(raiz, rotulo) {
    return within(raiz).getByText(rotulo, { selector: 'p' }).closest('article').querySelector('p.font-display');
  }
  function graficos(nome) {
    return [...document.querySelectorAll(`[data-chart="${nome}"]`)];
  }
  function linhaDe(nome) {
    return screen.getAllByText(nome).find(e => e.closest('table')).closest('tr');
  }
  function circuloPreenchido() {
    return document.querySelector('svg circle[stroke-dasharray]');
  }

  it('pede_os_ultimos_30_dias_e_os_cinco_servicos', async () => {
    await abre();
    const [inicio, fim] = intervalo();
    expect(getResumo).toHaveBeenCalledWith(inicio, fim);
    expect(getReviewsStats).toHaveBeenCalledTimes(1);
    expect(getAnalyticsStats).toHaveBeenCalledTimes(1);
    expect(getMarketingStats).toHaveBeenCalledTimes(1);
    expect(listCustomers).toHaveBeenCalledWith({});
    expect(listUnits).toHaveBeenCalledTimes(1);
    expect(getUnidades).toHaveBeenCalledWith(inicio, fim);
  });

  it('todos_os_servicos_a_falhar_dao_a_pagina_com_valores_por_omissao', async () => {
    [getResumo, getReviewsStats, getAnalyticsStats, getMarketingStats, listCustomers, listUnits, getUnidades]
      .forEach(f => f.mockRejectedValue(new Error('x')));
    await abre();
    /* 12 + 12 + 12 + 15 = 51 -> Moderado */
    expect(screen.getByText('Moderado')).toBeTruthy();
    expect(screen.queryByText(/Por tour/)).toBeNull();
    expect(valor(resumo(), 'Receita').textContent).toBe('—');
    expect(screen.getByText('Sem dados de origem disponíveis.')).toBeTruthy();
    expect(screen.getByText('Dados do funil não disponíveis.')).toBeTruthy();
    expect(screen.getByText('Sem tours registados para comparar.')).toBeTruthy();
  });

  it('score_do_servidor_e_usado_quando_existe', async () => {
    getAnalyticsStats.mockResolvedValue({ health_score: 84.6, health_components: { crescimento: 20, ocupacao: 10, avaliacoes: 5, fidelizacao: 1 } });
    await abre();
    expect(within(document.querySelector('svg[viewBox="0 0 160 160"]')).getByText('85')).toBeTruthy();
    const barra = (rotulo) => screen.getByText(rotulo).parentElement.textContent;
    expect(barra('Crescimento de receita')).toBe('Crescimento de receita20/25');
    expect(barra('Taxa de ocupação')).toBe('Taxa de ocupação10/25');
    expect(barra('Avaliações')).toBe('Avaliações5/25');
    expect(barra('Fidelização')).toBe('Fidelização1/25');
  });

  it('score_calculado_a_partir_de_receita_ocupacao_e_avaliacoes', async () => {
    await abre();
    expect(within(document.querySelector('svg[viewBox="0 0 160 160"]')).getByText('76')).toBeTruthy();
    const barra = (rotulo) => screen.getByText(rotulo).parentElement.textContent;
    expect(barra('Crescimento de receita')).toBe('Crescimento de receita25/25');
    expect(barra('Taxa de ocupação')).toBe('Taxa de ocupação20/25');
    /* o endpoint /reviews/stats devolve `average` (4,2 -> 16 pontos) */
    expect(barra('Avaliações')).toBe('Avaliações16/25');
    expect(barra('Fidelização')).toBe('Fidelização15/25');
  });

  it('os_limiares_de_cada_componente_do_score', async () => {
    const casos = [
      /* [variação da receita, ocupação, crescimento esperado, ocupação esperada] */
      [25, 90, 25, 25], [15, 70, 20, 20], [5, 50, 15, 14], [-5, 30, 8, 8], [-20, 10, 3, 3],
    ];
    for (const [variacao, ocupacao, cresc, ocup] of casos) {
      getResumo.mockResolvedValue({ atual: { taxa_ocupacao: ocupacao }, variacao: { receita: variacao } });
      await abre();
      const barra = (rotulo) => screen.getByText(rotulo).parentElement.textContent;
      expect(barra('Crescimento de receita')).toBe(`Crescimento de receita${cresc}/25`);
      expect(barra('Taxa de ocupação')).toBe(`Taxa de ocupação${ocup}/25`);
      cleanup();
    }
  });

  it('o_rating_le_average_do_endpoint_e_conta_para_o_score', async () => {
    getReviewsStats.mockResolvedValue({ average: 4.9, total: 3 });
    await abre();
    expect(screen.getByText('Avaliações').parentElement.textContent).toBe('Avaliações25/25');
    expect(valor(resumo(), 'Rating médio').textContent).toBe('4.9');
  });

  it('rotulo_do_medidor_bom_moderado_critico', async () => {
    for (const [pontos, rotulo, cor] of [[70, 'Bom', 'bom'], [69, 'Moderado', 'aviso'], [50, 'Moderado', 'aviso'], [49, 'Crítico', 'mau']]) {
      getAnalyticsStats.mockResolvedValue({ health_score: pontos });
      await abre();
      expect(screen.getByText(rotulo)).toBeTruthy();
      expect(tom(circuloPreenchido().getAttribute('stroke'))).toBe(cor);
      cleanup();
    }
  });

  it('resumo_30_dias_receita_reservas_novos_clientes_e_rating_com_variacao', async () => {
    await abre();
    const r = resumo();
    expect(valor(r, 'Receita').textContent).toBe(eur(1234));
    expect(valor(r, 'Receita').closest('article').textContent).toContain('+25%');
    expect(valor(r, 'Reservas').textContent).toBe('18');
    expect(valor(r, 'Reservas').closest('article').textContent).toContain('-8%');
    expect(valor(r, 'Novos clientes').textContent).toBe('—');
    expect(valor(r, 'Rating médio').textContent).toBe('4.2');
  });

  it('o_resumo_semanal_do_servidor_tem_prioridade', async () => {
    getAnalyticsStats.mockResolvedValue({ weekly_summary: { revenue: 999, reservas: 5, novos_clientes: 3, rating_medio: 4.5 } });
    await abre();
    const r = resumo();
    expect(valor(r, 'Receita').textContent).toBe(eur(999));
    expect(valor(r, 'Reservas').textContent).toBe('5');
    expect(valor(r, 'Novos clientes').textContent).toBe('3');
  });

  it('origens_vem_dos_clientes_por_contagem_com_percentagem_e_nomes_dos_paises', async () => {
    await abre();
    const lista = screen.getByText('Origem de Clientes').parentElement;
    const nomes = [...lista.querySelectorAll('span.w-20')].map(s => s.textContent);
    /* PT 3, GB 2, DE 1, XX 1 (empate: ordem de chegada); os clientes sem pais ficam de fora */
    expect(nomes).toEqual(['Portugal', 'Reino Unido', 'Alemanha', 'XX']);
    const pt = screen.getByText('Portugal').parentElement;
    expect(pt.textContent).toContain('PT');
    expect(pt.textContent).toContain('42.9%');
    expect(screen.getByText('Reino Unido').parentElement.textContent).toContain('28.6%');
  });

  it('origens_do_servidor_tem_prioridade_sobre_os_clientes', async () => {
    getAnalyticsStats.mockResolvedValue({ customer_origins: [{ country_code: 'FR', count: 5, pct: 62.5 }, { country_code: 'IT', count: 3, pct: 37.5 }] });
    await abre();
    expect(screen.getByText('França').parentElement.textContent).toContain('62.5%');
    expect(screen.getByText('Itália')).toBeTruthy();
    expect(screen.queryByText('Portugal')).toBeNull();
  });

  it('as_origens_mostram_no_maximo_8_paises_e_o_grafico_recebe_os_mesmos_8', async () => {
    listCustomers.mockResolvedValue(Array.from({ length: 12 }, (_, i) => ({ country_code: String.fromCharCode(65 + i) + 'Z' })));
    await abre();
    const lista = screen.getByText('Origem de Clientes').parentElement;
    expect(lista.querySelectorAll('span.w-20')).toHaveLength(8);
    const dados = JSON.parse(graficos('bar')[0].getAttribute('data-data'));
    expect(dados).toHaveLength(8);
  });

  it('sem_origens_mostra_os_dois_vazios', async () => {
    listCustomers.mockResolvedValue([]);
    await abre();
    expect(screen.getByText('Sem dados de origem disponíveis.')).toBeTruthy();
    expect(screen.getByText('Sem dados disponíveis.')).toBeTruthy();
    expect(graficos('bar')).toHaveLength(0);
  });

  it('funil_em_falta_mostra_o_aviso', async () => {
    await abre();
    expect(screen.getByText('Dados do funil não disponíveis.')).toBeTruthy();
  });

  it('funil_calcula_a_percentagem_sobre_o_passo_anterior', async () => {
    getAnalyticsStats.mockResolvedValue({ conversion_funnel: { page_views: 1000, booking_started: 400, booking_completed: 100, payment_confirmed: 50 } });
    await abre();
    const linha = (rotulo) => screen.getByText(rotulo).closest('div.flex.items-center.gap-4');
    expect(linha('Visitas página pública').textContent).toContain((1000).toLocaleString());
    expect(linha('Visitas página pública').textContent).not.toContain('%');
    expect(linha('Reserva iniciada').textContent).toContain('40.0%');
    expect(linha('Reserva concluída').textContent).toContain('25.0%');
    expect(linha('Pagamento confirmado').textContent).toContain('50.0%');
    expect(screen.getByText('% indica taxa de conversão para o passo anterior.')).toBeTruthy();
  });

  it('o_funil_pode_vir_do_marketing', async () => {
    getMarketingStats.mockResolvedValue({ funnel: { page_views: 10, booking_started: 5 } });
    await abre();
    expect(screen.getByText('Reserva iniciada').closest('div.flex.items-center.gap-4').textContent).toContain('50.0%');
    /* passos em falta contam zero */
    expect(screen.getByText('Pagamento confirmado').closest('div.flex.items-center.gap-4').textContent).not.toContain('%');
  });

  it('relatorio_semanal_abre_mailto_com_assunto_e_corpo', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: /Enviar por email/ }));
    expect(abrir).toHaveBeenCalledTimes(1);
    const url = abrir.mock.calls[0][0];
    expect(url.startsWith(`mailto:?subject=${encodeURIComponent('SalDesk — Relatório Mensal')}&body=`)).toBe(true);
    const corpo = decodeURIComponent(url.split('&body=')[1]);
    expect(corpo).toBe(
      'Score de Saúde: 76/100\n' +
      `Receita: ${eur(1234)}\n` +
      'Reservas: 18\n' +
      'Rating médio: 4.2\n\n' +
      `Gerado em SalDesk — ${new Date().toLocaleDateString('pt-PT')}`
    );
  });

  it('o_relatorio_mostra_quatro_numeros_com_o_score_pela_cor', async () => {
    getAnalyticsStats.mockResolvedValue({ health_score: 72 });
    getReviewsStats.mockResolvedValue({ average: 4.5, total: 8 });
    await abre();
    const c = cartao('Relatório Semanal');
    expect(valor(c, 'Score de saúde').textContent).toBe('72/100');
    expect(valor(c, 'Receita').textContent).toBe(eur(1234));
    expect(valor(c, 'Reservas').textContent).toBe('18');
    expect(valor(c, 'Rating').textContent).toBe('4.5 / 5.0');
    expect(tomDoQuadro(valor(c, 'Score de saúde'))).toBe('bom');
    cleanup();
    getAnalyticsStats.mockResolvedValue({ health_score: 55 });
    await abre();
    expect(tomDoQuadro(valor(cartao('Relatório Semanal'), 'Score de saúde'))).toBe('aviso');
    cleanup();
    /* o quadro nao tem tom vermelho: o critico fica em aviso e o medidor diz Crítico */
    getAnalyticsStats.mockResolvedValue({ health_score: 30 });
    await abre();
    expect(tomDoQuadro(valor(cartao('Relatório Semanal'), 'Score de saúde'))).toBe('aviso');
    expect(screen.getByText('Crítico')).toBeTruthy();
  });

  it('taxa_de_abandono_e_limiares', async () => {
    /* reservas = 18: [visitas, % esperada, tom] */
    const casos = [[100, '82%', 'aviso'], [90, '80%', 'aviso'], [50, '64%', 'aviso'], [45, '60%', 'bom'], [40, '55%', 'bom']];
    for (const [visitas, texto, cor] of casos) {
      getMarketingStats.mockResolvedValue({ profile_views: visitas });
      await abre();
      const c = cartao('Taxa de Abandono');
      const v = valor(c, 'Taxa de abandono');
      expect(v.textContent).toBe(texto);
      expect(tomDoQuadro(v)).toBe(cor);
      cleanup();
    }
  });

  it('o_aviso_de_abandono_so_aparece_acima_de_70', async () => {
    getMarketingStats.mockResolvedValue({ profile_views: 62 });
    await abre();
    expect(screen.getByText('Alta taxa de abandono (71%).')).toBeTruthy();
    cleanup();
    getMarketingStats.mockResolvedValue({ profile_views: 60 });
    await abre();
    expect(valor(cartao('Taxa de Abandono'), 'Taxa de abandono').textContent).toBe('70%');
    expect(screen.queryByText(/Alta taxa de abandono/)).toBeNull();
  });

  it('visitas_do_perfil_podem_vir_das_estatisticas_e_sem_visitas_mostra_travessao', async () => {
    getAnalyticsStats.mockResolvedValue({ profile_views: 2000 });
    await abre();
    const c = cartao('Taxa de Abandono');
    expect(valor(c, 'Visitas ao perfil').textContent).toBe((2000).toLocaleString('pt-PT'));
    expect(valor(c, 'Reservas completadas').textContent).toBe('18');
    cleanup();
    getAnalyticsStats.mockResolvedValue({});
    await abre();
    const d = cartao('Taxa de Abandono');
    expect(valor(d, 'Visitas ao perfil').textContent).toBe('—');
    expect(valor(d, 'Taxa de abandono').textContent).toBe('—');
  });

  it('popularidade_por_tour_vem_das_reservas_reais_relativas_ao_tour_mais_reservado', async () => {
    await abre();
    const c = cartao('Taxa de Abandono');
    const linha = (nome) => within(c).getByText(nome).closest('div.flex.items-center');
    /* 25, 20, 15, 10, 5 reservas sobre o maximo (25): 100, 80, 60, 40, 20; so os 5 mais reservados */
    expect(linha('Passeio').textContent).toContain('100%');
    expect(linha('Buggy Tour').textContent).toContain('80%');
    expect(linha('Mergulho').textContent).toContain('60%');
    expect(linha('Kitesurf').textContent).toContain('40%');
    expect(linha('Barco').textContent).toContain('20%');
    expect(within(c).queryByText('Quad')).toBeNull();
    const ordem = [...c.querySelectorAll('span.truncate')].map(e => e.textContent);
    expect(ordem).toEqual(['Passeio', 'Buggy Tour', 'Mergulho', 'Kitesurf', 'Barco']);
    /* abaixo de 50%: aviso "melhora fotos" */
    expect(within(c).getAllByText('melhora fotos')).toHaveLength(2);
    expect(linha('Barco').textContent).toContain('melhora fotos');
    expect(linha('Mergulho').textContent).not.toContain('melhora fotos');
    expect(within(c).getByText(/Por tour \(reservas dos últimos 30 dias\)/)).toBeTruthy();
    expect(within(c).queryByText(/estimad/)).toBeNull();
    expect(aleatorio).not.toHaveBeenCalled();
  });

  it('sem_reservas_em_nenhum_tour_mostra_zero_e_nao_aconselha_melhorar_fotos', async () => {
    getUnidades.mockResolvedValue([{ id: 'u1', name: 'Buggy Tour', num_reservas: 0 }, { id: 'u2', name: 'Mergulho', num_reservas: 0 }]);
    await abre();
    const c = cartao('Taxa de Abandono');
    expect(within(c).getByText('Buggy Tour').closest('div.flex.items-center').textContent).toContain('0%');
    expect(within(c).queryByText('melhora fotos')).toBeNull();
  });

  it('sem_tours_nao_ha_popularidade', async () => {
    getUnidades.mockResolvedValue([]);
    await abre();
    expect(within(cartao('Taxa de Abandono')).queryByText(/Por tour/)).toBeNull();
  });

  it('tabela_da_concorrencia_tem_as_cinco_colunas_e_no_maximo_8_tours', async () => {
    await abre();
    const tabela = screen.getByRole('table');
    const colunas = within(tabela).getAllByRole('columnheader').map(h => h.textContent);
    expect(colunas).toEqual(['Tour', 'Preço SalDesk', 'Preço Viator/GYG', 'Posição no mercado', '']);
    expect(within(tabela).getAllByRole('row')).toHaveLength(1 + 8);
    expect(within(tabela).queryByText('Extra nono')).toBeNull();
    expect(linhaDe('Buggy Tour').textContent).toContain('€60');
    /* sem preco do concorrente */
    expect(linhaDe('Buggy Tour').textContent).toContain('Não definido');
    expect(linhaDe('Buggy Tour').textContent).toContain('—');
  });

  it('concorrencia_posicao_acima_abaixo_e_na_media', async () => {
    localStorage.setItem(CHAVE, JSON.stringify({ u1: { price: 40 }, u2: { price: 40 }, u3: { price: 40 }, u4: { price: 40 }, u5: { price: 40 }, u6: { price: 30 } }));
    await abre();
    /* limiares 5 e 20: 60 vs 40 = +50%; 45 vs 40 = +12,5 -> +13%; 20 vs 40 = -50%; 35 vs 40 = -12,5 -> -12%; 41 vs 40 = 2,5 */
    const dica = 'Considera reduzir para aumentar conversão';
    expect(linhaDe('Buggy Tour').textContent).toContain('+50% acima');
    expect(linhaDe('Buggy Tour').textContent).toContain(dica);
    expect(linhaDe('Mergulho').textContent).toContain('+13% acima');
    expect(linhaDe('Mergulho').textContent).not.toContain(dica);
    expect(linhaDe('Kitesurf').textContent).toContain('-50% abaixo');
    expect(linhaDe('Barco').textContent).toContain('-12% abaixo');
    expect(linhaDe('Quad').textContent).toContain('Na média');
    expect(linhaDe('Passeio').textContent).toContain('Na média');
    expect(linhaDe('Buggy Tour').textContent).toContain('€40');
  });

  it('os_precos_guardados_sao_lidos_ao_abrir_e_um_json_estragado_e_ignorado', async () => {
    localStorage.setItem(CHAVE, '{não e json');
    await abre();
    expect(linhaDe('Buggy Tour').textContent).toContain('Não definido');
  });

  it('editar_preco_guarda_em_localStorage_saldesk_competition_v1', async () => {
    localStorage.setItem(CHAVE, JSON.stringify({ u1: { price: 40, nota: 'x' } }));
    await abre();
    /* editar o u1: o campo abre com o valor guardado */
    fireEvent.click(within(linhaDe('Buggy Tour')).getByRole('button'));
    const campo = within(linhaDe('Buggy Tour')).getByPlaceholderText('Ex: 45');
    expect(campo.value).toBe('40');
    fireEvent.change(campo, { target: { value: '55' } });
    fireEvent.click(within(linhaDe('Buggy Tour')).getByRole('button'));
    expect(JSON.parse(localStorage.getItem(CHAVE))).toEqual({ u1: { price: 55, nota: 'x' } });
    expect(linhaDe('Buggy Tour').textContent).toContain('€55');
    expect(within(linhaDe('Buggy Tour')).queryByPlaceholderText('Ex: 45')).toBeNull();
    /* editar outro tour junta-se ao que ja existia */
    fireEvent.click(within(linhaDe('Mergulho')).getByRole('button'));
    fireEvent.change(within(linhaDe('Mergulho')).getByPlaceholderText('Ex: 45'), { target: { value: '38' } });
    fireEvent.click(within(linhaDe('Mergulho')).getByRole('button'));
    expect(JSON.parse(localStorage.getItem(CHAVE))).toEqual({ u1: { price: 55, nota: 'x' }, u2: { price: 38 } });
    expect(linhaDe('Mergulho').textContent).toContain('+18% acima');
  });

  it('guardar_o_campo_vazio_limpa_o_preco', async () => {
    localStorage.setItem(CHAVE, JSON.stringify({ u1: { price: 40 } }));
    await abre();
    fireEvent.click(within(linhaDe('Buggy Tour')).getByRole('button'));
    fireEvent.change(within(linhaDe('Buggy Tour')).getByPlaceholderText('Ex: 45'), { target: { value: '' } });
    fireEvent.click(within(linhaDe('Buggy Tour')).getByRole('button'));
    expect(JSON.parse(localStorage.getItem(CHAVE))).toEqual({ u1: { price: 0 } });
    expect(linhaDe('Buggy Tour').textContent).toContain('Não definido');
  });

  it('sem_tours_mostra_o_vazio_da_concorrencia', async () => {
    listUnits.mockResolvedValue([]);
    await abre();
    expect(screen.getByText('Sem tours registados para comparar.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('actualizar_repete_os_pedidos', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: /Actualizar/ }));
    await waitFor(() => expect(getResumo).toHaveBeenCalledTimes(2));
    expect(listUnits).toHaveBeenCalledTimes(2);
    expect(listCustomers).toHaveBeenCalledTimes(2);
  });

  /* ---- estilo Mare ---- */
  it('mostra_o_sobretitulo_da_area_Gestao_tambem_a_carregar', async () => {
    render(<MemoryRouter future={FUTURE}><Analytics /></MemoryRouter>);
    expect(document.querySelector('[data-eyebrow]').textContent).toBe('Gestão');
    await screen.findByText('Score de Saúde do Negócio');
    expect(document.querySelector('[data-eyebrow]').textContent).toBe('Gestão');
  });

  it('os_numeros_do_resumo_do_relatorio_e_do_abandono_sao_quadros_MareStat', async () => {
    await abre();
    const rotulos = [
      [resumo(), ['Receita', 'Reservas', 'Novos clientes', 'Rating médio']],
      [cartao('Relatório Semanal'), ['Score de saúde', 'Receita', 'Reservas', 'Rating']],
      [cartao('Taxa de Abandono'), ['Visitas ao perfil', 'Reservas completadas', 'Taxa de abandono']],
    ];
    for (const [raiz, lista] of rotulos) {
      for (const r of lista) {
        const art = within(raiz).getByText(r, { selector: 'p' }).closest('article');
        expect(art.className).toContain('rounded-[18px]');
        expect(art.className).toContain('border-mare-card');
        expect(art.querySelector('p.font-display')).toBeTruthy();
      }
    }
  });

  it('cada_seccao_e_um_cartao_Mare_com_titulo_Sora_de_18px', async () => {
    await abre();
    const titulos = ['Score de Saúde do Negócio', 'Componentes do Score', 'Origem de Clientes', 'Distribuição por País',
      'Funil de Conversão', 'Relatório Semanal', 'Taxa de Abandono', 'Análise de Concorrência'];
    for (const nome of titulos) {
      const h = screen.getByText(nome, { selector: 'h3' });
      expect(h.className).toContain('font-display');
      expect(h.className).toContain('text-lg');
      expect(h.className).toContain('font-semibold');
      expect(h.className).toContain('text-ocean-900');
      const c = h.closest('section');
      expect(c.className).toContain('border-mare-card');
      expect(c.className).toContain('rounded-[18px]');
      expect(c.className).toContain('p-[22px]');
    }
  });

  it('o_grafico_de_paises_segue_a_linguagem_dos_graficos', async () => {
    await abre();
    const g = graficos('bar')[0];
    expect(JSON.parse(g.getAttribute('data-keys'))).toEqual(['count']);
    /* barras horizontais: a grelha mantem as linhas guia do eixo dos valores (vertical nao e desligado) */
    expect(g.getAttribute('data-grid-vertical')).not.toBe('false');
    const cores = JSON.parse(g.getAttribute('data-colors'));
    expect(cores).toContain('var(--n200)');
    expect(cores).toContain('var(--n500)');
    expect(cores).toContain('var(--ocean-500)');
    expect(cores).toContain('var(--sand-500)');
  });

  it('os_numeros_das_listas_e_da_tabela_usam_mono_com_algarismos_alinhados', async () => {
    getAnalyticsStats.mockResolvedValue({ conversion_funnel: { page_views: 1000, booking_started: 400, booking_completed: 100, payment_confirmed: 50 } });
    await abre();
    const mono = (el) => { expect(el.className).toContain('font-mono'); expect(el.className).toContain('tabular-nums'); };
    mono(within(screen.getByText('Portugal').closest('div.flex')).getByText('42.9%'));
    mono(within(screen.getByText('Reserva iniciada').closest('div.flex.items-center.gap-4')).getByText('40.0%'));
    mono(within(linhaDe('Buggy Tour')).getByText('€60'));
    const pop = within(cartao('Taxa de Abandono')).getByText('Passeio').closest('div.flex.items-center');
    mono(within(pop).getByText('100%'));
  });

  /* ---- design system ---- */
  const SEM_COR_CRUA = (html) => {
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(html).not.toMatch(/(?:bg|text|border|ring)-(?:yellow|green|red)-\d/);
  };

  it('nenhuma_cor_crua_sobra_na_pagina_inteira_nem_no_medidor', async () => {
    getAnalyticsStats.mockResolvedValue({ conversion_funnel: { page_views: 1000, booking_started: 400, booking_completed: 100, payment_confirmed: 50 } });
    getMarketingStats.mockResolvedValue({ profile_views: 100 });
    localStorage.setItem(CHAVE, JSON.stringify({ u1: { price: 40 }, u3: { price: 40 }, u5: { price: 40 }, u2: { price: 43 } }));
    const r = await abre();
    SEM_COR_CRUA(r.container.innerHTML);
    /* tambem em modo de edicao */
    fireEvent.click(within(linhaDe('Buggy Tour')).getByRole('button'));
    SEM_COR_CRUA(r.container.innerHTML);
  });

  it('o_medidor_usa_tokens_no_arco_no_trilho_e_nos_textos', async () => {
    await abre();
    const svg = document.querySelector('svg[viewBox="0 0 160 160"]');
    const circulos = [...svg.querySelectorAll('circle')];
    expect(circulos[0].getAttribute('stroke')).toBe('var(--n200)');
    expect(circulos[1].getAttribute('stroke')).toBe('var(--success)');
    const textos = [...svg.querySelectorAll('text')];
    expect(textos[0].getAttribute('fill')).toBe('var(--n900)');
    expect(textos[1].getAttribute('fill')).toBe('var(--n500)');
  });

  it('o_arco_do_medidor_muda_de_token_com_o_score', async () => {
    getAnalyticsStats.mockResolvedValue({ health_score: 60 });
    await abre();
    expect(circuloPreenchido().getAttribute('stroke')).toBe('var(--sand-500)');
    cleanup();
    getAnalyticsStats.mockResolvedValue({ health_score: 20 });
    await abre();
    expect(circuloPreenchido().getAttribute('stroke')).toBe('var(--error)');
  });

  it('os_graficos_recebem_cores_var_token_e_nenhum_hexadecimal', async () => {
    listCustomers.mockResolvedValue(Array.from({ length: 8 }, (_, i) => ({ country_code: String.fromCharCode(65 + i) + 'Z' })));
    await abre();
    const cores = coresDosGraficos();
    expect(cores.length).toBeGreaterThan(0);
    cores.forEach(c => expect(c).toMatch(/^var\(--[a-z0-9-]+\)$/));
  });

  it('o_aviso_de_abandono_usa_o_token_de_aviso', async () => {
    getMarketingStats.mockResolvedValue({ profile_views: 100 });
    await abre();
    const aviso = screen.getByText(/Alta taxa de abandono/).closest('div.flex');
    expect(aviso.className).toContain('bg-[var(--warning-light)]');
  });

  it('os_botoes_de_editar_e_guardar_a_concorrencia_tem_nome_acessivel', async () => {
    await abre();
    const editar = within(linhaDe('Buggy Tour')).getByRole('button', { name: 'Editar preço' });
    fireEvent.click(editar);
    expect(within(linhaDe('Buggy Tour')).getByLabelText('Preço do concorrente')).toBeTruthy();
    expect(within(linhaDe('Buggy Tour')).getByRole('button', { name: 'Guardar preço' })).toBeTruthy();
    /* so o tour em edicao muda */
    expect(within(linhaDe('Mergulho')).getByRole('button', { name: 'Editar preço' })).toBeTruthy();
  });
});

describe('Analytics em inglês', () => {
  let abrir;
  /* dados dos testes que podem parecer portugueses (nomes dos tours) */
  const DADOS = ['Buggy Tour', 'Mergulho', 'Kitesurf', 'Barco', 'Quad', 'Passeio', 'Snorkel', 'Pesca'];
  const eurEn = (v) => `€${Math.round(Number(v || 0)).toLocaleString('en-GB')}`;

  beforeEach(() => {
    useUiStore.setState({ lang: 'en' });
    abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    localStorage.clear();
    getResumo.mockReset().mockResolvedValue(RESUMO);
    getReviewsStats.mockReset().mockResolvedValue({ average: 4.2, total: 10 });
    getAnalyticsStats.mockReset().mockResolvedValue({});
    getMarketingStats.mockReset().mockResolvedValue({
      profile_views: 100,
      funnel: { page_views: 1000, booking_started: 400, booking_completed: 100, payment_confirmed: 80 },
    });
    listCustomers.mockReset().mockResolvedValue(CLIENTES);
    listUnits.mockReset().mockResolvedValue(UNIDADES);
    getUnidades.mockReset().mockResolvedValue(DESEMPENHO);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
    useUiStore.setState({ lang: 'pt' });
  });

  async function abreEmIngles() {
    render(
      <MemoryRouter future={FUTURE}>
        <Analytics />
      </MemoryRouter>
    );
    await screen.findByText('Business health score');
  }

  it('a_pagina_inteira_em_ingles_sem_portugues', async () => {
    await abreEmIngles();
    expect(screen.getByRole('heading', { level: 1, name: 'Analytics' })).toBeInTheDocument();
    expect(screen.getByText('Strategic view of the business')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh/ })).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    for (const r of ['Score components', 'Revenue growth', 'Occupancy rate', 'Reviews', 'Loyalty',
      'Summary — Last 30 days', 'New customers', 'Average rating', 'Customer origin', 'Distribution by country',
      'Conversion funnel', 'Public page visits', 'Booking started', 'Booking completed', 'Payment confirmed',
      '% shows the conversion rate from the previous step.', 'Weekly report', 'Health score', 'Abandonment rate',
      'Profile visits', 'Completed bookings', 'Competitor analysis', 'By tour (bookings in the last 30 days)']) {
      expect(screen.getAllByText(r).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText(eurEn(1234)).length).toBeGreaterThan(0);
    /* o funil agrupa os milhares pelo en-GB */
    expect(screen.getByText('1,000')).toBeInTheDocument();
    /* paises pelo nome ingles; um codigo desconhecido mostra-se tal e qual */
    for (const p of ['Portugal', 'United Kingdom', 'Germany']) expect(screen.getByText(p)).toBeInTheDocument();
    expect(screen.getAllByText('XX')).toHaveLength(2); /* o codigo e o nome */
    expect(screen.getByText(/^High abandonment rate \(82%\)\./)).toBeInTheDocument();
    expect(screen.getAllByText('improve photos').length).toBeGreaterThan(0);
    const tabela = screen.getByRole('table');
    expect(within(tabela).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Tour', 'SalDesk price', 'Viator/GYG price', 'Market position', '']);
    expect(within(tabela).getAllByText('Not set').length).toBeGreaterThan(0);
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['analytics'])).toEqual([]);
  });

  it('o_relatorio_por_email_vai_em_ingles_com_a_data_inglesa', async () => {
    await abreEmIngles();
    fireEvent.click(screen.getByRole('button', { name: /Send by email/ }));
    const url = abrir.mock.calls[0][0];
    expect(url.startsWith(`mailto:?subject=${encodeURIComponent('SalDesk — Monthly report')}&body=`)).toBe(true);
    expect(decodeURIComponent(url.split('&body=')[1])).toBe(
      'Health score: 76/100\n' +
      `Revenue: ${eurEn(1234)}\n` +
      'Bookings: 18\n' +
      'Average rating: 4.2\n\n' +
      `Generated in SalDesk — ${new Date().toLocaleDateString('en-GB')}`
    );
  });

  it('o_preco_do_concorrente_guarda_o_numero_e_a_posicao_em_ingles', async () => {
    await abreEmIngles();
    const linha = screen.getAllByText('Buggy Tour').find(e => e.closest('table')).closest('tr');
    fireEvent.click(within(linha).getByRole('button', { name: 'Edit price' }));
    const campo = within(linha).getByLabelText('Competitor price');
    expect(campo).toHaveAttribute('placeholder', 'e.g. 45');
    fireEvent.change(campo, { target: { value: '50' } });
    fireEvent.click(within(linha).getByRole('button', { name: 'Save price' }));
    expect(JSON.parse(localStorage.getItem(CHAVE))).toEqual({ u1: { price: 50 } });
    expect(linha).toHaveTextContent('+20% above');
  });

  it('servicos_a_falhar_mostram_os_vazios_em_ingles', async () => {
    [getResumo, getReviewsStats, getAnalyticsStats, getMarketingStats, listCustomers, listUnits, getUnidades]
      .forEach(f => f.mockRejectedValue(new Error('x')));
    await abreEmIngles();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('No origin data available.')).toBeInTheDocument();
    expect(screen.getByText('No data available.')).toBeInTheDocument();
    expect(screen.getByText('Funnel data not available.')).toBeInTheDocument();
    expect(screen.getByText('No tours to compare.')).toBeInTheDocument();
    expect(screen.getByText(/Load financial data for an accurate score\./)).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
  });
});
