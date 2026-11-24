/* Rotulos do calendario na lingua do painel. Os valores gravados (estados, meses por indice) nunca mudam;
   so o texto mostrado passa pelas chaves calendar.* e reservations.status.* */
import { formatarData, formatarNumero } from '../../utils/formatoLingua';

const MES_CHAVE = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DIA_CHAVE = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const ESTADOS_CONHECIDOS = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];

/* Nome completo do mes pelo indice 0-11 (em pt: Janeiro ... Dezembro, como sempre) */
export const nomeMes = (indice, t) => t(`calendar.months.${MES_CHAVE[indice]}`);

/* Abreviatura do dia pelo indice da semana (0 = domingo) e inicial de uma letra */
export const diaAbreviado = (indice, t) => t(`calendar.weekdays.${DIA_CHAVE[indice]}`);
export const diaInicial = (indice, t) => t(`calendar.weekdaysInitial.${DIA_CHAVE[indice]}`);

/* Rotulo do estado de uma reserva; um estado desconhecido mostra-se tal e qual */
export function rotuloEstado(estado, t) {
  if (estado === 'no_show') return t('calendar.noShow');
  if (ESTADOS_CONHECIDOS.includes(estado)) return t(`reservations.status.${estado}`);
  return estado;
}

/* Data AAAA-MM-DD: em pt mostra-se como sempre (o texto gravado); nas outras linguas no formato da lingua */
export function dataVista(data, lang) {
  return lang === 'pt' ? data : formatarData(data, {}, lang);
}

/* Montante em euros: em pt como sempre; nas outras linguas com os separadores da lingua */
export function eurosVista(valor, lang) {
  return `€${formatarNumero(valor, {}, lang)}`;
}
