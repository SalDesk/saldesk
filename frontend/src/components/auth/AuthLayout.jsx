import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import LanguageToggle from '../shared/LanguageToggle';
import Logo from '../shared/Logo';
import { useT } from '../../i18n';

/* Fotos reais da Ilha do Sal (Santa Maria, gruta azul, mergulho, tubaroes, Buracona) --
   mesmo conjunto usado no hero do site publico, ja convertido para o
   painel esquerdo em vez do fundo full-bleed anterior. */
const BEACH_IMAGES = [
  '/images/hero-santa-maria.jpg',
  '/images/hero-shark.jpg',
  '/images/hero-blue-cave.jpg',
  '/images/hero-diver.jpg',
  '/images/hero-buracona.jpg',
];

export default function AuthLayout({ children }) {
  const t = useT();
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => setImgIdx(i => (i + 1) % BEACH_IMAGES.length), 6000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="min-h-screen flex bg-white">
      {/* ── Painel esquerdo — marca + fotos reais (escondido em mobile) ── */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-1/2 relative overflow-hidden bg-ocean-900 shrink-0">
        {BEACH_IMAGES.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
            style={{ backgroundImage: `url(${src})`, opacity: i === imgIdx ? 1 : 0 }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-ocean-900/95 via-ocean-900/55 to-ocean-900/30" />

        <div className="relative z-10 flex flex-col items-start justify-between p-12 xl:p-14 w-full h-full">
          <Logo size="lg" white />

          <div className="max-w-md space-y-7">
            <p className="font-display font-bold text-3xl xl:text-4xl text-white leading-tight tracking-tight">
              {t('auth.brandHeadline')}
            </p>
            <p className="font-body text-base text-white/70 leading-relaxed">
              {t('auth.brandSub')}
            </p>
            <ul className="space-y-2.5">
              {['brandPoint1', 'brandPoint2', 'brandPoint3'].map((key) => (
                <li key={key} className="flex items-center gap-2.5 text-sm font-body text-white/85">
                  <span className="w-5 h-5 rounded-full bg-sand-500/20 flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={2.5} className="text-sand-400" />
                  </span>
                  {t(`auth.${key}`)}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-8">
            {[['brandStat1Value', 'brandStat1Label'], ['brandStat2Value', 'brandStat2Label'], ['brandStat3Value', 'brandStat3Label']].map(([vKey, lKey]) => (
              <div key={vKey}>
                <p className="font-display font-bold text-xl text-white">{t(`auth.${vKey}`)}</p>
                <p className="text-[11px] font-body text-white/50 uppercase tracking-wide mt-0.5">{t(`auth.${lKey}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Painel direito — formulario ── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Hero compacto — so mobile/tablet (em lg+ o painel esquerdo ja cobre isto).
            Substitui o antigo cabecalho vazio (so logo + toggle, muito espaco em
            branco por baixo) por uma faixa com foto real + tagline + stats, para
            o mobile nao ficar visualmente pobre comparado ao desktop. */}
        <div className="lg:hidden relative h-56 sm:h-64 overflow-hidden bg-ocean-900 shrink-0">
          {BEACH_IMAGES.map((src, i) => (
            <div
              key={src}
              className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
              style={{ backgroundImage: `url(${src})`, opacity: i === imgIdx ? 1 : 0 }}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-b from-ocean-900/75 via-ocean-900/45 to-ocean-900/95" />
          <div className="relative z-10 flex flex-col justify-between h-full p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <Logo size="sm" white />
              <LanguageToggle authMode variant="white" />
            </div>
            <div>
              <p className="font-display font-bold text-lg sm:text-xl text-white leading-tight tracking-tight max-w-[15rem]">
                {t('auth.brandHeadline')}
              </p>
              <div className="flex items-center gap-5 mt-3">
                {[['brandStat1Value', 'brandStat1Label'], ['brandStat2Value', 'brandStat2Label'], ['brandStat3Value', 'brandStat3Label']].map(([vKey, lKey]) => (
                  <div key={vKey}>
                    <p className="font-display font-bold text-sm text-white">{t(`auth.${vKey}`)}</p>
                    <p className="text-[9px] font-body text-white/60 uppercase tracking-wide">{t(`auth.${lKey}`)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Cabecalho — so desktop (mobile ja tem logo+toggle no hero acima) */}
        <div className="hidden lg:flex items-center justify-end px-10 py-6">
          <LanguageToggle authMode />
        </div>

        <div className="flex-1 flex flex-col items-center justify-start lg:justify-center px-6 pb-6 pt-7 lg:py-6">
          <div className="w-full max-w-sm -mt-9 sm:-mt-10 lg:mt-0 bg-white rounded-2xl lg:rounded-none lg:bg-transparent shadow-lg lg:shadow-none p-6 lg:p-0">
            {children}
          </div>
        </div>

        <div className="pb-6 px-6">
          <div className="text-center space-y-1">
            <p className="text-xs text-n-400">
              {t('auth.footerCredit')}{' '}
              <span className="text-n-500 font-semibold">WANDR — Travel Technology Company</span>
            </p>
            <p className="text-[11px] text-n-300 font-mono uppercase tracking-wider">
              {t('auth.footerOrigin')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
