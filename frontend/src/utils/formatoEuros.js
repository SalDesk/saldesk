import { formatarNumero, linguaActual } from './formatoLingua';

/* Euros com sempre duas casas decimais. Em pt escreve-se como sempre (`€45.00`, sem separador de
   milhares); nas outras linguas usa os separadores da lingua (`€1,250.00` em ingles). */
export function eurosDuasCasas(valor, lang = linguaActual()) {
  const n = Number(valor);
  if (lang === 'pt') return `€${n.toFixed(2)}`;
  return `€${formatarNumero(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, lang)}`;
}
