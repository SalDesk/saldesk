/* Idioma inicial das paginas publicas (reserva, ficha de servico, pos-pagamento).
   Respeita a escolha guardada pelo visitante; sem escolha, segue o idioma do
   browser: portugues so para browsers em portugues, ingles para o resto (o
   site publico so tem PT e EN). Determinista, para que as paginas
   pos-pagamento mostrem o mesmo idioma que a ficha onde a reserva foi feita. */
export default function initialLang() {
  try {
    const saved = localStorage.getItem('sd-lang');
    if (saved === 'pt' || saved === 'en') return saved;
  } catch { /* localStorage indisponivel: cai na deteccao do browser */ }
  const nav = (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || 'pt';
  return String(nav).toLowerCase().startsWith('pt') ? 'pt' : 'en';
}
