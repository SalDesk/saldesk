/* Galeria da pagina de actividade (uma foto grande e ate quatro pequenas, "+N fotos" na ultima) e
   o visualizador de fotos (Lightbox), partilhado com as fichas de alojamento e viatura
   (ServiceDetail importa-o daqui). So fotos reais da unidade: sem fotos, nao ha galeria.
   Spec: docs/superpowers/specs/2026-11-21-pagina-servico-completa-design.md */
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Camera } from 'lucide-react';

const FOCO_ESCURO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black';
const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2';

/* Visor de fotos: Esc fecha, setas mudam de foto, deslizar no telemovel tambem. O foco fica dentro
   do visor enquanto esta aberto e volta ao elemento de onde se abriu ao fechar. */
export function Lightbox({ images, idx, onClose, onMove, lang = 'pt' }) {
  const en = lang === 'en';
  const caixa = useRef(null);
  const fechar = useRef(null);
  const toque = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onMove(-1);
      if (e.key === 'ArrowRight') onMove(1);
      if (e.key === 'Tab' && caixa.current) {
        const botoes = Array.from(caixa.current.querySelectorAll('button'));
        if (!botoes.length) return;
        const i = botoes.indexOf(document.activeElement);
        const destino = e.shiftKey ? (i <= 0 ? botoes.length - 1 : i - 1) : (i === -1 || i === botoes.length - 1 ? 0 : i + 1);
        e.preventDefault();
        botoes[destino].focus();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, onMove]);

  useEffect(() => {
    const antes = document.activeElement;
    fechar.current?.focus();
    return () => { if (antes && typeof antes.focus === 'function') antes.focus(); };
  }, []);

  function inicioToque(e) { toque.current = e.touches?.[0]?.clientX ?? null; }
  function fimToque(e) {
    const x = e.changedTouches?.[0]?.clientX;
    if (toque.current === null || typeof x !== 'number') return;
    const dx = x - toque.current;
    toque.current = null;
    if (Math.abs(dx) > 40) onMove(dx > 0 ? -1 : 1);
  }

  return (
    <div ref={caixa} role="dialog" aria-modal="true" aria-label={en ? 'Photos' : 'Fotografias'}
      className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center" onClick={onClose}
      onTouchStart={inicioToque} onTouchEnd={fimToque}>
      <button type="button" aria-label={en ? 'Previous photo' : 'Foto anterior'} onClick={e=>{e.stopPropagation();onMove(-1);}} className={`absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 ${FOCO_ESCURO}`}><ChevronLeft size={20} strokeWidth={2}/></button>
      <img src={images[idx]} alt="" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" onClick={e=>e.stopPropagation()}/>
      <button type="button" aria-label={en ? 'Next photo' : 'Foto seguinte'} onClick={e=>{e.stopPropagation();onMove(1);}} className={`absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 ${FOCO_ESCURO}`}><ChevronRight size={20} strokeWidth={2}/></button>
      <button ref={fechar} type="button" aria-label={en ? 'Close' : 'Fechar'} onClick={onClose} className={`absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 ${FOCO_ESCURO}`}><X size={18} strokeWidth={2}/></button>
      <span aria-live="polite" className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm font-body">{idx+1} / {images.length}</span>
    </div>
  );
}

/* Quantas fotos pequenas cabem: 4 (grelha 4x2), 2 (grelha 3x2), 1 (lado a lado) ou nenhuma */
function quantasPequenas(resto) {
  if (resto >= 4) return 4;
  if (resto >= 2) return 2;
  return resto;
}
const GRELHA = { 0: '', 1: 'md:grid-cols-2', 2: 'md:grid-cols-3 md:grid-rows-2', 4: 'md:grid-cols-4 md:grid-rows-2' };

export default function GaleriaActividade({ images, titulo, lang }) {
  const en = lang === 'en';
  const fotos = (Array.isArray(images) ? images : []).filter((s) => typeof s === 'string' && s.trim());
  const [aberta, setAberta] = useState(null);
  if (!fotos.length) return null;

  const n = quantasPequenas(fotos.length - 1);
  const pequenas = fotos.slice(1, 1 + n);
  const escondidas = fotos.length - 1 - n;
  const rotulo = (i) => (en ? `Open photo ${i + 1} of ${fotos.length}` : `Abrir foto ${i + 1} de ${fotos.length}`);
  const imagem = 'w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100';

  return (
    <div className="relative mt-5">
      <div className={`grid grid-cols-1 gap-2 h-64 sm:h-80 md:h-[420px] ${GRELHA[n]}`}>
        <button type="button" onClick={() => setAberta(0)} aria-label={rotulo(0)}
          className={`relative overflow-hidden rounded-2xl bg-n-100 group ${n >= 2 ? 'md:col-span-2 md:row-span-2' : ''} ${FOCO}`}>
          <img src={fotos[0]} alt={titulo || ''} className={imagem}/>
        </button>
        {pequenas.map((src, i) => (
          <button key={i} type="button" onClick={() => setAberta(i + 1)} aria-label={rotulo(i + 1)}
            className={`hidden md:block relative overflow-hidden rounded-2xl bg-n-100 group ${FOCO}`}>
            <img src={src} alt="" className={imagem}/>
            {i === pequenas.length - 1 && escondidas > 0 && (
              <span className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center text-white">
                <Camera size={22} strokeWidth={1.75} aria-hidden="true"/>
                <span className="font-display font-bold text-sm mt-1">{en ? `+${escondidas} photos` : `+${escondidas} fotos`}</span>
              </span>
            )}
          </button>
        ))}
      </div>
      {fotos.length > 1 && (
        <button type="button" onClick={() => setAberta(0)}
          className={`md:hidden absolute bottom-3 right-3 flex items-center gap-1.5 bg-white text-n-800 text-xs font-body font-semibold px-3 py-2 rounded-lg shadow-md border border-n-200 ${FOCO}`}>
          <Camera size={14} strokeWidth={1.75} aria-hidden="true"/>
          {en ? `See all ${fotos.length} photos` : `Ver as ${fotos.length} fotos`}
        </button>
      )}
      {aberta !== null && (
        <Lightbox images={fotos} idx={aberta} lang={lang} onClose={() => setAberta(null)}
          onMove={(d) => setAberta((i) => (i + d + fotos.length) % fotos.length)}/>
      )}
    </div>
  );
}
