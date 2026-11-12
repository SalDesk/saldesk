import { useEffect } from 'react';

/* Modo "widget": activado via ?widget=1 quando a pagina publica e embebida
   num iframe no site do proprio operador (ver Marketing > Widget).

   Tem de sobreviver a navegacao interna (ex: PublicBooking -> ServiceDetail) sem propagar o
   query param em cada link/navigate(): guarda-se em memoria da pagina (uma variavel do modulo)
   e, quando a pagina esta num iframe, tambem em window.name (que e proprio de cada iframe e
   sobrevive a recarregar a pagina).

   Antes guardava-se em sessionStorage, que e partilhado por todas as paginas do mesmo dominio no
   mesmo separador: o preview do widget na app do operador (mesmo dominio) deixava o separador em
   modo widget e a pagina publica abria depois sem cabecalho nem rodape. */
const MARCA = 'sd-widget';
let activadoNestaPagina = false;

function estaNumIframe() {
  try { return window.self !== window.top; } catch { return true; }
}

export function useIsWidget(searchParams) {
  const fromQuery = searchParams.get('widget') === '1';

  useEffect(() => {
    if (!fromQuery) return;
    activadoNestaPagina = true;
    if (estaNumIframe()) {
      try { window.name = MARCA; } catch { /* ignore */ }
    }
  }, [fromQuery]);

  let guardado = activadoNestaPagina;
  if (!guardado && estaNumIframe()) {
    try { guardado = window.name === MARCA; } catch { /* ignore */ }
  }

  return fromQuery || guardado;
}

/* Alvo do formulario que envia o cliente para a pagina de pagamento do banco (SISP): os bancos
   recusam ser abertos dentro de um iframe, por isso num widget abre no separador inteiro. */
export function alvoDoPagamento() {
  return estaNumIframe() ? '_top' : '_self';
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
