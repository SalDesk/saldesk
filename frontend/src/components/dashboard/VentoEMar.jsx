import { ArrowUp, Wind } from 'lucide-react';
import { useT } from '../../i18n';
import { useLingua, formatarData } from '../../utils/formatoLingua';
import { ventoForte } from '../../services/weatherService';

/* Vento e mar: os proximos dias com vento maximo (km/h) e a direccao para onde ele sopra.
   dias: previsao de weatherService (date, ventoKmh, ventoDirecao); estado: 'ok' | 'erro' | 'vazio'
   ('a_carregar' enquanto a previsao nao chegou). Uma falha aqui nao afecta o resto do painel. */
const LIMITE_FORTE = 35;
/* Escala da barra: 50 km/h enche-a */
const ESCALA_KMH = 50;
const PONTOS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/* Rosa dos ventos de 8 pontos a partir dos graus (0 = norte, de onde o vento vem) */
export function pontoCardeal(graus) {
  return PONTOS[Math.round((((graus % 360) + 360) % 360) / 45) % 8];
}

/* Dia da semana abreviado na lingua do painel, sem o ponto final do pt-PT ("ter.") */
function diaCurto(data, lang) {
  return formatarData(data, { weekday: 'short' }, lang).replace(/\.$/, '');
}

export default function VentoEMar({ dias = [], estado = 'ok' }) {
  const t = useT();
  const lang = useLingua();
  const lista = Array.isArray(dias) ? dias : [];
  const fortes = lista.filter((d) => ventoForte(d, LIMITE_FORTE));
  const maisForte = fortes.reduce((m, d) => (!m || d.ventoKmh > m.ventoKmh ? d : m), null);

  let corpo;
  if (estado === 'a_carregar') {
    corpo = <p className="text-[13px] font-body text-n-500" aria-busy="true">{t('dashboard.mare.wind.loading')}</p>;
  } else if (estado === 'erro') {
    corpo = <p role="status" className="text-[13px] font-body text-n-600">{t('dashboard.mare.wind.error')}</p>;
  } else if (estado === 'vazio' || lista.length === 0) {
    corpo = <p className="text-[13px] font-body text-n-500">{t('dashboard.mare.wind.empty')}</p>;
  } else {
    corpo = (
      <>
        <ul className="space-y-2.5">
          {lista.map((d) => {
            const forte = ventoForte(d, LIMITE_FORTE);
            const tem = Number.isFinite(d.ventoKmh);
            const direcao = Number.isFinite(d.ventoDirecao) ? d.ventoDirecao : null;
            const pct = tem ? Math.min(100, Math.round((d.ventoKmh / ESCALA_KMH) * 100)) : 0;
            return (
              <li
                key={d.date}
                data-forte={forte ? 'true' : 'false'}
                className="grid grid-cols-[44px_28px_minmax(0,1fr)_64px] items-center gap-2.5"
              >
                <span className="text-sm font-body font-semibold text-n-900 capitalize">{diaCurto(d.date, lang)}</span>
                {direcao !== null ? (
                  <span
                    role="img"
                    aria-label={t('dashboard.mare.wind.from', { dir: t(`dashboard.mare.wind.cardinal.${pontoCardeal(direcao)}`) })}
                    className={`inline-flex justify-center ${forte ? 'text-sand-600' : 'text-ocean-600'}`}
                  >
                    {/* a seta aponta para onde o vento sopra: a previsao da a direccao de onde vem */}
                    <ArrowUp
                      size={20}
                      strokeWidth={2}
                      aria-hidden="true"
                      data-graus={direcao}
                      style={{ transform: `rotate(${(direcao + 180) % 360}deg)` }}
                    />
                  </span>
                ) : <span aria-hidden="true" />}
                <div className="h-2.5 rounded-full bg-ocean-50 overflow-hidden" aria-hidden="true">
                  <div className={`h-full rounded-full ${forte ? 'bg-sand-500' : 'bg-ocean-400'}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="font-mono text-[13px] text-right text-n-900 tabular-nums">
                  {tem ? t('dashboard.mare.wind.kmh', { n: d.ventoKmh }) : '–'}
                </span>
              </li>
            );
          })}
        </ul>
        {maisForte && (
          <p className="px-3.5 py-3 rounded-md bg-sand-50 text-[13px] leading-relaxed font-body text-n-800">
            {t('dashboard.mare.wind.warning', {
              day: formatarData(maisForte.date, { weekday: 'long' }, lang),
              kmh: maisForte.ventoKmh,
            })}
          </p>
        )}
      </>
    );
  }

  return (
    <section aria-labelledby="vento-titulo" className="bg-white border border-n-200 rounded-md p-4 space-y-3">
      <header className="flex items-start gap-2">
        <Wind size={16} strokeWidth={1.75} className="mt-0.5 text-n-500 shrink-0" aria-hidden="true" />
        <div>
          <h2 id="vento-titulo" className="font-display font-semibold text-sm text-n-900">{t('dashboard.mare.wind.title')}</h2>
          <p className="text-xs font-body text-n-500">{t('dashboard.mare.wind.subtitle')}</p>
        </div>
      </header>
      {corpo}
    </section>
  );
}
