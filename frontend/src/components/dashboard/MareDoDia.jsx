import { useEffect, useRef } from 'react';
import { useT } from '../../i18n';
import { pessoasAs } from '../../pages/dashboard/mareLogic';

/* Mare do dia: quantas pessoas estao na rua, hora a hora, com a linha do "agora".
   curva: resultado de curvaMare (mareLogic.js); agoraMin: minutos desde a meia-noite. */
const LARGURA = 760;
const ALTURA = 210;
const TOPO = 8;
const BASE = 190;

const doisDigitos = (n) => String(n).padStart(2, '0');
const horaCheia = (h) => `${doisDigitos(h)}:00`;
const horaDeMinutos = (min) => `${doisDigitos(Math.floor(min / 60))}:${doisDigitos(min % 60)}`;

/* Curva suave: segmentos cubicos com tangentes horizontais (nunca passa dos pontos) */
function caminhoSuave(pontos) {
  return pontos.reduce((d, p, i) => {
    if (i === 0) return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    const q = pontos[i - 1];
    const meio = (q.x + p.x) / 2;
    return `${d} C${meio.toFixed(1)} ${q.y.toFixed(1)} ${meio.toFixed(1)} ${p.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }, '');
}

function Numero({ valor, rotulo, destaque }) {
  return (
    <div className="flex flex-col">
      <span className={`font-display font-bold text-[22px] leading-tight tabular-nums ${destaque ? 'text-sand-500' : 'text-white'}`}>{valor}</span>
      <span className="text-xs font-body text-ocean-200">{rotulo}</span>
    </div>
  );
}

/* Entrada da curva da esquerda para a direita; nada se mexe com movimento reduzido */
function desenhaAoEntrar(el) {
  if (!el || typeof el.animate !== 'function') return;
  let reduzido = false;
  try { reduzido = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { /* sem matchMedia */ }
  if (reduzido) return;
  el.animate(
    [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
    { duration: 900, easing: 'ease-out' },
  );
}

export default function MareDoDia({ curva, agoraMin, reservasHoje = 0 }) {
  const t = useT();
  const graficoRef = useRef(null);
  const temGrafico = !!curva?.pico;
  useEffect(() => {
    if (temGrafico) desenhaAoEntrar(graficoRef.current);
  }, [temGrafico]);
  const pontos = Array.isArray(curva?.pontos) ? curva.pontos : [];
  const pico = curva?.pico || null;
  const saidas = Array.isArray(curva?.saidas) ? curva.saidas : [];

  const cabecalho = (
    <div className="flex flex-col gap-1">
      <h2 id="mare-titulo" className="font-display font-semibold text-base lg:text-lg text-white">{t('dashboard.mare.tide.title')}</h2>
      <span className="text-[13px] font-body text-ocean-200">{t('dashboard.mare.tide.subtitle')}</span>
    </div>
  );

  if (!pico || pontos.length === 0) {
    return (
      <section aria-labelledby="mare-titulo" className="bg-ocean-900 rounded-[18px] p-4 lg:p-6 text-white flex flex-col gap-3">
        {cabecalho}
        <p className="text-sm font-body text-ocean-200 py-6">{t(reservasHoje > 0 ? 'dashboard.mare.tide.emptyNoTime' : 'dashboard.mare.tide.empty')}</p>
      </section>
    );
  }

  const agora = pessoasAs(curva, agoraMin);
  const maximo = pico.pessoas * 1.1;
  const nPontos = pontos.length;
  const xDe = (i) => (nPontos > 1 ? (i / (nPontos - 1)) * LARGURA : LARGURA / 2);
  const yDe = (pessoas) => BASE - (pessoas / maximo) * (BASE - TOPO);
  const xy = pontos.map((p, i) => ({ x: xDe(i), y: yDe(p.pessoas) }));
  const linha = caminhoSuave(xy);
  const area = `${linha} L${LARGURA} ${BASE} L0 ${BASE} Z`;

  /* posicao do agora no eixo (fracao de horas desde a primeira hora), limitada ao grafico */
  const horasDesdeInicio = agoraMin / 60 - curva.inicioHora;
  const duracaoEixo = Math.max(1, curva.fimHora - curva.inicioHora);
  const fracao = Math.min(1, Math.max(0, horasDesdeInicio / duracaoEixo));
  const nowX = fracao * LARGURA;
  const nowY = yDe(agora);

  /* etiquetas das horas: de duas em duas e a ultima */
  const horas = [];
  for (let h = curva.inicioHora; h <= curva.fimHora; h += 2) horas.push(h);
  if (horas[horas.length - 1] !== curva.fimHora) horas.push(curva.fimHora);

  const rotuloGrafico = t('dashboard.mare.tide.aria', {
    from: horaCheia(curva.inicioHora),
    to: horaCheia(curva.fimHora),
    peak: pico.pessoas,
    time: horaCheia(pico.hora),
    now: agora,
  });

  return (
    <section aria-labelledby="mare-titulo" className="bg-ocean-900 rounded-[18px] p-4 lg:p-6 lg:pb-[18px] text-white flex flex-col gap-3.5">
      <div className="flex flex-wrap justify-between items-baseline gap-3">
        {cabecalho}
        <div className="flex flex-wrap gap-[22px]">
          <Numero destaque valor={pico.pessoas} rotulo={t('dashboard.mare.tide.peak', { time: horaCheia(pico.hora) })} />
          <Numero valor={agora} rotulo={t('dashboard.mare.tide.now', { time: horaDeMinutos(agoraMin) })} />
          <Numero valor={saidas.length} rotulo={t('dashboard.mare.tide.departures')} />
        </div>
      </div>

      <div className="relative">
        <svg
          ref={graficoRef}
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={rotuloGrafico}
          className="block w-full h-[130px] lg:h-[210px]"
        >
          {[0.25, 0.5, 0.75, 1].map((f) => {
            const y = BASE - f * (BASE - TOPO);
            return <line key={f} x1="0" x2={LARGURA} y1={y} y2={y} className="stroke-ocean-700" strokeWidth="1" vectorEffect="non-scaling-stroke" />;
          })}
          <path d={area} className="fill-ocean-600" fillOpacity="0.55" />
          <path d={linha} fill="none" className="stroke-ocean-300" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          {/* o que ainda nao aconteceu fica mais escuro */}
          <rect x={nowX} y="0" width={LARGURA - nowX} height={ALTURA} className="fill-ocean-900" fillOpacity="0.4" />
        </svg>
        <span
          aria-hidden="true"
          className="absolute top-0 h-full border-l-2 border-dashed border-sand-500 pointer-events-none"
          style={{ left: `${fracao * 100}%`, top: `${(TOPO / ALTURA) * 100}%`, height: `${((BASE - TOPO) / ALTURA) * 100}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-sand-500 border-2 border-ocean-900 pointer-events-none"
          style={{ left: `${fracao * 100}%`, top: `${(nowY / ALTURA) * 100}%` }}
        />
      </div>

      <div aria-hidden="true" className="relative h-4 font-mono text-[11px] lg:text-xs text-ocean-200">
        {horas.map((h, i) => (
          <span
            key={h}
            className="absolute whitespace-nowrap"
            style={{
              left: `${((h - curva.inicioHora) / duracaoEixo) * 100}%`,
              transform: i === 0 ? 'none' : (h === curva.fimHora ? 'translateX(-100%)' : 'translateX(-50%)'),
            }}
          >
            {`${doisDigitos(h)}h`}
          </span>
        ))}
      </div>

      {saidas.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {saidas.map((s) => (
            <li key={`${s.inicio}|${s.titulo}`} className="inline-flex gap-2 items-center text-[13px] font-body px-3 py-1.5 rounded-full bg-ocean-800 text-ocean-50">
              <span className="font-mono text-sand-500">{s.inicio}</span>
              {s.titulo}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
