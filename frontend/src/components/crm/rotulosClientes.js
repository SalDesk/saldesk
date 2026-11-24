/* Etiquetas gravadas de um cliente (VIP, grupo, corporativo...). Em pt mostra-se o proprio valor, tal como
   sempre se leu; nas outras linguas vai a traducao. Uma etiqueta que o mapa nao conhece (escrita a mao)
   mostra-se tal e qual. */
const ETIQUETAS_TRADUZIDAS = ['VIP', 'grupo', 'corporativo', 'fidelizado', 'novo', 'recorrente', 'turista', 'local', 'empresa'];

export function rotuloEtiqueta(etiqueta, t, lang) {
  if (lang === 'pt' || !ETIQUETAS_TRADUZIDAS.includes(etiqueta)) return etiqueta;
  return t(`customersPage.tags.${etiqueta}`);
}
