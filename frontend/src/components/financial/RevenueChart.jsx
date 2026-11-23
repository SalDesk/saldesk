import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { useT } from '../../i18n';
import { formatarNumero, useLingua } from '../../utils/formatoLingua';
import { rotuloMes } from '../../utils/rotuloMes';

const EUR_CVE = 110;

/* Mes abreviado pela lingua do painel (em pt: Jan, Fev, Mar...) */
function formatPeriodo(p, granularidade, t) {
  if (!p) return '';
  if (granularidade === 'month') {
    const [y, m] = p.split('-');
    return `${rotuloMes(parseInt(m, 10) - 1, t)} ${y}`;
  }
  const d = new Date(p + 'T00:00:00Z');
  return `${d.getUTCDate()} ${rotuloMes(d.getUTCMonth(), t)}`;
}

function CustomTooltip({ active, payload, label, currency }) {
  const t = useT();
  useLingua();
  if (!active || !payload?.length) return null;
  const v = Number(payload[0]?.value || 0);
  const fmt = currency === 'CVE'
    ? `${formatarNumero(Math.round(v))} CVE`
    : `€${formatarNumero(v, { minimumFractionDigits: 0 })}`;
  return (
    <div className="bg-white border border-n-200 rounded shadow-md px-3 py-2 text-xs font-body">
      <p className="text-n-500 mb-1">{label}</p>
      <p className="font-bold text-ocean-700">{fmt}</p>
      {payload[1] && <p className="text-n-500 mt-0.5">{t('financial.chartBookings', { n: payload[1].value })}</p>}
    </div>
  );
}

export default function RevenueChart({ data, granularidade, currency = 'EUR' }) {
  const t = useT();
  const rate = currency === 'CVE' ? EUR_CVE : 1;
  const sym  = currency === 'CVE' ? '' : '€';

  const chartData = (data || []).map(d => ({
    label:   formatPeriodo(d.periodo, granularidade, t),
    receita: Math.round(Number(d.receita || 0) * rate),
    reservas: d.num_reservas || 0,
  }));

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-52 text-n-400 text-sm font-body">
        {t('financial.noDataPeriod')}
      </div>
    );
  }

  const tickFmt = v => {
    if (currency === 'CVE') return v >= 1000 ? `${Math.round(v / 1000)}k CVE` : `${v} CVE`;
    return v >= 1000 ? `€${Math.round(v / 1000)}k` : `€${v}`;
  };

  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--ocean-700)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--ocean-700)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--n200)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: 'var(--n500)' }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: 'var(--n500)' }}
          axisLine={false} tickLine={false}
          tickFormatter={tickFmt}
          width={currency === 'CVE' ? 72 : 52}
        />
        <Tooltip
          content={<CustomTooltip currency={currency} />}
          cursor={{ stroke: 'var(--ocean-700)', strokeWidth: 1, strokeDasharray: '4 4' }}
        />
        <Area
          type="monotone"
          dataKey="receita"
          stroke="var(--ocean-700)"
          strokeWidth={2}
          fill="url(#gradReceita)"
          dot={false}
          activeDot={{ r: 4, fill: 'var(--ocean-700)', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
