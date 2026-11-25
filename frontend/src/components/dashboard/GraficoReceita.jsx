import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot, ResponsiveContainer,
} from 'recharts';
import { BarChart2 } from 'lucide-react';
import { useT } from '../../i18n';
import { formatarNumero, useLingua } from '../../utils/formatoLingua';
import { eurosInteiros } from '../../pages/reservations/shared';
import { melhorPonto, totalActual } from '../../pages/dashboard/resumoLogic';
import EmptyState from '../ui/EmptyState';

/* Receita do periodo (linha e area oceano) contra o periodo anterior (tracejado), com o melhor
   ponto em areia. series: [{ rotulo, actual, anterior }] (ver alinharSeries). estado: 'loading' |
   'ok' | 'erro'; subtitulo: texto com as datas do periodo. */

const ALTURA = 260;
const MAX_ROTULOS_EIXO = 6;

/* Ate 6 rotulos espalhados por igual, do primeiro ao ultimo ponto */
function rotulosDoEixo(series) {
  const n = series.length;
  if (n === 0) return [];
  if (n <= MAX_ROTULOS_EIXO) return series.map((p) => p.rotulo);
  return Array.from({ length: MAX_ROTULOS_EIXO }, (_, i) => series[Math.round((i * (n - 1)) / (MAX_ROTULOS_EIXO - 1))].rotulo);
}

export function Dica({ active, payload, series }) {
  const t = useT();
  useLingua();
  if (!active || !payload?.length) return null;
  const ponto = series[payload[0]?.payload?.x];
  if (!ponto) return null;
  const linha = (valor) => (valor === null ? '—' : eurosInteiros(valor));
  return (
    <div className="bg-ocean-900 text-white rounded-lg px-3 py-2 text-xs font-body shadow-md">
      <p className="font-mono text-ocean-200">{ponto.rotulo}</p>
      <p className="font-display font-bold text-base">{linha(ponto.actual)}</p>
      <p className="text-ocean-200">{t('dashboard.resumo.chart.previous')}: {linha(ponto.anterior)}</p>
    </div>
  );
}

function Esqueleto() {
  return <div className="h-[260px] rounded-lg bg-n-100 animate-pulse" data-testid="resumo-grafico-carga" />;
}

export default function GraficoReceita({ series, estado, subtitulo }) {
  const t = useT();
  useLingua();
  const lista = Array.isArray(series) ? series : [];
  const total = totalActual(lista);
  const melhor = melhorPonto(lista);
  const dados = lista.map((p, x) => ({ x, actual: p.actual, anterior: p.anterior }));

  const descricao = melhor
    ? t('dashboard.resumo.chart.aria', { total: eurosInteiros(total), label: melhor.rotulo, value: eurosInteiros(melhor.valor) })
    : t('dashboard.resumo.chart.ariaNone');

  let corpo;
  if (estado === 'loading') {
    corpo = <Esqueleto />;
  } else if (estado === 'erro') {
    corpo = <EmptyState icon={BarChart2} title={t('dashboard.resumo.chart.error')} />;
  } else if (!melhor) {
    corpo = <EmptyState icon={BarChart2} title={t('dashboard.resumo.chart.empty')} />;
  } else {
    corpo = (
      <>
        <div role="img" aria-label={descricao} data-testid="resumo-grafico">
          <ResponsiveContainer width="100%" height={ALTURA} initialDimension={{ width: 640, height: ALTURA }}>
            <AreaChart data={dados} margin={{ top: 28, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--n200)" vertical={false} />
              <XAxis dataKey="x" hide />
              <YAxis
                width={44}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--n500)' }}
                tickFormatter={(v) => formatarNumero(v, { notation: 'compact' })}
              />
              <Tooltip content={<Dica series={lista} />} cursor={{ stroke: 'var(--n400)', strokeDasharray: '3 4' }} />
              <Area
                type="monotone"
                dataKey="anterior"
                stroke="var(--n400)"
                strokeWidth={2}
                strokeDasharray="6 6"
                fill="none"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="actual"
                stroke="var(--ocean-500)"
                strokeWidth={3}
                fill="var(--ocean-500)"
                fillOpacity={0.12}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--ocean-500)', strokeWidth: 0 }}
                isAnimationActive={false}
              />
              <ReferenceDot
                x={melhor.indice}
                y={melhor.valor}
                r={6}
                fill="var(--sand-500)"
                stroke="#fff"
                strokeWidth={2}
                ifOverflow="visible"
                label={{ value: eurosInteiros(melhor.valor), position: 'top', fill: 'var(--ocean-900)', fontSize: 12, fontWeight: 700 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between font-mono text-xs text-n-500 pl-11 pr-3" aria-hidden="true" data-testid="resumo-eixo">
          {rotulosDoEixo(lista).map((r, i) => <span key={`${r}-${i}`}>{r}</span>)}
        </div>
      </>
    );
  }

  return (
    <section aria-labelledby="resumo-receita-titulo" className="bg-white border border-n-200 rounded-2xl p-4 lg:p-[22px] flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="resumo-receita-titulo" className="font-display font-semibold text-lg text-ocean-900">{t('dashboard.resumo.chart.title')}</h2>
          {subtitulo && <span className="text-[13px] font-body text-n-600">{subtitulo}</span>}
        </div>
        <div className="flex gap-4 text-[13px] font-body text-n-700">
          <span className="inline-flex items-center gap-2">
            <span className="w-[18px] h-[3px] rounded-sm bg-ocean-500" aria-hidden="true" />
            {t('dashboard.resumo.chart.current')}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-[18px] border-t-2 border-dashed border-n-400" aria-hidden="true" />
            {t('dashboard.resumo.chart.previous')}
          </span>
        </div>
      </div>
      {corpo}
    </section>
  );
}
