import useUiStore from '../store/uiStore';

/* Locale de formatacao por lingua do painel */
export const LOCALES = { pt: 'pt-PT', en: 'en-GB', de: 'de-DE', nl: 'nl-NL' };

/* Lingua actual do painel (fora de componentes); cai em 'pt' se desconhecida */
export function linguaActual() {
  const l = useUiStore.getState().lang;
  return Object.prototype.hasOwnProperty.call(LOCALES, l) ? l : 'pt';
}

/* Hook: subscreve a lingua para o componente voltar a desenhar ao mudar */
export function useLingua() {
  const l = useUiStore((s) => s.lang);
  return Object.prototype.hasOwnProperty.call(LOCALES, l) ? l : 'pt';
}

export function localeDe(lang = linguaActual()) {
  return LOCALES[lang] || LOCALES.pt;
}

export function formatarNumero(n, opcoes = {}, lang = linguaActual()) {
  return Number(n).toLocaleString(localeDe(lang), opcoes);
}

/* Aceita Date ou texto; YYYY-MM-DD le-se como data local (sem desvio UTC) */
export function formatarData(valor, opcoes = {}, lang = linguaActual()) {
  let d = valor;
  if (typeof valor === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
    d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(valor);
  }
  return d.toLocaleDateString(localeDe(lang), opcoes);
}
