import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Weather from '../pages/Weather';
import { getWeatherForecast, weatherInfo } from '../services/weatherService';
import { listReservations } from '../services/reservationsService';
import { listIslands } from '../services/islandsService';
import useUiStore from '../store/uiStore';
import ptJson from '../i18n/pt.json';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

/* Sem rede: so a previsao e os servicos da pagina sao simulados; weatherInfo, isBadWeather e dayLabel sao os reais */
vi.mock('../services/weatherService', async (importOriginal) => ({
  ...(await importOriginal()),
  getWeatherForecast: vi.fn(),
}));
vi.mock('../services/reservationsService', () => ({ listReservations: vi.fn() }));
vi.mock('../services/islandsService', () => ({ listIslands: vi.fn() }));
vi.mock('../store/authStore', () => ({
  default: () => ({ operator: { island_id: 'i1' } }),
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

/* mesma formula da pagina: data local do dispositivo */
function dia(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
}

/* 7 dias: 2 (chuva forte, 2 reservas activas + 1 cancelada = conflito), 3 (mau tempo sem reservas),
   5 (bom tempo com reserva), 6 (trovoada, so uma reserva cancelada = sem conflito) */
const PREVISAO = [
  { date: dia(0), tempMax: 30, tempMin: 22, precipitation: 0, code: 0 },
  { date: dia(1), tempMax: 29, tempMin: 22, precipitation: 0, code: 3 },
  { date: dia(2), tempMax: 27, tempMin: 21, precipitation: 12, code: 61 },
  { date: dia(3), tempMax: 26, tempMin: 20, precipitation: 8.5, code: 80 },
  { date: dia(4), tempMax: 28, tempMin: 21, precipitation: 0, code: 2 },
  { date: dia(5), tempMax: 31, tempMin: 23, precipitation: 0.5, code: 0 },
  { date: dia(6), tempMax: 25, tempMin: 20, precipitation: 3, code: 95 },
];
const RESERVAS = [
  { id: 'r1', status: 'confirmed', check_in: dia(2), guests: 3, units: { name: 'Buggy Tour' },
    customers: { name: 'Ana Ferreira', whatsapp: '+238 991 22 33', phone: '+238 111 11 11' } },
  { id: 'r2', status: 'pending', check_in: dia(2), unit_name: 'Mergulho', customer_name: 'John Smith' },
  { id: 'r3', status: 'cancelled', check_in: dia(2), guests: 9, units: { name: 'Cancelada' }, customers: { name: 'Zé' } },
  { id: 'r4', status: 'checked_in', check_in: dia(5), guests: 2, units: { name: 'Kitesurf' },
    customers: { name: 'Marie Dubois', phone: '+44 7700 900123' } },
  { id: 'r5', status: 'cancelled', check_in: dia(6), guests: 1, units: { name: 'Passeio' }, customers: { name: 'Pieter' } },
];
const ILHAS = [{ id: 'i1', name: 'Sal', lat: 16.73, lng: -22.93 }, { id: 'i2', name: 'Boa Vista', lat: 16.1, lng: -22.8 }];

function Local() {
  const { pathname, search } = useLocation();
  return <p data-testid="local">{pathname + search}</p>;
}

describe('Weather', () => {
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getWeatherForecast.mockReset().mockResolvedValue(PREVISAO);
    listReservations.mockReset().mockResolvedValue(RESERVAS);
    listIslands.mockReset().mockResolvedValue(ILHAS);
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
      <MemoryRouter future={FUTURE} initialEntries={['/meteorologia']}>
        <Routes>
          <Route path="/meteorologia" element={<Weather />} />
          <Route path="*" element={<Local />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(r.container.querySelectorAll('.grid.grid-cols-4 > button').length).toBeGreaterThan(0));
    return r;
  }

  function cartoes(r) {
    return [...r.container.querySelectorAll('.grid.grid-cols-4 > button')];
  }

  function fmt(data) {
    return new Date(data + 'T00:00:00Z').toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' });
  }

  it('titulo_com_a_ilha_e_chamada_a_previsao_com_lat_lng', async () => {
    await abre();
    expect(screen.getByRole('heading', { name: 'Meteorologia — Sal' })).toBeTruthy();
    expect(getWeatherForecast).toHaveBeenCalledWith(16.73, -22.93);
    /* o backend filtra por check_in_from/check_in_to (nao conhece from/to) */
    expect(listReservations).toHaveBeenCalledWith({ check_in_from: dia(0), check_in_to: dia(6) });
  });

  it('sem_ilha_a_previsao_pede_sem_coordenadas', async () => {
    listIslands.mockRejectedValue(new Error('x'));
    await abre();
    expect(screen.getByRole('heading', { name: 'Meteorologia' })).toBeTruthy();
    expect(getWeatherForecast).toHaveBeenCalledWith(undefined, undefined);
  });

  it('grelha_de_7_dias_com_temperaturas_precipitacao_e_n_tours', async () => {
    const r = await abre();
    const c = cartoes(r);
    expect(c).toHaveLength(7);
    expect(c[0].textContent).toContain('30°');
    expect(c[0].textContent).toContain('22°');
    expect(c[0].textContent).toContain('Ceu limpo');
    /* sem precipitacao nem tours: nada */
    expect(c[0].textContent).not.toContain('mm');
    expect(c[0].textContent).not.toContain('tour(s)');
    expect(c[2].textContent).toContain('12 mm');
    expect(c[2].textContent).toContain('2 tour(s)');
    expect(c[3].textContent).toContain('8.5 mm');
    /* a reserva cancelada nao conta */
    expect(c[6].textContent).not.toContain('tour(s)');
    expect(c[5].textContent).toContain('1 tour(s)');
  });

  it('hoje_tem_destaque', async () => {
    const r = await abre();
    const c = cartoes(r);
    /* classList: a classe do foco (focus-visible:ring-2) existe em todos os dias e nao conta */
    expect(c[0].classList.contains('ring-2')).toBe(true);
    expect(c[0].textContent).toContain('Hoje');
    expect(c[1].classList.contains('ring-2')).toBe(false);
    expect(c[1].textContent).toContain('Amanhã');
  });

  it('conflito_so_com_mau_tempo_e_reservas_activas', async () => {
    const r = await abre();
    /* um unico alerta: o dia 2. O dia 3 (mau tempo sem reservas) e o dia 6 (so cancelada) nao contam */
    expect(screen.getAllByText(/Mau tempo previsto para/)).toHaveLength(1);
    expect(screen.getByText(`Mau tempo previsto para ${fmt(dia(2))}`)).toBeTruthy();
    /* o cartao do dia em conflito destaca-se */
    expect(cartoes(r)[2].textContent).toContain('2 tour(s)');
  });

  it('alerta_de_conflito_mostra_tours_e_participantes_e_contactar_clientes_navega_para_reservas_date', async () => {
    await abre();
    const alerta = screen.getByText(/Mau tempo previsto para/).parentElement;
    /* r1 tem 3 pax, r2 nao tem guests = 1 */
    expect(alerta.textContent).toContain('Chuva');
    expect(alerta.textContent).toContain('12mm precipitação');
    expect(alerta.textContent).toContain('2 tour(s) agendado(s) com 4 participante(s)');
    fireEvent.click(screen.getByRole('button', { name: 'Contactar clientes' }));
    expect((await screen.findByTestId('local')).textContent).toBe(`/reservas?date=${dia(2)}`);
  });

  it('clicar_num_dia_abre_o_detalhe_e_clicar_outra_vez_fecha', async () => {
    const r = await abre();
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
    fireEvent.click(cartoes(r)[2]);
    const detalhe = screen.getByRole('heading', { level: 3 });
    expect(detalhe.textContent).toBe(fmt(dia(2)));
    expect(screen.getByText('27° / 21°')).toBeTruthy();
    expect(screen.getByText('12 mm precipitação')).toBeTruthy();
    fireEvent.click(cartoes(r)[2]);
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
    /* outro dia troca o detalhe */
    fireEvent.click(cartoes(r)[0]);
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(fmt(dia(0)));
    fireEvent.click(cartoes(r)[1]);
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(fmt(dia(1)));
  });

  it('detalhe_lista_tours_cliente_pax_e_whatsapp_so_com_telefone', async () => {
    const r = await abre();
    fireEvent.click(cartoes(r)[2]);
    const detalhe = screen.getByRole('heading', { level: 3 }).closest('section');
    expect(within(detalhe).getByText('2 tour(s) agendado(s)')).toBeTruthy();
    const linha1 = within(detalhe).getByText('Buggy Tour').closest('div.flex.items-center');
    expect(linha1.textContent).toContain('Ana Ferreira');
    expect(linha1.textContent).toContain('3 pax');
    /* o whatsapp tem prioridade sobre o telefone */
    expect(within(linha1).getByRole('link', { name: 'WhatsApp' }).getAttribute('href')).toBe('https://wa.me/2389912233');
    /* unit_name e customer_name como alternativa; sem guests = 1 pax; sem contacto = sem ligacao */
    const linha2 = within(detalhe).getByText('Mergulho').closest('div.flex.items-center');
    expect(linha2.textContent).toContain('John Smith');
    expect(linha2.textContent).toContain('1 pax');
    expect(within(linha2).queryByRole('link')).toBeNull();
    /* a cancelada nao aparece */
    expect(within(detalhe).queryByText('Cancelada')).toBeNull();
  });

  it('detalhe_com_so_telefone_usa_o_telefone', async () => {
    const r = await abre();
    fireEvent.click(cartoes(r)[5]);
    const detalhe = screen.getByRole('heading', { level: 3 }).closest('section');
    expect(within(detalhe).getByRole('link', { name: 'WhatsApp' }).getAttribute('href')).toBe('https://wa.me/447700900123');
  });

  it('detalhe_sem_tours_diz_Sem tours agendados para este dia', async () => {
    const r = await abre();
    fireEvent.click(cartoes(r)[4]);
    expect(screen.getByText('Sem tours agendados para este dia.')).toBeTruthy();
  });

  it('resumo_max_hoje_precipitacao_total_dias_sem_mau_tempo_e_conflitos', async () => {
    await abre();
    const valor = (rotulo) => screen.getByText(rotulo).closest('article').querySelector('p.font-display').textContent;
    expect(valor('Max. hoje')).toBe('30°');
    /* 0 + 0 + 12 + 8.5 + 0 + 0.5 + 3 = 24 */
    expect(valor('Precipitação total 7 dias')).toBe('24 mm');
    /* maus: dia 2 (12 mm), dia 3 (codigo 80) e dia 6 (codigo 95) */
    expect(valor('Dias sem mau tempo')).toBe('4');
    expect(valor('Conflito(s) com tours')).toBe('1');
  });

  it('sem_conflitos_mostra_Sem conflitos meteorológicos', async () => {
    listReservations.mockResolvedValue([]);
    await abre();
    expect(screen.getByText('Sem conflitos meteorológicos').closest('article').querySelector('p.font-display').textContent).toBe('0');
    expect(screen.queryByText(/Mau tempo previsto para/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Contactar clientes' })).toBeNull();
  });

  it('falha_do_servico_mostra_o_erro_e_tentar_novamente_recarrega', async () => {
    getWeatherForecast.mockRejectedValueOnce(new Error('x'));
    const r = render(
      <MemoryRouter future={FUTURE}>
        <Weather />
      </MemoryRouter>
    );
    await screen.findByText('Não foi possível carregar a previsão meteorológica. Verifique a ligação a internet.');
    expect(screen.queryByText('Max. hoje')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    await screen.findByText('Max. hoje');
    expect(getWeatherForecast).toHaveBeenCalledTimes(2);
    expect(r.container.querySelectorAll('.grid.grid-cols-4 > button')).toHaveLength(7);
  });

  it('actualizar_repete_os_pedidos', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: /Actualizar/ }));
    await waitFor(() => expect(getWeatherForecast).toHaveBeenCalledTimes(2));
    expect(listReservations).toHaveBeenCalledTimes(2);
  });

  it('se_a_recarga_da_previsao_falha_nao_ficam_alertas_nem_cartoes_antigos', async () => {
    const r = await abre();
    expect(screen.getAllByText(/Mau tempo previsto para/)).toHaveLength(1);
    getWeatherForecast.mockRejectedValue(new Error('x'));
    fireEvent.click(screen.getByRole('button', { name: /Actualizar/ }));
    await screen.findByText(/Não foi possível carregar a previsão meteorológica/);
    expect(screen.queryByText(/Mau tempo previsto para/)).toBeNull();
    expect(cartoes(r)).toHaveLength(0);
  });

  it('falha_nas_reservas_nao_rebenta', async () => {
    listReservations.mockRejectedValue(new Error('x'));
    const r = await abre();
    expect(cartoes(r)).toHaveLength(7);
    expect(screen.getByText('Sem conflitos meteorológicos')).toBeTruthy();
  });

  it('weatherInfo_devolve_etiqueta_e_icone_por_codigo', () => {
    const esperado = [
      [0, 'Ceu limpo', 'Sun'], [2, 'Maioritariamente limpo', 'Sun'], [3, 'Nublado', 'Cloud'],
      [45, 'Nevoeiro', 'CloudFog'], [53, 'Garoa', 'CloudDrizzle'], [63, 'Chuva', 'CloudRain'],
      [73, 'Neve', 'Cloud'], [81, 'Aguaceiros', 'CloudRain'], [95, 'Trovoada', 'CloudLightning'],
    ];
    for (const [codigo, etiqueta, icone] of esperado) {
      const info = weatherInfo(codigo);
      expect([codigo, ptJson.weather.conditions[info.chave], info.iconName]).toEqual([codigo, etiqueta, icone]);
    }
  });

  /* ---- design system ---- */
  const SEM_COR_CRUA = (html) => {
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(html).not.toMatch(/(?:bg|text|border|ring)-(?:red|blue|green)-\d/);
  };

  it('com_conflito_e_detalhe_aberto_nenhuma_cor_crua_sobra', async () => {
    const r = await abre();
    fireEvent.click(cartoes(r)[2]);
    SEM_COR_CRUA(r.container.innerHTML);
  });

  it('sem_conflito_nenhuma_cor_crua_sobra', async () => {
    listReservations.mockResolvedValue([]);
    const r = await abre();
    SEM_COR_CRUA(r.container.innerHTML);
  });

  it('detalhe_com_whatsapp_nenhuma_cor_crua_sobra', async () => {
    const r = await abre();
    fireEvent.click(cartoes(r)[5]);
    SEM_COR_CRUA(r.container.innerHTML);
    expect(within(r.container).getByRole('link', { name: 'WhatsApp' }).className).toContain('bg-[var(--success)]');
  });

  it('a_cor_do_icone_de_cada_dia_e_um_token', async () => {
    const r = await abre();
    const icones = [...r.container.querySelectorAll('.grid.grid-cols-4 > button svg')].filter(s => s.getAttribute('style'));
    expect(icones.length).toBe(7);
    icones.forEach(svg => expect(svg.getAttribute('style')).toMatch(/color:\s*var\(--/));
  });

  it('weatherInfo_devolve_sempre_a_cor_como_var_token', () => {
    for (const codigo of [0, 1, 2, 3, 45, 51, 55, 61, 65, 71, 75, 80, 82, 95, 99]) {
      expect(weatherInfo(codigo).color.startsWith('var(--')).toBe(true);
    }
  });

  it('o_erro_usa_o_estado_vazio_com_o_titulo_e_o_botao', async () => {
    getWeatherForecast.mockRejectedValue(new Error('x'));
    render(
      <MemoryRouter future={FUTURE}>
        <Weather />
      </MemoryRouter>
    );
    const msg = await screen.findByText('Não foi possível carregar a previsão meteorológica. Verifique a ligação a internet.');
    expect(msg.className).toContain('font-display');
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeTruthy();
  });

  /* ---- estilo Mare ---- */
  const mono = (el) => { expect(el.className).toContain('font-mono'); expect(el.className).toContain('tabular-nums'); };

  it('mostra_o_sobretitulo_da_area_Gestao_a_carregar_e_no_erro', async () => {
    render(<MemoryRouter future={FUTURE}><Weather /></MemoryRouter>);
    expect(document.querySelector('[data-eyebrow]').textContent).toBe('Gestão');
    await screen.findByText('Max. hoje');
    expect(document.querySelector('[data-eyebrow]').textContent).toBe('Gestão');
    cleanup();
    getWeatherForecast.mockRejectedValue(new Error('x'));
    render(<MemoryRouter future={FUTURE}><Weather /></MemoryRouter>);
    await screen.findByText(/Não foi possível carregar a previsão meteorológica/);
    expect(document.querySelector('[data-eyebrow]').textContent).toBe('Gestão');
  });

  it('os_quatro_numeros_do_resumo_sao_quadros_MareStat_com_os_mesmos_valores', async () => {
    await abre();
    const esperado = [['Max. hoje', '30°'], ['Precipitação total 7 dias', '24 mm'], ['Dias sem mau tempo', '4'], ['Conflito(s) com tours', '1']];
    for (const [rotulo, valor] of esperado) {
      const art = screen.getByText(rotulo, { selector: 'p' }).closest('article');
      expect(art.className).toContain('rounded-[18px]');
      expect(art.className).toContain('border-mare-card');
      expect(art.querySelector('p.font-display').textContent).toBe(valor);
    }
  });

  it('o_quadro_dos_conflitos_muda_de_tom_e_de_texto_nao_so_de_cor', async () => {
    await abre();
    const com = screen.getByText('Conflito(s) com tours').closest('article');
    expect(com.querySelector('[data-mare-stat-tint]').className).toContain('bg-sand-100');
    cleanup();
    listReservations.mockResolvedValue([]);
    await abre();
    const sem = screen.getByText('Sem conflitos meteorológicos').closest('article');
    expect(sem.querySelector('[data-mare-stat-tint]').className).toContain('bg-turquoise-100');
  });

  it('os_dias_sao_cartoes_Mare_com_numeros_em_mono', async () => {
    const r = await abre();
    const c = cartoes(r);
    /* dia normal: borda de cartao Mare; dia em conflito: borda de erro (nunca as duas) */
    expect(c[0].className).toContain('border-mare-card');
    expect(c[0].className).toContain('rounded-[18px]');
    expect(c[2].className).not.toContain('border-mare-card');
    expect(c[2].className).toContain('border-[var(--error)]');
    c.forEach(b => expect(b.className).toContain('focus-visible:ring-sand-500'));
    mono(within(c[0]).getByText('30°'));
    mono(within(c[0]).getByText('22°'));
    mono(within(c[2]).getByText('12 mm'));
    mono(within(c[0]).getByText('Hoje'));
    mono(within(c[2]).getByText('2 tour(s)'));
  });

  it('o_dia_em_conflito_leva_icone_alem_da_cor_e_o_texto_dos_tours', async () => {
    const r = await abre();
    const c = cartoes(r);
    expect(within(c[2]).getByText('2 tour(s)').querySelector('svg')).toBeTruthy();
    expect(within(c[5]).getByText('1 tour(s)').querySelector('svg')).toBeNull();
  });

  it('o_alerta_de_conflito_mantem_os_textos_com_icone_e_o_botao_sem_cores_proprias', async () => {
    await abre();
    const alerta = screen.getByText(/Mau tempo previsto para/).parentElement.parentElement;
    expect(alerta.className).toContain('rounded-[14px]');
    expect(alerta.querySelector('svg')).toBeTruthy();
    expect(alerta.textContent).toContain('Chuva');
    const botao = screen.getByRole('button', { name: 'Contactar clientes' });
    expect(botao.className).not.toContain('text-[var(--error)]');
    expect(botao.className).toContain('min-h-11');
  });

  it('o_detalhe_do_dia_e_um_cartao_Mare_com_titulo_Sora_e_numeros_em_mono', async () => {
    const r = await abre();
    fireEvent.click(cartoes(r)[2]);
    const h = screen.getByRole('heading', { level: 3 });
    expect(h.className).toContain('font-display');
    expect(h.className).toContain('text-lg');
    expect(h.className).toContain('text-ocean-900');
    const c = h.closest('section');
    expect(c.className).toContain('border-mare-card');
    expect(c.className).toContain('rounded-[18px]');
    expect(c.className).toContain('p-[22px]');
    mono(screen.getByText('27° / 21°'));
    mono(screen.getByText('12 mm precipitação'));
    mono(within(c).getByText('3 pax'));
    const linha = within(c).getByText('Buggy Tour').closest('div.flex.items-center');
    expect(linha.className).toContain('rounded-[14px]');
    /* fora do cartao o dia continua a abrir e a fechar */
    fireEvent.click(cartoes(r)[2]);
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });

  it('o_estado_de_erro_fica_num_cartao_Mare', async () => {
    getWeatherForecast.mockRejectedValue(new Error('x'));
    render(<MemoryRouter future={FUTURE}><Weather /></MemoryRouter>);
    const msg = await screen.findByText(/Não foi possível carregar a previsão meteorológica/);
    const c = msg.closest('section');
    expect(c.className).toContain('border-mare-card');
    expect(c.className).toContain('rounded-[18px]');
  });
});

/* ───────────────────────── Painel em ingles ───────────────────────── */

describe('Weather em inglês', () => {
  const DADOS = ['Buggy Tour', 'Mergulho', 'Ana Ferreira', 'John Smith', 'Kitesurf', 'Marie Dubois', 'Open-Meteo'];

  beforeEach(() => {
    useUiStore.setState({ lang: 'en' });
    getWeatherForecast.mockReset().mockResolvedValue(PREVISAO);
    listReservations.mockReset().mockResolvedValue(RESERVAS);
    listIslands.mockReset().mockResolvedValue(ILHAS);
  });
  afterEach(() => {
    cleanup();
    useUiStore.setState({ lang: 'pt' });
  });

  async function abreEmIngles() {
    const r = render(
      <MemoryRouter future={FUTURE} initialEntries={['/meteorologia']}>
        <Routes>
          <Route path="/meteorologia" element={<Weather />} />
          <Route path="*" element={<Local />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(r.container.querySelectorAll('.grid.grid-cols-4 > button').length).toBeGreaterThan(0));
    return r;
  }

  const fmtEn = (data) => new Date(data + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' });
  const curtaEn = (data) => new Date(data + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  const diaEn = (data) => new Date(data + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' });

  it('cartoes_alerta_e_resumo_em_ingles_sem_portugues', async () => {
    const r = await abreEmIngles();
    expect(screen.getByRole('heading', { name: 'Weather — Sal' })).toBeTruthy();
    expect(screen.getByText('7-day forecast · Open-Meteo')).toBeTruthy();
    const c = [...r.container.querySelectorAll('.grid.grid-cols-4 > button')];
    expect(c[0].textContent).toContain('Today');
    expect(c[0].textContent).toContain(curtaEn(dia(0)));
    expect(c[0].textContent).toContain('Clear sky');
    expect(c[1].textContent).toContain('Tomorrow');
    expect(c[1].textContent).toContain('Cloudy');
    /* os outros dias: dia da semana e data pelo en-GB */
    expect(c[2].textContent).toContain(diaEn(dia(2)));
    expect(c[2].textContent).toContain('Rain');
    expect(c[6].textContent).toContain('Thunderstorm');
    expect(screen.getByText(`Bad weather forecast for ${fmtEn(dia(2))}`)).toBeTruthy();
    const alerta = screen.getByText(/Bad weather forecast for/).parentElement;
    expect(alerta.textContent).toContain('Rain · 12mm precipitation · 2 tour(s) scheduled with 4 guest(s)');
    expect(screen.getByRole('button', { name: 'Contact customers' })).toBeTruthy();
    const valor = (rotulo) => screen.getByText(rotulo).closest('article').querySelector('p.font-display').textContent;
    expect(valor('Max. today')).toBe('30°');
    expect(valor('Total precipitation, 7 days')).toBe('24 mm');
    expect(valor('Days without bad weather')).toBe('4');
    expect(valor('Conflict(s) with tours')).toBe('1');
    expect(screen.getByText(/Updated automatically/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Refresh/ })).toBeTruthy();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['weather'])).toEqual([]);
  });

  it('detalhe_do_dia_em_ingles', async () => {
    const r = await abreEmIngles();
    const c = [...r.container.querySelectorAll('.grid.grid-cols-4 > button')];
    fireEvent.click(c[2]);
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(fmtEn(dia(2)));
    expect(screen.getByText('12 mm precipitation')).toBeTruthy();
    expect(screen.getByText('2 tour(s) scheduled')).toBeTruthy();
    fireEvent.click(c[4]);
    expect(screen.getByText('No tours scheduled for this day.')).toBeTruthy();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
  });

  it('sem_conflitos_e_erro_em_ingles', async () => {
    listReservations.mockResolvedValue([]);
    await abreEmIngles();
    expect(screen.getByText('No weather conflicts')).toBeTruthy();
    cleanup();
    getWeatherForecast.mockRejectedValue(new Error('x'));
    render(
      <MemoryRouter future={FUTURE}>
        <Weather />
      </MemoryRouter>
    );
    expect(await screen.findByText('Could not load the weather forecast. Check your internet connection.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeTruthy();
  });
});

describe('Weather: o dia da semana em português continua igual', () => {
  afterEach(() => cleanup());

  it('os_dias_depois_de_amanha_usam_o_formato_pt', async () => {
    useUiStore.setState({ lang: 'pt' });
    getWeatherForecast.mockReset().mockResolvedValue(PREVISAO);
    listReservations.mockReset().mockResolvedValue([]);
    listIslands.mockReset().mockResolvedValue(ILHAS);
    const r = render(
      <MemoryRouter future={FUTURE}>
        <Weather />
      </MemoryRouter>
    );
    await waitFor(() => expect(r.container.querySelectorAll('.grid.grid-cols-4 > button').length).toBe(7));
    const c = [...r.container.querySelectorAll('.grid.grid-cols-4 > button')];
    expect(c[2].textContent).toContain(new Date(dia(2) + 'T00:00:00Z').toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }));
    expect(c[2].textContent).toContain(new Date(dia(2) + 'T00:00:00Z').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', timeZone: 'UTC' }));
  });
});
