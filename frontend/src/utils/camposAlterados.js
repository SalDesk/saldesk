/* Campos de 'actual' cujo valor mudou em relacao a 'base' (o que estava gravado quando o formulario
   abriu ou na ultima gravacao). Listas e objectos comparam-se pelo conteudo; null e ausente sao iguais.
   Serve para guardar so o que o operador mudou: um separador antigo das Definicoes nao apaga o que
   outro separador (ou outra pessoa da equipa) gravou entretanto noutros campos. */
export function camposAlterados(base, actual) {
  const b = base || {};
  const out = {};
  Object.keys(actual || {}).forEach((k) => {
    if (JSON.stringify(actual[k] ?? null) !== JSON.stringify(b[k] ?? null)) out[k] = actual[k];
  });
  return out;
}
