/* utils/brandPalette: tons derivados da cor da marca e aplicacao como variaveis CSS na pagina publica. */
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { paletaDaCor, contrasteComBranco, corValida, aplicarCorDaMarca, useBrandColor, TONS, COR_ORIGINAL } from '../utils/brandPalette';

const luz = (rgb) => { const [r, g, b] = rgb.split(' ').map(Number); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const raiz = () => document.documentElement;

afterEach(() => {
  TONS.forEach((t) => raiz().style.removeProperty(`--brand-${t}-rgb`));
});

describe('paletaDaCor', () => {
  it('o tom 700 e exactamente a cor escolhida, em canais "r g b"', () => {
    expect(paletaDaCor('#0d5470')[700]).toBe('13 84 112');
    expect(paletaDaCor('#C2410C')[700]).toBe('194 65 12');
  });

  it('tem todos os tons e vao de escuro (900) a claro (50) sem inversoes', () => {
    const p = paletaDaCor('#c2410c');
    expect(Object.keys(p).map(Number).sort((a, b) => b - a)).toEqual([900, 800, 700, 600, 500, 400, 300, 200, 100, 50]);
    const ordem = [900, 800, 700, 600, 500, 400, 300, 200, 100, 50].map((t) => luz(p[t]));
    for (let i = 1; i < ordem.length; i++) expect(ordem[i]).toBeGreaterThan(ordem[i - 1]);
  });

  it('entrada invalida ou ausente devolve null', () => {
    expect(paletaDaCor(null)).toBeNull();
    expect(paletaDaCor('')).toBeNull();
    expect(paletaDaCor('azul')).toBeNull();
    expect(paletaDaCor('#12345')).toBeNull();
    expect(paletaDaCor('#12345g')).toBeNull();
  });
});

describe('contrasteComBranco e corValida', () => {
  it('contraste do branco: 21 sobre preto, 1 sobre branco, igual ao do backend para a cor original', () => {
    expect(contrasteComBranco('#000000')).toBeCloseTo(21, 1);
    expect(contrasteComBranco('#ffffff')).toBeCloseTo(1, 5);
    expect(contrasteComBranco(COR_ORIGINAL)).toBeGreaterThan(7);
  });

  it('corValida aceita #rrggbb legivel e recusa o resto, com motivo', () => {
    expect(corValida('#c2410c')).toEqual({ ok: true });
    expect(corValida('#ffe680')).toEqual({ ok: false, motivo: 'clara' });
    expect(corValida('amarelo')).toEqual({ ok: false, motivo: 'formato' });
    expect(corValida('#fff')).toEqual({ ok: false, motivo: 'formato' });
  });
});

describe('aplicarCorDaMarca', () => {
  it('define as variaveis na raiz e a funcao devolvida remove-as', () => {
    const limpar = aplicarCorDaMarca('#c2410c');
    expect(raiz().style.getPropertyValue('--brand-700-rgb')).toBe('194 65 12');
    TONS.forEach((t) => expect(raiz().style.getPropertyValue(`--brand-${t}-rgb`)).not.toBe(''));
    limpar();
    TONS.forEach((t) => expect(raiz().style.getPropertyValue(`--brand-${t}-rgb`)).toBe(''));
  });

  it('cor invalida ou ausente nao define nada (ficam os valores originais da marca)', () => {
    aplicarCorDaMarca('azul')();
    aplicarCorDaMarca(null)();
    TONS.forEach((t) => expect(raiz().style.getPropertyValue(`--brand-${t}-rgb`)).toBe(''));
  });
});

describe('useBrandColor', () => {
  it('aplica ao montar, actualiza quando a cor muda e limpa ao desmontar', () => {
    const { rerender, unmount } = renderHook(({ cor }) => useBrandColor(cor), { initialProps: { cor: '#c2410c' } });
    expect(raiz().style.getPropertyValue('--brand-700-rgb')).toBe('194 65 12');
    rerender({ cor: '#1f6f43' });
    expect(raiz().style.getPropertyValue('--brand-700-rgb')).toBe('31 111 67');
    rerender({ cor: null });
    expect(raiz().style.getPropertyValue('--brand-700-rgb')).toBe('');
    rerender({ cor: '#c2410c' });
    unmount();
    expect(raiz().style.getPropertyValue('--brand-700-rgb')).toBe('');
  });
});
