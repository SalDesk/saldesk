/* Menu de seccoes da pagina de actividade, fixo por baixo da barra de topo. Um link por seccao que
   existe (ids de seccoesActividade); a seccao a vista fica marcada. Desliza na horizontal em
   ecras estreitos, sem alargar a pagina. */
import { useEffect, useState } from 'react';
import { tituloSeccao } from './SeccoesActividade';

export default function MenuSeccoes({ ids, lang }) {
  const lista = Array.isArray(ids) ? ids : [];
  const [activa, setActiva] = useState(lista[0] || null);
  const chave = lista.join('|');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const obs = new IntersectionObserver((entradas) => {
      const vista = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vista) setActiva(vista.target.id);
    }, { rootMargin: '-130px 0px -55% 0px' });
    chave.split('|').forEach((id) => { const el = id && document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [chave]);

  function ir(e, id) {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const reduzir = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' });
    el.querySelector('h2')?.focus({ preventScroll: true });
    setActiva(id);
  }

  if (lista.length < 2) return null;
  return (
    <nav aria-label={lang === 'en' ? 'Page sections' : 'Secções da página'}
      className="sticky top-14 z-30 -mx-4 px-4 sm:mx-0 sm:px-0 bg-white/95 backdrop-blur-sm border-b border-n-200">
      <ul className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {lista.map((id) => (
          <li key={id} className="flex-shrink-0">
            <a href={`#${id}`} onClick={(e) => ir(e, id)} aria-current={activa === id ? 'true' : undefined}
              className={`block whitespace-nowrap px-3.5 py-2 rounded-full text-sm font-body font-semibold transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${activa === id ? 'bg-brand-50 text-brand-800' : 'text-n-600 hover:bg-n-100 hover:text-n-900'}`}>
              {tituloSeccao(id, lang)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
