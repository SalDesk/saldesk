import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

/* O modo widget vive em memoria da pagina (e em window.name quando a pagina esta num iframe).
   Cada teste carrega o modulo de novo para comecar sem estado. */
async function carregar() {
  vi.resetModules();
  return import('../utils/widgetMode');
}

function emIframe(valor) {
  Object.defineProperty(window, 'top', { value: valor ? {} : window, configurable: true });
}

describe('modo widget', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.name = '';
    emIframe(false);
  });
  afterEach(() => {
    Object.defineProperty(window, 'top', { value: window, configurable: true });
    window.name = '';
    sessionStorage.clear();
  });

  it('?widget=1 activa o modo e continua activo na navegacao interna sem o parametro', async () => {
    const { useIsWidget } = await carregar();
    const a = renderHook(() => useIsWidget(new URLSearchParams('widget=1')));
    expect(a.result.current).toBe(true);
    a.unmount();
    /* a pagina seguinte (outra rota) ja nao traz o parametro */
    const b = renderHook(() => useIsWidget(new URLSearchParams('')));
    expect(b.result.current).toBe(true);
  });

  it('sem ?widget=1 nunca activa o modo', async () => {
    const { useIsWidget } = await carregar();
    const a = renderHook(() => useIsWidget(new URLSearchParams('')));
    expect(a.result.current).toBe(false);
  });

  it('nao escreve no sessionStorage: o preview do widget (mesmo dominio) nao pode deixar o separador do operador em modo widget', async () => {
    const { useIsWidget } = await carregar();
    renderHook(() => useIsWidget(new URLSearchParams('widget=1')));
    expect(sessionStorage.getItem('sd-widget')).toBeNull();
    expect(sessionStorage.length).toBe(0);
    /* e ignora uma marca antiga deixada por versoes anteriores */
    sessionStorage.setItem('sd-widget', '1');
    const nova = await carregar();
    const b = renderHook(() => nova.useIsWidget(new URLSearchParams('')));
    expect(b.result.current).toBe(false);
  });

  it('dentro de um iframe guarda a marca em window.name e sobrevive a recarregar a pagina', async () => {
    emIframe(true);
    const { useIsWidget } = await carregar();
    renderHook(() => useIsWidget(new URLSearchParams('widget=1')));
    expect(window.name).toBe('sd-widget');
    /* recarregar: modulo novo, sem parametro, mesma janela (mesmo window.name) */
    const depois = await carregar();
    const b = renderHook(() => depois.useIsWidget(new URLSearchParams('')));
    expect(b.result.current).toBe(true);
  });

  it('fora de um iframe nao mexe em window.name', async () => {
    const { useIsWidget } = await carregar();
    renderHook(() => useIsWidget(new URLSearchParams('widget=1')));
    expect(window.name).toBe('');
  });

  it('o formulario de pagamento SISP abre no separador inteiro quando a pagina esta num iframe', async () => {
    const { alvoDoPagamento } = await carregar();
    expect(alvoDoPagamento()).toBe('_self');
    emIframe(true);
    expect(alvoDoPagamento()).toBe('_top');
  });

  it('useWidgetResize avisa a pagina-pai da altura real com postMessage', async () => {
    const { useWidgetResize } = await carregar();
    const pai = { postMessage: vi.fn() };
    Object.defineProperty(window, 'parent', { value: pai, configurable: true });
    class RO { constructor(f) { this.f = f; } observe() {} disconnect() {} }
    vi.stubGlobal('ResizeObserver', RO);
    renderHook(() => useWidgetResize(true));
    expect(pai.postMessage).toHaveBeenCalledWith({ type: 'saldesk-widget-resize', height: document.body.scrollHeight }, '*');
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'parent', { value: window, configurable: true });
  });
});
