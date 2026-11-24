import { formatarNumero, linguaActual } from './formatoLingua';

/* Nota media com uma casa decimal. Em portugues mantem-se o ponto de hoje ("4.5"); as outras linguas
   usam o seu separador decimal. */
export function formatarNota(valor, lang = linguaActual()) {
  const n = Number(valor);
  return lang === 'pt' ? n.toFixed(1) : formatarNumero(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 }, lang);
}
