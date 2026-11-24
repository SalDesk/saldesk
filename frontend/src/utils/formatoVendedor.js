import { formatarNumero, linguaActual } from './formatoLingua';
import { rotuloMes } from './rotuloMes';

/* Chaves dos dias da semana pela ordem de Date.getUTCDay() (domingo = 0): staff.days tem em pt o mesmo
   texto de sempre (Dom, Seg, Ter...). */
const DIA_CHAVE = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/* "Seg 24 Nov" na lingua do painel, a partir de AAAA-MM-DD (sem desvio de fuso) */
export function rotuloDiaMes(dataTexto, t) {
  const d = new Date(`${dataTexto}T00:00:00Z`);
  return `${t(`staff.days.${DIA_CHAVE[d.getUTCDay()]}`)} ${d.getUTCDate()} ${rotuloMes(d.getUTCMonth(), t)}`;
}

/* Preco de tabela tal como esta gravado (sem arredondar): em pt escreve-se como sempre, sem separador de
   milhares; nas outras linguas com os separadores da lingua e ate 2 casas decimais. */
export function euroPreco(valor, lang = linguaActual()) {
  return lang === 'pt' ? `€${valor}` : `€${formatarNumero(valor, { maximumFractionDigits: 2 }, lang)}`;
}
