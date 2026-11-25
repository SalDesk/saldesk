import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWeatherForecast, ventoForte } from '../services/weatherService';

afterEach(() => vi.unstubAllGlobals());

function respostaDaApi(daily) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ daily }) }));
}

describe('getWeatherForecast', () => {
  it('pede o vento maximo e a direccao dominante e mapeia-os para cada dia', async () => {
    respostaDaApi({
      time: ['2026-11-25', '2026-11-26'],
      temperature_2m_max: [27.4, 26.6], temperature_2m_min: [21.2, 20.9],
      precipitation_sum: [0, 1.26], weathercode: [0, 61],
      wind_speed_10m_max: [37.6, 18.2], wind_direction_10m_dominant: [44.6, 200],
    });
    const dias = await getWeatherForecast();
    expect(fetch.mock.calls[0][0]).toContain('wind_speed_10m_max');
    expect(fetch.mock.calls[0][0]).toContain('wind_direction_10m_dominant');
    expect(dias[0]).toEqual({
      date: '2026-11-25', tempMax: 27, tempMin: 21, precipitation: 0, code: 0, ventoKmh: 38, ventoDirecao: 45,
    });
    /* os campos que ja existiam ficam como estavam */
    expect(dias[1]).toMatchObject({ tempMax: 27, tempMin: 21, precipitation: 1.3, code: 61, ventoKmh: 18, ventoDirecao: 200 });
  });

  it('sem vento na resposta os campos ficam a null em vez de partir', async () => {
    respostaDaApi({
      time: ['2026-11-25'], temperature_2m_max: [27], temperature_2m_min: [21],
      precipitation_sum: [0], weathercode: [0],
    });
    const [dia] = await getWeatherForecast();
    expect(dia.ventoKmh).toBeNull();
    expect(dia.ventoDirecao).toBeNull();
  });
});

describe('ventoForte', () => {
  it('35 km/h ja e forte e 34 nao', () => {
    expect(ventoForte({ ventoKmh: 35 })).toBe(true);
    expect(ventoForte({ ventoKmh: 34 })).toBe(false);
  });

  it('aceita outro limite e nao avisa sem vento conhecido', () => {
    expect(ventoForte({ ventoKmh: 25 }, 25)).toBe(true);
    expect(ventoForte({ ventoKmh: null })).toBe(false);
    expect(ventoForte({})).toBe(false);
    expect(ventoForte(undefined)).toBe(false);
  });
});
