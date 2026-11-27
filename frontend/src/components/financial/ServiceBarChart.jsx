import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useT } from '../../i18n';
import { formatarNumero, useLingua } from '../../utils/formatoLingua';
import DicaGrafico from './DicaGrafico';

const EUR_CVE = 110;

function CustomTooltip({ active, payload, currency }) {
  const t = useT();
  useLingua();
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const v = Number(d.receita || 0);
  const fmt = currency === 'CVE'
    ? `${formatarNumero(Math.round(v))} CVE`
    : `€${formatarNumero(Math.round(v))}`;
  return (
    <DicaGrafico>
      <p className="font-semibold text-n-800 mb-1">{d.fullName}</p>
      <p className="font-mono tabular-nums text-ocean-900 font-bold">{fmt}</p>
      <p className="text-n-500">{t('financial.bookingsCount', { n: d.num_reservas })}</p>
    </DicaGrafico>
  );
}

/* Top de servicos por receita na linguagem dos graficos Mare: barras oceano, o primeiro em areia */
export default function ServiceBarChart({ data, currency = 'EUR' }) {
  const t = useT();
  const rate = currency === 'CVE' ? EUR_CVE : 1;

  const top5 = [...(data || [])]
    .sort((a, b) => Number(b.receita) - Number(a.receita))
    .slice(0, 5)
    .map(u => ({
      fullName:     u.name,
      name:         u.name.length > 16 ? u.name.slice(0, 16) + '…' : u.name,
      receita:      Math.round(Number(u.receita || 0) * rate),
      num_reservas: u.num_reservas || 0,
    }));

  if (!top5.length) {
    return (
      <div className="flex items-center justify-center h-52 text-n-500 text-sm font-body">
        {t('financial.noServiceData')}
      </div>
    );
  }

  const tickFmt = v => {
    if (currency === 'CVE') return v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`;
    return v >= 1000 ? `€${Math.round(v / 1000)}k` : `€${v}`;
  };

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart
        data={top5}
        layout="vertical"
        margin={{ top: 4, right: 20, left: 4, bottom: 0 }}
      >
        <CartesianGrid stroke="var(--n200)" vertical={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 12, fontFamily: 'DM Sans', fill: 'var(--n500)' }}
          axisLine={false} tickLine={false}
          tickFormatter={tickFmt}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fontSize: 12, fontFamily: 'DM Sans', fill: 'var(--n500)' }}
          axisLine={false} tickLine={false}
        />
        <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ fill: 'var(--ocean-50)' }} />
        <Bar dataKey="receita" radius={[0, 6, 6, 0]} maxBarSize={22}>
          {top5.map((_, i) => (
            <Cell key={i} fill={i === 0 ? 'var(--sand-500)' : 'var(--ocean-500)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
