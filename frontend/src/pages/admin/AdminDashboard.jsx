import { useState, useEffect } from 'react';
import {
  Users, BookOpen, Euro, TrendingUp, AlertTriangle, Clock,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const PIE_COLORS   = ['#0D5470','#1480A8','#3A9BBF','#D4A82A'];
const TYPE_LABELS  = { activity: 'Actividade', hotel: 'Hotel', rentacar: 'Rent-a-car', restaurant: 'Restaurante' };
const PLAN_BADGE   = { starter: 'info', business: 'pending', pro: 'confirmed' };
const STATUS_BADGE = { trial: 'pending', active: 'confirmed', suspended: 'cancelled' };

function KpiCard({ icon: Icon, label, value, sub, accent = false }) {
  return (
    <div className={`bg-white rounded-md border shadow-sm px-5 py-4 flex items-center gap-4 ${accent ? 'border-ocean-200 bg-ocean-50' : 'border-n-200'}`}>
      <div className="w-10 h-10 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
        <Icon size={20} strokeWidth={1.75} className="text-ocean-700" />
      </div>
      <div className="min-w-0">
        <p className="font-display font-bold text-xl text-n-900 leading-tight">{value ?? '—'}</p>
        <p className="text-xs font-body text-n-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs font-body text-n-400">{sub}</p>}
      </div>
    </div>
  );
}

function AlertCard({ icon: Icon, color, title, items, emptyMsg }) {
  return (
    <div className={`border rounded-md p-4 ${color}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} strokeWidth={1.75} />
        <p className="text-sm font-body font-semibold">{title}</p>
        {items.length > 0 && (
          <span className="ml-auto text-xs font-bold font-body">{items.length}</span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs font-body opacity-60">{emptyMsg}</p>
      ) : (
        <div className="space-y-1.5">
          {items.slice(0, 4).map((item, i) => (
            <div key={i} className="text-xs font-body opacity-80 truncate">
              {item.name || item.email}
              {item.trial_ends_at && <span className="ml-1 opacity-60">· {item.trial_ends_at?.split('T')[0]}</span>}
            </div>
          ))}
          {items.length > 4 && <p className="text-xs font-body opacity-50">+ {items.length - 4} mais</p>}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats')
      .then(r => setStats(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;
  if (!stats)  return <div className="text-center py-20 text-n-400 font-body text-sm">Erro ao carregar dados.</div>;

  const byType = (stats.operators.by_type || []).map(d => ({
    ...d,
    label: TYPE_LABELS[d.name] || d.name,
  }));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Metricas globais da plataforma SalDesk"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={Users}
          label="Operadores activos"
          value={stats.operators.active}
          sub={`${stats.operators.total} total · ${stats.operators.trial} trial`}
        />
        <KpiCard
          icon={Euro}
          label="MRR estimado"
          value={`€${stats.mrr}`}
          sub={`${stats.operators.by_plan?.starter || 0}S · ${stats.operators.by_plan?.business || 0}B · ${stats.operators.by_plan?.pro || 0}Pro`}
          accent
        />
        <KpiCard
          icon={BookOpen}
          label="Reservas totais"
          value={stats.reservations.total}
          sub={`${stats.reservations.checked_out} concluidas`}
        />
        <KpiCard
          icon={TrendingUp}
          label="Leads novos"
          value={stats.leads.new_uncontacted}
          sub={`${stats.leads.total} total · ${stats.leads.converted} convertidos`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card
          className="lg:col-span-2"
          header={<h3 className="font-display font-semibold text-sm text-n-700">Crescimento de operadores (ultimos 6 meses)</h3>}
          padding="px-5 pb-5 pt-2"
        >
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.operator_growth || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: '#6B7280' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip
                formatter={v => [v, 'Operadores']}
                contentStyle={{ fontFamily: 'DM Sans', fontSize: 12, borderRadius: 6, border: '1px solid #E5E8EC' }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#0D5470"
                strokeWidth={2}
                dot={{ r: 3, fill: '#0D5470', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card
          header={<h3 className="font-display font-semibold text-sm text-n-700">Operadores por tipo</h3>}
          padding="px-4 pb-4 pt-2"
        >
          {byType.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={byType}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="45%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                >
                  {byType.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, n) => [v, n]}
                  contentStyle={{ fontFamily: 'DM Sans', fontSize: 12, borderRadius: 6, border: '1px solid #E5E8EC' }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={v => <span style={{ fontSize: 11, fontFamily: 'DM Sans', color: '#374151' }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-n-400 text-sm font-body">Sem dados</div>
          )}
        </Card>
      </div>

      {/* Alertas + Actividade */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AlertCard
          icon={Clock}
          color="bg-[var(--warning-light)] text-[var(--warning)] border-[var(--warning)]"
          title="Trials a expirar (7 dias)"
          items={stats.trials_expiring || []}
          emptyMsg="Nenhum trial a expirar em breve"
        />
        <AlertCard
          icon={AlertTriangle}
          color="bg-[var(--info-light)] text-[var(--info)] border-[var(--info)]"
          title="Leads sem resposta (48h)"
          items={stats.new_leads_48h || []}
          emptyMsg="Todos os leads foram contactados"
        />

        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Operadores recentes</h3>} padding="p-0">
          {(stats.recent_operators || []).length === 0 ? (
            <p className="px-4 py-8 text-center text-n-400 text-xs font-body">Sem registos recentes</p>
          ) : (
            <div className="divide-y divide-n-100">
              {(stats.recent_operators || []).map(op => (
                <div key={op.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
                    <span className="text-xs font-display font-bold text-ocean-700">
                      {op.name?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-body font-semibold text-n-900 truncate">{op.name}</p>
                    <p className="text-xs font-body text-n-400">{TYPE_LABELS[op.operator_type] || op.operator_type}</p>
                  </div>
                  <Badge variant={PLAN_BADGE[op.plan] || 'default'}>{op.plan}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
