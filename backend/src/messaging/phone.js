/* Normalizacao de numeros para E.164.

   customers.phone / reservations.customer_phone sao texto livre (espacos, tracos,
   parenteses, com ou sem indicativo). O wa.me exige o indicativo do pais, por isso:
     - "+238 999 1234" / "00238 9991234"  -> +2389991234
     - "999 1234" (7 digitos)             -> assume Cabo Verde: +2389991234
     - 8 a 15 digitos sem "+"             -> assume que ja traz o indicativo
   Qualquer outra coisa devolve null: e melhor avisar o operador que o numero nao serve
   do que abrir uma conversa para o numero errado. */

const INDICATIVO_CABO_VERDE = '238';

function paraE164(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim().replace(/^whatsapp:/i, '');
  if (!s) return null;

  const temMais = s.startsWith('+');
  let digitos = s.replace(/\D/g, '');
  if (!digitos) return null;

  if (!temMais && digitos.startsWith('00')) {
    digitos = digitos.slice(2);
  } else if (!temMais && digitos.length === 7) {
    digitos = INDICATIVO_CABO_VERDE + digitos;
  }

  if (digitos.length < 8 || digitos.length > 15) return null;
  return `+${digitos}`;
}

/* wa.me quer so digitos, sem "+". */
function soDigitos(e164) {
  return String(e164 || '').replace(/\D/g, '');
}

module.exports = { paraE164, soDigitos };
