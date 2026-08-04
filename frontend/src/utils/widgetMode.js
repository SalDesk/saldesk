import { useEffect } from 'react';

/* Modo "widget": activado via ?widget=1 quando a pagina publica e embebida
   num iframe no site do proprio operador (ver Definicoes > Marketing).
   Guardamos em sessionStorage para sobreviver a navegacao interna
   (ex: PublicBooking -> ServiceDetail) sem precisar propagar o query param
   em cada link/navigate() do ficheiro. */
const STORAGE_KEY = 'sd-widget';

export function useIsWidget(searchParams) {
  const fromQuery = searchParams.get('widget') === '1';

  useEffect(() => {
    if (fromQuery) {
      try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    }
  }, [fromQuery]);

  let fromSession = false;
  try { fromSession = sessionStorage.getItem(STORAGE_KEY) === '1'; } catch { /* ignore */ }

  return fromQuery || fromSession;
}

/* Avisa a pagina-pai (via postMessage) da altura real do conteudo, para o
   snippet do widget poder ajustar a altura do iframe automaticamente. */
export function useWidgetResize(isWidget) {
  useEffect(() => {
    if (!isWidget || typeof ResizeObserver === 'undefined') return;

    const report = () => {
      try {
        window.parent.postMessage(
          { type: 'saldesk-widget-resize', height: document.body.scrollHeight },
          '*'
        );
      } catch { /* ignore */ }
    };

    report();
    const observer = new ResizeObserver(report);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [isWidget]);
}
