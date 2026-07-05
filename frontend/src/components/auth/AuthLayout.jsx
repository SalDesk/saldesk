import { useEffect, useState } from 'react';
import LanguageToggle from '../shared/LanguageToggle';
import Logo from '../shared/Logo';

/* Fotos reais da Ilha do Sal (Santa Maria, gruta azul, mergulho, tubaroes, Buracona) */
const BEACH_IMAGES = [
  '/images/hero-santa-maria.jpg',
  '/images/hero-shark.jpg',
  '/images/hero-blue-cave.jpg',
  '/images/hero-diver.jpg',
  '/images/hero-buracona.jpg',
];

const WANDR_FOOTER = (
  <div className="text-center space-y-1">
    <p className="text-xs text-white/50">
      Sistema desenvolvido por{' '}
      <span className="text-white/70 font-semibold">WANDR — Travel Technology Company</span>
    </p>
    <p className="text-[11px] text-white/35 font-mono uppercase tracking-wider">
      Orgulhosamente cabo-verdiano
    </p>
  </div>
);

export default function AuthLayout({ children, showLangToggle = true }) {
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setImgIdx(i => (i + 1) % BEACH_IMAGES.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-ocean-900">
      {/* Carousel de fundo */}
      {BEACH_IMAGES.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
          style={{
            backgroundImage: `url(${src})`,
            opacity: i === imgIdx ? 1 : 0,
          }}
        />
      ))}
      {/* Overlay em gradiente para contraste e profundidade */}
      <div className="absolute inset-0 bg-gradient-to-b from-ocean-900/70 via-ocean-800/45 to-ocean-900/75" />

      {/* Conteudo */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Nav */}
        <div className="flex items-center justify-between px-6 py-4">
          <Logo white size="md" />
          {showLangToggle && <LanguageToggle variant="white" authMode />}
        </div>

        {/* Card central */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>

        {/* Footer WANDR */}
        <div className="pb-5 px-4">
          {WANDR_FOOTER}
        </div>
      </div>
    </div>
  );
}
