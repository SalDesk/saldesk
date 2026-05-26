import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const EUR_CVE = 110;
const COLORS  = ['#0D5470','#1480A8','#3A9BBF','#71BDD4','#A8D8E8'];

function CustomTooltip({ active, payload, currency }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const v = Number(d.receita || 0);
  const fmt = currency === 'CVE'
    ? `${Math.round(v).toLocaleString('pt-PT')} CVE`
    : `€${Math.round(v).toLocaleString('pt-PT')}`;
  return (
    <div className="bg-white border border-n-200 rounded shadow-md px-3 py-2 text-xs font-body">
      <p className="font-semibold text-n-800 mb-1">{d.fullName}</p>
      <p className="text-ocean-700 font-bold">{fmt}</p>
      <p className="text-n-500">{d.num_reservas} reserva(s)</p>
    </div>
  );
}

export default function ServiceBarChart({ data, currency = 'EUR' }) {
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
      <div className="flex items-center justify-center h-52 text-n-400 text-sm font-body">
        Sem dados de servicos
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
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E5E8EC" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: '#6B7280' }}
          axisLine={false} tickLine={false}
          tickFormatter={tickFmt}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: '#6B7280' }}
          axisLine={false} tickLine={false}
        />
        <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ fill: '#EBF7FB' }} />
        <Bar dataKey="receita" radius={[0, 3, 3, 0]} maxBarSize={22}>
          {top5.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
