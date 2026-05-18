import { useEffect, useState } from 'react';
import LanguageToggle from '../shared/LanguageToggle';
import Logo from '../shared/Logo';

/* Imagens de praias do Sal via Unsplash (landscape, sea/beach) */
const BEACH_IMAGES = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80',
  'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1600&q=80',
  'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&q=80',
  'https://images.unsplash.com/photo-1471922694854-ff1b63b20054?w=1600&q=80',
  'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=1600&q=80',
];

const WANDR_FOOTER = (
  <p className="text-xs text-white/50 text-center">
    Sistema desenvolvido por{' '}
    <span className="text-white/70 font-semibold">WANDR — Travel Technology Company</span>
  </p>
);

export default function AuthLayout({ children, showLangToggle = true }) {
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setImgIdx(i => (i + 1) % BEACH_IMAGES.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
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
      {/* Overlay ocean-700 50% */}
      <div className="absolute inset-0 bg-ocean-700/50" />

      {/* Conteudo */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Nav */}
        <div className="flex items-center justify-between px-6 py-4">
          <Logo white size="md" />
          {showLangToggle && <LanguageToggle variant="white" authMode />}
        </div>

        {/* Card central */}
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>

        {/* Footer WANDR */}
        <div className="pb-5">
          {WANDR_FOOTER}
        </div>
      </div>
    </div>
  );
}
