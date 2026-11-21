import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useTopoColante, { topoColante } from '../hooks/useTopoColante';

/* Coluna fixa com topo negativo: mais alta que o ecra, rola com a pagina ate o fundo
   (o botao Reservar) ficar visivel e so depois fica presa; mais curta fica a 80 px. */
describe('topoColante', () => {
  it('coluna mais alta que o ecra da topo negativo', () => {
    expect(topoColante(1000, 760)).toBe(760 - 1000 - 16);
  });

  it('coluna curta fica a 80', () => {
    expect(topoColante(500, 760)).toBe(80);
  });
});

describe('useTopoColante', () => {
  let observadores;
  let alturaJanela;

  function ecraLg(lg) {
    vi.stubGlobal('matchMedia', vi.fn((q) => ({
      matches: lg && q === '(min-width: 1024px)', media: q,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
  }
  function coluna(altura) {
    const el = document.createElement('div');
    Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => altura.valor });
    return el;
  }

  beforeEach(() => {
    observadores = [];
    alturaJanela = window.innerHeight;
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb) { this.cb = cb; this.observe = vi.fn(); this.disconnect = vi.fn(); observadores.push(this); }
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 760 });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: alturaJanela });
  });

  it('em lg mede a coluna e acompanha o tamanho dela e da janela', () => {
    ecraLg(true);
    const altura = { valor: 1000 };
    const { result } = renderHook(() => useTopoColante());
    act(() => result.current.ref(coluna(altura)));
    expect(result.current.style).toEqual({ top: '-256px' });
    expect(observadores).toHaveLength(1);
    expect(observadores[0].observe).toHaveBeenCalled();

    altura.valor = 500;
    act(() => observadores[0].cb([]));
    expect(result.current.style).toEqual({ top: '80px' });

    window.innerHeight = 400;
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(result.current.style).toEqual({ top: '-116px' });
  });

  it('abaixo de lg nao mexe no topo', () => {
    ecraLg(false);
    const { result } = renderHook(() => useTopoColante());
    act(() => result.current.ref(coluna({ valor: 1000 })));
    expect(result.current.style).toBeUndefined();
  });

  it('ao desmontar deixa de observar', () => {
    ecraLg(true);
    const { result, unmount } = renderHook(() => useTopoColante());
    act(() => result.current.ref(coluna({ valor: 1000 })));
    unmount();
    expect(observadores[0].disconnect).toHaveBeenCalled();
  });
});
