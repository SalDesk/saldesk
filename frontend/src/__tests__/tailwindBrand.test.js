/* A familia `brand` do Tailwind le variaveis CSS (--brand-<tom>-rgb) e, sem elas, e igual ao `ocean`:
   quem nao escolhe cor fica exactamente com o aspecto de sempre. */
import { describe, it, expect } from 'vitest';
import config from '../../tailwind.config.js';
import { TONS } from '../utils/brandPalette';

const cores = config.theme.extend.colors;
const canais = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

describe('tailwind: familia brand', () => {
  it('tem todos os tons que a paleta gera', () => {
    expect(Object.keys(cores.brand).map(Number).sort((a, b) => b - a)).toEqual([...TONS]);
  });

  it.each(TONS)('brand-%s le --brand-%s-rgb e, sem variavel, e a cor ocean correspondente (com suporte a opacidade)', (tom) => {
    expect(cores.brand[tom]).toBe(`rgb(var(--brand-${tom}-rgb, ${canais(cores.ocean[tom])}) / <alpha-value>)`);
  });

  it('a familia ocean continua com os valores fixos (a app do operador nao muda)', () => {
    expect(cores.ocean[700]).toBe('#0D5470');
    expect(cores.ocean[900]).toBe('#062A38');
  });
});
