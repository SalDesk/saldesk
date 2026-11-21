import { useState, useEffect, useCallback } from 'react';
import useMediaQuery from './useMediaQuery';

/* Coluna fixa ao rolar ("sticky" com topo negativo), sem barra de scroll propria:
   - mais curta que o ecra: fica presa a 80 px do topo (abaixo da barra de navegacao);
   - mais alta: o topo fica negativo, a coluna rola com a pagina ate o fundo (o botao
     Reservar) ficar visivel a 16 px do fundo do ecra, e so ai fica presa. */
const TOPO = 80;
const MARGEM_FUNDO = 16;

export function topoColante(alturaColuna, alturaJanela) {
  return Math.min(TOPO, alturaJanela - alturaColuna - MARGEM_FUNDO);
}

/* So a partir de lg (onde a coluna e sticky). Devolve { ref, style }: ref (callback) vai no
   elemento sticky e style ({ top }) no mesmo elemento; abaixo de lg style e undefined. */
export default function useTopoColante() {
  const lg = useMediaQuery('(min-width: 1024px)');
  const [el, setEl] = useState(null);
  const [top, setTop] = useState(null);
  const ref = useCallback((no) => setEl(no), []);

  useEffect(() => {
    if (!lg || !el) {
      setTop(null);
      return undefined;
    }
    const medir = () => setTop(topoColante(el.offsetHeight, window.innerHeight));
    medir();
    window.addEventListener('resize', medir);
    const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    if (observador) observador.observe(el);
    return () => {
      window.removeEventListener('resize', medir);
      if (observador) observador.disconnect();
    };
  }, [lg, el]);

  return { ref, style: lg && top !== null ? { top: `${top}px` } : undefined };
}
