/* Periodos de estadia para GET /reservations (stay_from, stay_to).
   Este e o unico sitio com os nomes dos parametros e a matematica de datas.
   Datas sempre em hora LOCAL (nunca toISOString, que e UTC). Intervalos inclusivos:
   o backend devolve reservas cuja estadia sobrepoe [stay_from, stay_to]. */

function doisDigitos(n) {
  return String(n).padStart(2, '0');
}

/* Formata ano/mes(0-11)/dia como YYYY-MM-DD; o Date normaliza transbordos (ex.: dia 32) */
function formatar(ano, mes, dia) {
  const d = new Date(ano, mes, dia);
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

/* Estadia sobreposta a [from, to]; sem `to`, usa o mesmo dia (YYYY-MM-DD) */
export function estadiaEm(from, to = from) {
  return { stay_from: from, stay_to: to };
}

/* Do primeiro ao ultimo dia do mes atual */
export function estadiaNoMes() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  return {
    stay_from: formatar(ano, mes, 1),
    stay_to: formatar(ano, mes + 1, 0), /* dia 0 do mes seguinte = ultimo dia deste mes */
  };
}

/* De hoje ate hoje+n-1 (7 = hoje..hoje+6); n inteiro >= 1 */
export function estadiaProximosDias(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`estadiaProximosDias: n tem de ser um inteiro >= 1 (recebido: ${n})`);
  }
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  const dia = agora.getDate();
  return {
    stay_from: formatar(ano, mes, dia),
    stay_to: formatar(ano, mes, dia + n - 1), /* construcao local: seguro com mudancas de hora */
  };
}
