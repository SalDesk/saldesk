import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ArrowRight, ArrowLeft, Compass } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';
import { useT } from '../../i18n';
import { markTourSeen } from '../../services/authService';

/* Rotula a unidade principal de cada tipo -- mesma logica do label da
   Sidebar, so que aqui precisamos da frase completa para o texto do tour. */
const UNIT_LABEL_KEY = {
  hotel: 'tour.unitLabelHotel',
  activity: 'tour.unitLabelActivity',
  rentacar: 'tour.unitLabelRentacar',
  restaurant: 'tour.unitLabelRestaurant',
};

/* Passos partilhados por TODOS os tipos de operador -- as ancoras
   (data-tour) tem de existir em qualquer tipo, ver Sidebar.jsx/Topbar.jsx.
   anchor:null == passo centrado (sem spotlight), so um cartao de boas-vindas
   ou de fecho. */
const STEPS = [
  { id: 'welcome',  anchor: null,               titleKey: 'tour.welcomeTitle',  bodyKey: 'tour.welcomeBody' },
  { id: 'dash',     anchor: 'nav-dashboard',     titleKey: 'tour.dashTitle',     bodyKey: 'tour.dashBody' },
  { id: 'unidades', anchor: 'nav-unidades',      titleKey: 'tour.unitsTitle',    bodyKey: null },
  { id: 'reservas', anchor: 'nav-reservas',      titleKey: 'tour.resTitle',      bodyKey: 'tour.resBody' },
  { id: 'financ',   anchor: 'nav-financeiro',    titleKey: 'tour.financeTitle', bodyKey: 'tour.financeBody' },
  { id: 'site',     anchor: 'nav-site',          titleKey: 'tour.siteTitle',     bodyKey: 'tour.siteBody' },
  { id: 'bell',     anchor: 'topbar-bell',       titleKey: 'tour.bellTitle',     bodyKey: 'tour.bellBody' },
  { id: 'done',     anchor: null,                titleKey: 'tour.doneTitle',     bodyKey: 'tour.doneBody' },
];

const PAD = 8; // folga em volta do elemento destacado

function useIsDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    if (mql.matches !== isDesktop) setIsDesktop(mql.matches);
    const onChange = (e) => setIsDesktop(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return isDesktop;
}

export default function WelcomeTour() {
  const t = useT();
  const { operator, setOperator } = useAuthStore();
  const tourForceStart = useUiStore((s) => s.tourForceStart);
  const clearTourForce = useUiStore((s) => s.clearTourForce);
  const isDesktop = useIsDesktopViewport();

  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const rafRef = useRef(null);

  const shouldAutoStart = !!operator && !operator.is_demo && !operator.tour_completed_at;

  useEffect(() => {
    if (!isDesktop) return;
    if (tourForceStart || shouldAutoStart) {
      setStepIdx(0);
      setActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, tourForceStart, shouldAutoStart]);

  const step = STEPS[stepIdx];

  /* Mede a posicao do elemento destacado -- corre a cada passo e em
     resize/scroll, para o recorte nunca ficar desalinhado. */
  useEffect(() => {
    if (!active || !step?.anchor) { setRect(null); return; }

    function measure() {
      const el = document.querySelector(`[data-tour="${step.anchor}"]`);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) { setRect(null); return; }
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    const el = document.querySelector(`[data-tour="${step.anchor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
    const t1 = setTimeout(measure, 260);

    function onViewportChange() {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    }
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      clearTimeout(t1);
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [active, step]);

  const unitLabel = useMemo(() => {
    const key = UNIT_LABEL_KEY[operator?.operator_type] || UNIT_LABEL_KEY.activity;
    return t(key);
  }, [operator?.operator_type, t]);

  async function finish() {
    setActive(false);
    clearTourForce();
    if (!operator || operator.is_demo) return; // conta demo -- nunca escreve
    try {
      const updated = await markTourSeen();
      setOperator(updated);
    } catch { /* falha a marcar como visto nao deve travar a app */ }
  }

  function next() {
    if (stepIdx >= STEPS.length - 1) { finish(); return; }
    setStepIdx((i) => i + 1);
  }
  function prev() { setStepIdx((i) => Math.max(0, i - 1)); }

  if (!active || !isDesktop) return null;

  const centered = !step.anchor;
  const bodyText = step.id === 'unidades'
    ? t('tour.unitsBody', { unit: unitLabel })
    : (step.bodyKey ? t(step.bodyKey) : '');

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Recorte -- SVG com mascara em vez de 4 rectangulos, mais simples de manter alinhado */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ width: '100vw', height: '100vh' }}>
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - PAD}
                y={rect.top - PAD}
                width={rect.width + PAD * 2}
                height={rect.height + PAD * 2}
                rx="10"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(6,42,56,0.72)" mask="url(#tour-mask)" />
      </svg>

      {/* Bloqueia cliques na pagina por baixo, mas nao no proprio spotlight */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {rect && (
        <div
          className="absolute rounded-[10px] ring-2 ring-sand-400 pointer-events-none transition-all duration-300"
          style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
        />
      )}

      {/* Cartao */}
      <div
        className={
          centered
            ? 'absolute inset-0 flex items-center justify-center p-4'
            : 'absolute'
        }
        style={
          centered
            ? undefined
            : cardPosition(rect, step.anchor)
        }
      >
        <div className="bg-white rounded-xl shadow-2xl border border-n-200 w-full max-w-xs p-5 relative">
          <button
            onClick={finish}
            aria-label={t('tour.skip')}
            className="absolute top-3 right-3 text-n-300 hover:text-n-600 transition-colors"
          >
            <X size={16} strokeWidth={1.75} />
          </button>

          {centered && (
            <div className="w-10 h-10 rounded-full bg-ocean-50 flex items-center justify-center mb-3">
              <Compass size={20} strokeWidth={1.75} className="text-ocean-700" />
            </div>
          )}

          <p className="font-display font-bold text-base text-n-900 pr-5">{t(step.titleKey)}</p>
          {bodyText && <p className="text-sm font-body text-n-500 mt-1.5 leading-relaxed">{bodyText}</p>}

          <div className="flex items-center justify-between mt-5">
            <span className="text-[11px] font-mono text-n-400">{stepIdx + 1}/{STEPS.length}</span>
            <div className="flex items-center gap-2">
              {stepIdx > 0 && (
                <button
                  onClick={prev}
                  className="flex items-center gap-1 h-8 px-3 rounded-md border border-n-200 text-xs font-body font-semibold text-n-600 hover:bg-n-50 transition-colors"
                >
                  <ArrowLeft size={13} strokeWidth={1.75} />
                  {t('tour.back')}
                </button>
              )}
              <button
                onClick={next}
                className="flex items-center gap-1 h-8 px-3.5 rounded-md bg-ocean-700 text-white text-xs font-body font-semibold hover:bg-ocean-500 transition-colors"
              >
                {stepIdx >= STEPS.length - 1 ? t('tour.finish') : t('tour.next')}
                {stepIdx < STEPS.length - 1 && <ArrowRight size={13} strokeWidth={1.75} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Decide o lado do cartao consoante a ancora -- itens da sidebar (esquerda)
   abrem o cartao a direita; o sino do topbar (direita) abre por baixo. */
function cardPosition(rect, anchor) {
  if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  if (anchor === 'topbar-bell') {
    return { top: rect.top + rect.height + 16, right: Math.max(16, window.innerWidth - rect.left - rect.width) };
  }
  return { top: Math.max(16, rect.top - 8), left: rect.left + rect.width + 16 };
}
