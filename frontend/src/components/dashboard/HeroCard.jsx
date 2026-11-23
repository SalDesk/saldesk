import { useT } from '../../i18n';
import { formatarNumero } from '../../utils/formatoLingua';

const LARGURA = 200;
const ALTURA = 34;

function euros(valor) {
  const n = Number(valor);
  return `€${formatarNumero(Math.round(Number.isFinite(n) ? n : 0))}`;
}

/* Caminhos SVG (linha e area) de uma serie; menos de 2 pontos ou tudo a zero da uma linha plana em baixo */
function caminhos(serie) {
  const valores = (Array.isArray(serie) ? serie : []).map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
  const pontos = valores.length >= 2 ? valores : [valores[0] || 0, valores[0] || 0];
  const max = Math.max(...pontos, 0);
  const passo = LARGURA / (pontos.length - 1);
  const coords = pontos.map((v, i) => {
    const y = max > 0 ? ALTURA - 2 - (v / max) * (ALTURA - 6) : ALTURA - 2;
    return `${(i * passo).toFixed(1)} ${y.toFixed(1)}`;
  });
  const linha = `M${coords.join(' L')}`;
  return { linha, area: `${linha} L${LARGURA} ${ALTURA} L0 ${ALTURA}Z` };
}

/* Cartao de destaque do Dashboard: receita do mes com grafico, anel de ocupacao e o numero de hoje */
export default function HeroCard({ receita, variacao, serie, ocupacao, volume, hojeValor, hojeDetalhe, mesNome, rotuloOcupacao }) {
  const t = useT();
  const occ = Math.max(0, Math.min(100, Math.round(Number(ocupacao) || 0)));
  const temVariacao = variacao !== null && variacao !== undefined && Number.isFinite(Number(variacao));
  const { linha, area } = caminhos(serie);

  return (
    <section className="rounded-lg bg-gradient-to-br from-ocean-800 to-ocean-600 text-white p-4 md:p-5 grid gap-4 md:grid-cols-[1.3fr_1fr_1fr] md:items-center">
      <div className="min-w-0">
        <p className="text-xs font-body text-ocean-100">{t('dashboard.hero.revenue', { month: mesNome })}</p>
        <p className="font-display font-extrabold text-3xl tracking-tight tabular-nums mt-0.5">{euros(receita)}</p>
        {temVariacao && (
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-white/15 text-[11px] font-body font-semibold">
            {t('dashboard.hero.vsPrev', { pct: `${Number(variacao) > 0 ? '+' : ''}${Number(variacao)}` })}
          </span>
        )}
        <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} preserveAspectRatio="none" className="w-full h-9 mt-2" aria-hidden="true">
          <path d={area} style={{ fill: 'var(--sand-400)', fillOpacity: 0.18 }} />
          <path d={linha} style={{ fill: 'none', stroke: 'var(--sand-400)', strokeWidth: 2 }} />
        </svg>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="w-[74px] h-[74px] rounded-full grid place-items-center shrink-0"
          style={{ background: `conic-gradient(var(--sand-500) 0 ${occ}%, rgba(255, 255, 255, 0.15) ${occ}% 100%)` }}
        >
          <div className="w-14 h-14 rounded-full bg-ocean-700 grid place-items-center font-display font-bold text-[15px] tabular-nums">
            {`${occ}%`}
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-body text-ocean-100">{rotuloOcupacao || t('dashboard.hero.occupancy')}</p>
          <p className="font-display font-semibold text-sm mt-0.5">{volume}</p>
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-xs font-body text-ocean-100">{t('dashboard.hero.today')}</p>
        <p className="font-display font-extrabold text-2xl tracking-tight tabular-nums mt-0.5">{hojeValor}</p>
        <p className="text-xs font-body text-ocean-100 mt-0.5">{hojeDetalhe}</p>
      </div>
    </section>
  );
}
