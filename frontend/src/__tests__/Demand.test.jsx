import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Demand from '../pages/Demand';
import { getReceita } from '../services/financeiroService';
import { listReservations } from '../services/reservationsService';

/* Sem rede: so os servicos da pagina sao simulados */
vi.mock('../services/financeiroService', () => ({ getReceita: vi.fn() }));
vi.mock('../services/reservationsService', () => ({ listReservations: vi.fn() }));

/* O ResponsiveContainer real nao desenha nada no jsdom: os componentes do recharts sao simulados por
   <div data-chart> com as props de cor, para se poder ler as cores que a pagina escolhe */
vi.mock('recharts', async () => {
  const React = await import('react');
  const caixa = (nome) => function Simulado({ children, ...p }) {
    return React.createElement('div', {
      'data-chart': nome,
      'data-fill': p.fill,
      'data-stroke': p.stroke,
      'data-datakey': p.dataKey,
      'data-y': p.y,
      'data-tickfill': p.tick && p.tick.fill,
      'data-labelfill': p.label && p.label.fill,
      'data-data': Array.isArray(p.data) ? JSON.stringify(p.data) : undefined,
    }, children);
  };
  const nada = () => null;
  return {
    BarChart: caixa('BarChart'), Bar: caixa('Bar'), LineChart: caixa('LineChart'), Line: caixa('Line'),
    XAxis: caixa('XAxis'), YAxis: caixa('YAxis'), CartesianGrid: caixa('CartesianGrid'),
    ReferenceLine: caixa('ReferenceLine'), Cell: caixa('Cell'), ResponsiveContainer: caixa('ResponsiveContainer'),
    Tooltip: nada, Legend: nada,
  };
});

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

/* mesmas formulas da pagina (datas UTC para os proximos 30 dias, ano local) */
const ANO = new Date().getFullYear();
const ANTERIOR = ANO - 1;
const HOJE = new Date().toISOString().slice(0, 10);
function somaDias(base, n) {
  const d = new Date(base + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/* receita do ano: media dos meses com receita = 620/6 = 103,33 -> alto > 129,17 (Jul) e baixo < 77,5 (Ago) */
const ATUAL = [
  { date: `${ANO}-01-01`, value: 100 }, { date: `${ANO}-02-01`, total: 100 }, { date: `${ANO}-03`, value: 100 },
  { date: `${ANO}-06-01`, value: 100 }, { date: `${ANO}-07-01`, value: 200 }, { date: `${ANO}-08-01`, total: 20 },
];
const PASSADO = [{ date: `${ANTERIOR}-01-01`, value: 300 }, { date: `${ANTERIOR}-07-01`, value: 300 }];

/* reservas: hoje 1, hoje+3 tres (alta procura), hoje+5 duas */
function reserva(id, dias) { return { id, check_in: somaDias(HOJE, dias) }; }
const RESERVAS = [reserva('a', 0), reserva('b', 3), reserva('c', 3), reserva('d', 3), reserva('e', 5), reserva('f', 5)];

function recebe(atual, passado) {
  getReceita.mockImplementation(async (de) => (de.startsWith(String(ANO)) ? atual : passado));
}

describe('Demand', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getReceita.mockReset();
    recebe(ATUAL, PASSADO);
    listReservations.mockReset().mockResolvedValue(RESERVAS);
  });

  afterEach(() => {
    cleanup();
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
        <Demand />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.queryByText('Receita mensal — comparativo anual') || screen.queryByText('Sem dados financeiros disponiveis para o periodo.')).toBeTruthy());
    return r;
  }

  /* os separadores: clicar no texto funciona antes e depois de passarem a role="tab" */
  async function vaiPara(nome) {
    fireEvent.click(screen.getByText(nome));
  }

  function kpi(rotulo) {
    return screen.getByText(rotulo).previousElementSibling;
  }

  function grafico(nome) {
    return [...document.querySelectorAll(`[data-chart="${nome}"]`)];
  }

  it('pede_receita_dos_dois_anos_por_mes_e_as_reservas_com_o_filtro_actual', async () => {
    await abre();
    expect(getReceita).toHaveBeenCalledWith(`${ANO}-01-01`, `${ANO}-12-31`, 'month');
    expect(getReceita).toHaveBeenCalledWith(`${ANTERIOR}-01-01`, `${ANTERIOR}-12-31`, 'month');
    expect(listReservations).toHaveBeenCalledWith({ from: HOJE, to: somaDias(HOJE, 29), status: 'confirmed,pending' });
  });

  it('kpis_receita_acumulada_variacao_melhor_mes_e_reservas_30d', async () => {
    await abre();
    expect(kpi(`Receita ${ANO} (acumulado)`).textContent).toBe('€620');
    /* (620 - 600) / 600 = 3,3 -> +3% */
    expect(kpi('Var. vs ano anterior').textContent).toBe('+3%');
    expect(kpi('Melhor mes').textContent).toBe('Jul');
    expect(kpi('Reservas proximos 30d').textContent).toBe('6');
  });

  it('variacao_negativa_e_sem_ano_anterior_mostra_travessao', async () => {
    recebe(ATUAL, [{ date: `${ANTERIOR}-01-01`, value: 1000 }]);
    await abre();
    /* (620 - 1000) / 1000 = -38% */
    expect(kpi('Var. vs ano anterior').textContent).toBe('-38%');
    cleanup();
    recebe(ATUAL, []);
    await abre();
    expect(kpi('Var. vs ano anterior').textContent).toBe('—');
  });

  it('epoca_alta_acima_de_1_25_da_media_e_baixa_abaixo_de_0_75', async () => {
    await abre();
    const altas = screen.getByText('Epocas altas').parentElement;
    expect(altas.textContent).toContain('Jul · €200');
    expect(altas.textContent).not.toContain('Jan');
    const baixas = screen.getByText('Epocas baixas').parentElement;
    expect(baixas.textContent).toContain('Ago · €20');
    /* meses sem receita nunca sao "baixos" */
    expect(baixas.textContent).not.toContain('Set');
  });

  it('sem_epocas_mostra_os_textos_vazios', async () => {
    recebe(Array.from({ length: 12 }, (_, i) => ({ date: `${ANO}-${String(i + 1).padStart(2, '0')}-01`, value: 100 })), []);
    await abre();
    expect(screen.getByText('Sem dados suficientes para identificar epocas altas.')).toBeTruthy();
    expect(screen.getByText('Sem epocas baixas identificadas — bom desempenho anual!')).toBeTruthy();
  });

  it('grafico_usa_dados_dos_12_meses_e_a_linha_da_media', async () => {
    await abre();
    const dados = JSON.parse(grafico('BarChart')[0].getAttribute('data-data'));
    expect(dados).toHaveLength(12);
    expect(dados.map(d => d.name)).toEqual(MESES);
    expect(dados[0]).toMatchObject({ curValue: 100, prevValue: 300, month: 1 });
    expect(dados[1].curValue).toBe(100);
    expect(dados[2].curValue).toBe(100);
    expect(dados[6]).toMatchObject({ curValue: 200, prevValue: 300 });
    expect(dados[7].curValue).toBe(20);
    expect(dados[3].curValue).toBe(0);
    /* media dos meses com receita, arredondada */
    expect(grafico('ReferenceLine')[0].getAttribute('data-y')).toBe('103');
    expect(grafico('Bar').map(b => b.getAttribute('data-datakey'))).toEqual(['prevValue', 'curValue']);
  });

  it('sem_media_nao_ha_linha_da_media', async () => {
    recebe([], PASSADO);
    await abre();
    expect(grafico('ReferenceLine')).toHaveLength(0);
  });

  it('cada_barra_do_ano_actual_tem_a_cor_da_epoca', async () => {
    await abre();
    const celulas = grafico('Cell');
    expect(celulas).toHaveLength(12);
    /* Jul (alto) != Ago (baixo) != Jan (normal) */
    const cores = [celulas[6], celulas[7], celulas[0]].map(c => c.getAttribute('data-fill'));
    expect(new Set(cores).size).toBe(3);
    /* os meses normais partilham a mesma cor */
    expect(celulas[0].getAttribute('data-fill')).toBe(celulas[3].getAttribute('data-fill'));
  });

  it('sem_dados_mostra_o_vazio_do_grafico', async () => {
    recebe([], []);
    await abre();
    expect(screen.getByText('Sem dados financeiros disponiveis para o periodo.')).toBeTruthy();
    expect(grafico('BarChart')).toHaveLength(0);
    expect(kpi(`Receita ${ANO} (acumulado)`).textContent).toBe('€0');
    expect(kpi('Melhor mes').textContent).toBe('—');
  });

  it('separador_proximos_30_dias_agrupa_por_data_de_entrada_e_destaca_3_ou_mais', async () => {
    await abre();
    await vaiPara('Proximos 30 dias');
    expect(screen.getByText('Reservas confirmadas — proximos 30 dias')).toBeTruthy();
    const titulo = (dias) => {
      const d = new Date(somaDias(HOJE, dias) + 'T00:00:00Z');
      return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
    };
    expect(document.querySelectorAll('[title$="reserva(s)"]')).toHaveLength(30);
    expect(document.querySelector(`[title="${titulo(0)}: 1 reserva(s)"]`)).toBeTruthy();
    const alta = document.querySelector(`[title="${titulo(3)}: 3 reserva(s)"]`);
    expect(alta).toBeTruthy();
    /* a alta procura destaca-se do dia com reservas e do livre */
    const normal = document.querySelector(`[title="${titulo(5)}: 2 reserva(s)"]`);
    const livre = document.querySelector(`[title="${titulo(1)}: 0 reserva(s)"]`);
    expect(alta.className).not.toBe(normal.className);
    expect(normal.className).not.toBe(livre.className);
    /* hoje tem o seu proprio destaque */
    const hoje = document.querySelector(`[title="${titulo(0)}: 1 reserva(s)"]`);
    expect(hoje.className).not.toBe(normal.className);
    /* contador por dia so quando ha reservas */
    expect(within(alta).getByText('3')).toBeTruthy();
    expect(livre.textContent).toBe(`${MESES[new Date(somaDias(HOJE, 1) + 'T00:00:00Z').getUTCMonth()]}${new Date(somaDias(HOJE, 1) + 'T00:00:00Z').getUTCDate()}`);
    expect(screen.getByText('Alta procura (3+)')).toBeTruthy();
  });

  it('dias_com_mais_actividade_top_5_ordenados', async () => {
    /* contagens 1,2,3,4,5,6 em seis dias seguidos: o top 5 deixa de fora o dia com 1 */
    const muitas = [];
    [1, 2, 3, 4, 5, 6].forEach((n, i) => { for (let k = 0; k < n; k++) muitas.push(reserva(`m${i}-${k}`, i * 2)); });
    listReservations.mockResolvedValue(muitas);
    await abre();
    await vaiPara('Proximos 30 dias');
    const bloco = screen.getByText('Dias com mais actividade').parentElement;
    const contagens = [...bloco.querySelectorAll('span.text-ocean-700')].map(s => s.textContent);
    expect(contagens).toEqual(['6 reserva(s)', '5 reserva(s)', '4 reserva(s)', '3 reserva(s)', '2 reserva(s)']);
    /* a barra do maior ocupa 100% */
    expect(bloco.querySelector('div.bg-ocean-500').getAttribute('style')).toContain('width: 100%');
  });

  it('sem_reservas_mostra_o_vazio_e_esconde_os_dias_com_mais_actividade', async () => {
    listReservations.mockResolvedValue([]);
    await abre();
    await vaiPara('Proximos 30 dias');
    expect(screen.getByText('Sem reservas confirmadas para os proximos 30 dias.')).toBeTruthy();
    expect(screen.queryByText('Dias com mais actividade')).toBeNull();
  });

  it('separador_sugestoes_uma_por_mes_alto_ou_baixo_ate_6', async () => {
    await abre();
    await vaiPara('Sugestoes');
    const cartoes = screen.getAllByText(/historicamente/);
    expect(cartoes).toHaveLength(2);
    expect(cartoes[0].textContent).toBe('Jul e historicamente um mes de alta procura — considera abrir mais vagas e ajustar precos para maximizar receita.');
    expect(cartoes[1].textContent).toBe('Ago tem historicamente baixa ocupacao — cria uma promocao especial ou voucher para atrair mais reservas.');
    expect(screen.getByText(/Sugestoes automaticas/)).toBeTruthy();
  });

  it('as_sugestoes_ficam_limitadas_a_6', async () => {
    /* um mes enorme e oito meses pequenos: 1 alta + 8 baixas = 9, cortadas em 6 */
    const dados = [{ date: `${ANO}-01-01`, value: 1000 }];
    for (let m = 2; m <= 9; m++) dados.push({ date: `${ANO}-${String(m).padStart(2, '0')}-01`, value: 100 });
    recebe(dados, []);
    await abre();
    await vaiPara('Sugestoes');
    expect(screen.getAllByText(/historicamente/)).toHaveLength(6);
  });

  it('sem_dados_historicos_mostra_a_sugestao_unica', async () => {
    recebe([], []);
    await abre();
    await vaiPara('Sugestoes');
    expect(screen.getByText('Sem dados historicos suficientes para gerar sugestoes. Adiciona mais reservas ao sistema para desbloquear a analise de sazonalidade.')).toBeTruthy();
    /* sem melhor mes nao ha comparativo */
    expect(screen.queryByText('Comparativo anual')).toBeNull();
  });

  it('comparativo_anual_so_com_melhor_mes', async () => {
    await abre();
    await vaiPara('Sugestoes');
    const bloco = screen.getByText('Comparativo anual').parentElement;
    expect(within(bloco).getByText(`Receita ${ANO}`).nextElementSibling.textContent).toBe('€620');
    expect(within(bloco).getByText(`Receita ${ANTERIOR}`).nextElementSibling.textContent).toBe('€600');
    expect(within(bloco).getByText('Variacao').nextElementSibling.textContent).toBe('+3%');
  });

  it('actualizar_repete_os_tres_pedidos', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: /Actualizar/ }));
    await waitFor(() => expect(getReceita).toHaveBeenCalledTimes(4));
    expect(listReservations).toHaveBeenCalledTimes(2);
  });

  it('servicos_a_falhar_dao_zeros', async () => {
    getReceita.mockRejectedValue(new Error('x'));
    listReservations.mockRejectedValue(new Error('x'));
    await abre();
    expect(kpi(`Receita ${ANO} (acumulado)`).textContent).toBe('€0');
    expect(kpi('Var. vs ano anterior').textContent).toBe('—');
    expect(kpi('Reservas proximos 30d').textContent).toBe('0');
    expect(screen.getByText('Sem dados financeiros disponiveis para o periodo.')).toBeTruthy();
  });

  it('resposta_nula_dos_servicos_tambem_da_zeros', async () => {
    getReceita.mockResolvedValue(null);
    listReservations.mockResolvedValue(null);
    await abre();
    expect(kpi('Reservas proximos 30d').textContent).toBe('0');
  });

  /* ---- design system ---- */
  const SEM_COR_CRUA = (html) => {
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(html).not.toMatch(/(?:bg|text|border|ring)-(?:red|green)-\d/);
  };

  it('os_separadores_sao_role_tab_com_aria_selected', async () => {
    await abre();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(t => t.textContent)).toEqual(['Historico', 'Proximos 30 dias', 'Sugestoes']);
    expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    fireEvent.click(screen.getByRole('tab', { name: 'Proximos 30 dias' }));
    expect(screen.getAllByRole('tab').map(t => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(screen.getByText('Reservas confirmadas — proximos 30 dias')).toBeTruthy();
  });

  it('nenhuma_cor_crua_sobra_nos_tres_separadores', async () => {
    const r = await abre();
    SEM_COR_CRUA(r.container.innerHTML);
    fireEvent.click(screen.getByRole('tab', { name: 'Proximos 30 dias' }));
    SEM_COR_CRUA(r.container.innerHTML);
    fireEvent.click(screen.getByRole('tab', { name: 'Sugestoes' }));
    SEM_COR_CRUA(r.container.innerHTML);
  });

  it('os_graficos_recebem_cores_var_token_e_nenhum_hexadecimal', async () => {
    await abre();
    const cores = [];
    document.querySelectorAll('[data-chart]').forEach(n => {
      ['data-fill', 'data-stroke', 'data-tickfill', 'data-labelfill'].forEach(a => {
        if (n.hasAttribute(a)) cores.push(n.getAttribute(a));
      });
    });
    expect(cores.length).toBeGreaterThan(8);
    cores.forEach(c => expect(c).toMatch(/^var\(--[a-z0-9-]+\)$/));
    /* grelha, linha da media, barras do ano anterior e as tres cores de epoca */
    expect(grafico('CartesianGrid')[0].getAttribute('data-stroke')).toBe('var(--n200)');
    expect(grafico('ReferenceLine')[0].getAttribute('data-stroke')).toBe('var(--sand-500)');
    expect(grafico('Bar')[0].getAttribute('data-fill')).toBe('var(--n200)');
    const celulas = grafico('Cell');
    expect(celulas[6].getAttribute('data-fill')).toBe('var(--success)');
    expect(celulas[7].getAttribute('data-fill')).toBe('var(--ocean-700)');
    expect(celulas[0].getAttribute('data-fill')).toBe('var(--ocean-400)');
  });

  it('a_sugestao_de_epoca_alta_usa_os_tokens_de_sucesso', async () => {
    await abre();
    fireEvent.click(screen.getByRole('tab', { name: 'Sugestoes' }));
    const alta = screen.getByText(/alta procura — considera/).parentElement;
    expect(alta.className).toContain('bg-[var(--success-light)]');
    expect(alta.className).toContain('border-[var(--success)]');
  });
});
