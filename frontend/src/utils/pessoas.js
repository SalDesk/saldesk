/* Numero de pessoas por extenso, com singular e plural ("1 adulto", "2 crianças").
   lang 'en' em ingles; qualquer outro valor em portugues. */
export function textoAdultos(n, lang) {
  const en = lang === 'en';
  if (Number(n) === 1) return `${n} ${en ? 'adult' : 'adulto'}`;
  return `${n} ${en ? 'adults' : 'adultos'}`;
}

export function textoCriancas(n, lang) {
  const en = lang === 'en';
  if (Number(n) === 1) return `${n} ${en ? 'child' : 'criança'}`;
  return `${n} ${en ? 'children' : 'crianças'}`;
}
