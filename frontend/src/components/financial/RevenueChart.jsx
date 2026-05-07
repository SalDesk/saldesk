import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function formatPeriodo(p, granularidade) {
  if (!p) return '';
  if (granularidade === 'month') {
    const [y, m] = p.split('-');
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${meses[parseInt(m, 10) - 1]} ${y}`;
  }
  if (granularidade === 'week') {
    const d = new Date(p + 'T00:00:00Z');
    return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  }
  const d = new Date(p + 'T00:00:00Z');
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-n-200 rounded-sm shadow-md px-3 py-2 text-xs font-body">
      <p className="text-n-500 mb-1">{label}</p>
      <p className="font-bold text-ocean-700">€{Number(payload[0].value).toFixed(2)}</p>
      {payload[1] && <p className="text-n-600">{payload[1].value} reservas</p>}
    </div>
  );
};

export default function RevenueChart({ data, granularidade }) {
  const chartData = (data || []).map((d) => ({
    ...d,
    label: formatPeriodo(d.periodo, granularidade),
  }));

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-48 text-n-400 text-sm font-body">
        Sem dados para o periodo seleccionado
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: '#6B7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: '#6B7280' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `€${v}`}
          width={50}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#EBF7FB' }} />
        <Bar dataKey="receita" fill="#0D5470" radius={[3, 3, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
