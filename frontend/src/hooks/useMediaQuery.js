import { useState, useEffect } from 'react';

/* true enquanto a media query corresponde (ex: '(max-width: 767px)'); acompanha mudancas de tamanho/orientacao.
   Sem matchMedia (testes, browsers antigos) devolve sempre false. */
export default function useMediaQuery(query) {
  const suportado = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const [corresponde, setCorresponde] = useState(() => (suportado ? window.matchMedia(query).matches : false));

  useEffect(() => {
    if (!suportado) return undefined;
    const mql = window.matchMedia(query);
    const aoMudar = (e) => setCorresponde(e.matches);
    setCorresponde(mql.matches);
    mql.addEventListener('change', aoMudar);
    return () => mql.removeEventListener('change', aoMudar);
  }, [query, suportado]);

  return corresponde;
}
