import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Weather from '../pages/Weather';
import { getWeatherForecast, weatherInfo } from '../services/weatherService';
import { listReservations } from '../services/reservationsService';
import { listIslands } from '../services/islandsService';

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
    expect(c[0].className).toContain('ring-2');
    expect(c[0].textContent).toContain('Hoje');
    expect(c[1].className).not.toContain('ring-2');
    expect(c[1].textContent).toContain('Amanha');
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
    expect(alerta.textContent).toContain('12mm precipitacao');
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
    expect(screen.getByText('12 mm precipitacao')).toBeTruthy();
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
    const detalhe = screen.getByRole('heading', { level: 3 }).closest('div.px-5');
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
    const detalhe = screen.getByRole('heading', { level: 3 }).closest('div.px-5');
    expect(within(detalhe).getByRole('link', { name: 'WhatsApp' }).getAttribute('href')).toBe('https://wa.me/447700900123');
  });

  it('detalhe_sem_tours_diz_Sem tours agendados para este dia', async () => {
    const r = await abre();
    fireEvent.click(cartoes(r)[4]);
    expect(screen.getByText('Sem tours agendados para este dia.')).toBeTruthy();
  });

  it('resumo_max_hoje_precipitacao_total_dias_sem_mau_tempo_e_conflitos', async () => {
    await abre();
    const valor = (rotulo) => screen.getByText(rotulo).previousElementSibling.textContent;
    expect(valor('Max. hoje')).toBe('30°');
    /* 0 + 0 + 12 + 8.5 + 0 + 0.5 + 3 = 24 */
    expect(valor('Precipitacao total 7 dias')).toBe('24 mm');
    /* maus: dia 2 (12 mm), dia 3 (codigo 80) e dia 6 (codigo 95) */
    expect(valor('Dias sem mau tempo')).toBe('4');
    expect(valor('Conflito(s) com tours')).toBe('1');
  });

  it('sem_conflitos_mostra_Sem conflitos meteorologicos', async () => {
    listReservations.mockResolvedValue([]);
    await abre();
    expect(screen.getByText('Sem conflitos meteorologicos').previousElementSibling.textContent).toBe('0');
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
    await screen.findByText('Nao foi possivel carregar a previsao meteorologica. Verifique a ligacao a internet.');
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
    await screen.findByText(/Nao foi possivel carregar a previsao meteorologica/);
    expect(screen.queryByText(/Mau tempo previsto para/)).toBeNull();
    expect(cartoes(r)).toHaveLength(0);
  });

  it('falha_nas_reservas_nao_rebenta', async () => {
    listReservations.mockRejectedValue(new Error('x'));
    const r = await abre();
    expect(cartoes(r)).toHaveLength(7);
    expect(screen.getByText('Sem conflitos meteorologicos')).toBeTruthy();
  });

  it('weatherInfo_devolve_etiqueta_e_icone_por_codigo', () => {
    const esperado = [
      [0, 'Ceu limpo', 'Sun'], [2, 'Maioritariamente limpo', 'Sun'], [3, 'Nublado', 'Cloud'],
      [45, 'Nevoeiro', 'CloudFog'], [53, 'Garoa', 'CloudDrizzle'], [63, 'Chuva', 'CloudRain'],
      [73, 'Neve', 'Cloud'], [81, 'Aguaceiros', 'CloudRain'], [95, 'Trovoada', 'CloudLightning'],
    ];
    for (const [codigo, etiqueta, icone] of esperado) {
      const info = weatherInfo(codigo);
      expect([codigo, info.label, info.iconName]).toEqual([codigo, etiqueta, icone]);
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
    const msg = await screen.findByText('Nao foi possivel carregar a previsao meteorologica. Verifique a ligacao a internet.');
    expect(msg.className).toContain('font-display');
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeTruthy();
  });
});
