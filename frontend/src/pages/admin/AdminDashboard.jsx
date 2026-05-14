import { useState, useEffect } from 'react';
import { Users, BookOpen, Euro, TrendingUp } from 'lucide-react';
import api from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function StatCard({ icon: Icon, label, value, sub, color = 'ocean' }) {
  return (
    <div className="bg-white rounded-md border border-n-200 shadow-sm px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0`}>
        <Icon size={20} strokeWidth={1.75} className="text-ocean-700"/>
      </div>
      <div>
        <p className="font-display font-bold text-xl text-n-900">{value}</p>
        <p className="text-xs font-body text-n-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs font-body text-n-400">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats]     = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats').then(r => r.data.data),
      api.get('/admin/revenue').then(r => r.data.data),
    ]).then(([s, r]) => { setStats(s); setRevenue(r); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32}/></div>;

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Metricas globais da plataforma SalDesk"/>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users}    label="Operadores"    value={stats?.operators.total}    sub={`${stats?.operators.active} activos`}/>
        <StatCard icon={BookOpen} label="Reservas"      value={stats?.reservations.total} sub={`${stats?.reservations.checked_out} checkout`}/>
        <StatCard icon={Euro}     label="Receita total" value={`€${Number(stats?.revenue_total || 0).toFixed(0)}`}/>
        <StatCard icon={TrendingUp} label="Leads"       value={stats?.leads.total}        sub={`${stats?.leads.converted} convertidos`}/>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {Object.entries(stats?.operators.by_plan || {}).map(([plan, count]) => (
          <Card key={plan}>
            <p className="font-display font-bold text-lg text-n-900">{count}</p>
            <p className="text-xs font-body text-n-500 uppercase tracking-wide">{plan}</p>
          </Card>
        ))}
      </div>

      {revenue.length > 0 && (
        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Receita mensal (ultimos 12 meses)</h3>} padding="px-5 pb-5 pt-2">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" vertical={false}/>
              <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: '#6B7280' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: '#6B7280' }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} width={50}/>
              <Tooltip formatter={(v) => [`€${Number(v).toFixed(2)}`, 'Receita']}/>
              <Bar dataKey="revenue" fill="#0D5470" radius={[3,3,0,0]} maxBarSize={40}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
