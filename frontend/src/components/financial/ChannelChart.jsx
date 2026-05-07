import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SOURCE_LABELS = {
  direct:       'Directa',
  public:       'Directa',
  admin:        'Manual',
  manual:       'Manual',
  booking_com:  'Booking.com',
  airbnb:       'Airbnb',
  viator:       'Viator',
  getyourguide: 'GetYourGuide',
};

const COLORS = ['#0D5470','#D4A82A','#3A9BBF','#1A7A4A','#B45309','#E0BF5A','#71BDD4','#9CA3AF'];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-n-200 rounded-sm shadow-md px-3 py-2 text-xs font-body">
      <p className="font-bold text-n-800 mb-1">{d.name}</p>
      <p className="text-n-600">{d.num_reservas} reserva(s)</p>
      <p className="text-ocean-700 font-semibold">€{Number(d.receita).toFixed(2)}</p>
    </div>
  );
};

export default function ChannelChart({ data }) {
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-n-400 text-sm font-body">
        Sem dados
      </div>
    );
  }

  const consolidated = data.reduce((acc, d) => {
    const label = SOURCE_LABELS[d.source] || d.source;
    const ex = acc.find((x) => x.name === label);
    if (ex) {
      ex.num_reservas += d.num_reservas;
      ex.receita = Number(ex.receita) + Number(d.receita);
    } else {
      acc.push({ name: label, num_reservas: d.num_reservas, receita: Number(d.receita) });
    }
    return acc;
  }, []);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={consolidated}
          dataKey="num_reservas"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          innerRadius={45}
          paddingAngle={2}
        >
          {consolidated.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span className="text-xs font-body text-n-600">{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
