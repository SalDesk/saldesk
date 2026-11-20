import { describe, it, expect } from 'vitest';
import { lerCoordenadas, dentroDeCaboVerde } from '../utils/coordenadas';

/* Coordenadas coladas pelo operador: par de numeros ou link do Google Maps */
describe('lerCoordenadas', () => {
  const PONTO = { lat: 16.7631, lng: -22.895 };

  it('le_par_de_numeros', () => {
    expect(lerCoordenadas('16.7631, -22.895')).toEqual(PONTO);
    expect(lerCoordenadas('16.7631,-22.895')).toEqual(PONTO);
    expect(lerCoordenadas(' 16.7631 ,  -22.895 ')).toEqual(PONTO);
  });

  it('le_links_do_google_maps', () => {
    expect(lerCoordenadas('https://www.google.com/maps/place/X/@16.7631,-22.895,15z')).toEqual(PONTO);
    expect(lerCoordenadas('https://maps.google.com/?q=16.7631,-22.895')).toEqual(PONTO);
    expect(lerCoordenadas('https://www.google.com/maps/place/X/data=!3d16.7631!4d-22.895')).toEqual(PONTO);
    /* com @ (camara) e !3d!4d (marcador), ganha o marcador */
    expect(lerCoordenadas('https://www.google.com/maps/place/X/@16.70,-22.80,14z/data=!4m6!3d16.7631!4d-22.895')).toEqual(PONTO);
    expect(lerCoordenadas('https://maps.google.com/?ll=16.7631,-22.895&z=14')).toEqual(PONTO);
  });

  it('link_sem_coordenadas_devolve_null', () => {
    expect(lerCoordenadas('https://maps.app.goo.gl/abc')).toBeNull();
    expect(lerCoordenadas('https://www.google.com/maps/place/Santa+Maria')).toBeNull();
  });

  it('valores_fora_do_planeta_ou_lixo_devolvem_null', () => {
    expect(lerCoordenadas('95, 10')).toBeNull();
    expect(lerCoordenadas('10, 200')).toBeNull();
    expect(lerCoordenadas('abc')).toBeNull();
    expect(lerCoordenadas('')).toBeNull();
    expect(lerCoordenadas(null)).toBeNull();
    expect(lerCoordenadas(undefined)).toBeNull();
  });
});

describe('dentroDeCaboVerde', () => {
  it('limites_de_cabo_verde', () => {
    expect(dentroDeCaboVerde(16.75, -22.93)).toBe(true);
    expect(dentroDeCaboVerde(14.5, -25.5)).toBe(true);
    expect(dentroDeCaboVerde(17.5, -22.5)).toBe(true);
    expect(dentroDeCaboVerde(38.7, -9.1)).toBe(false);
    expect(dentroDeCaboVerde(16.75, -21)).toBe(false);
    expect(dentroDeCaboVerde(NaN, -22.9)).toBe(false);
  });
});
