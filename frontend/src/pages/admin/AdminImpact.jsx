import { useState, useEffect } from 'react';
import { Copy, Check, Users, BookOpen, Euro, UserCheck } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const PIE_COLORS  = ['#0D5470', '#1480A8', '#3A9BBF', '#D4A82A'];
const TYPE_LABELS = { activity: 'Actividade', hotel: 'Hotel', rentacar: 'Rent-a-car', restaurant: 'Restaurante' };
const PUBLIC_URL  = 'https://saldesk.cv/impacto';

function BigKpi({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-md border border-n-200 shadow-sm px-6 py-5 flex flex-col gap-2">
      <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center">
        <Icon size={18} strokeWidth={1.75} className="text-ocean-700" />
      </div>
      <p className="font-display font-bold text-3xl text-n-900 leading-none mt-1">{value ?? '—'}</p>
      <p className="text-xs font-body font-semibold text-n-600 uppercase tracking-wide">{label}</p>
      {sub && <p className="text-xs font-body text-n-400">{sub}</p>}
    </div>
  );
}

export default function AdminImpact() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    api.get('/admin/impact')
      .then(r => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function copyLink() {
    navigator.clipboard.writeText(PUBLIC_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;
  if (!data)   return <div className="text-center py-20 text-n-400 font-body text-sm">Erro ao carregar dados de impacto.</div>;

  const byType = (data.operators_by_type || []).map(d => ({
    ...d,
    label: TYPE_LABELS[d.name] || d.name,
  }));

  return (
    <div>
      <PageHeader
        title="Impacto"
        subtitle="Metricas de impacto socioeconomico da plataforma"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={copied ? Check : Copy}
            onClick={copyLink}
          >
            {copied ? 'Copiado' : 'Copiar link publico'}
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <BigKpi
          icon={Users}
          label="Operadores activos"
          value={data.operators_total}
          sub="na plataforma"
        />
        <BigKpi
          icon={BookOpen}
          label="Reservas processadas"
          value={data.reservations_total}
          sub="desde o lancamento"
        />
        <BigKpi
          icon={UserCheck}
          label="Turistas servidos"
          value={data.customers_total}
          sub="clientes registados"
        />
        <BigKpi
          icon={Euro}
          label="Receita gerada"
          value={`€${(data.revenue_total || 0).toLocaleString('pt-PT')}`}
          sub="por operadores SalDesk"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card
          className="lg:col-span-2"
          header={<h3 className="font-display font-semibold text-sm text-n-700">Crescimento de operadores (ultimos 6 meses)</h3>}
          padding="px-5 pb-5 pt-2"
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.growth || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
                allowDecimals={false}
                width={28}
              />
              <Tooltip
                formatter={v => [v, 'Operadores']}
                contentStyle={{ fontFamily: 'DM Sans', fontSize: 12, borderRadius: 6, border: '1px solid #E5E8EC' }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#0D5470"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#0D5470', strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card
          header={<h3 className="font-display font-semibold text-sm text-n-700">Tipos de negocio</h3>}
          padding="px-4 pb-4 pt-2"
        >
          {byType.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={byType}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="44%"
                  innerRadius={50}
                  outerRadius={76}
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

      <Card padding="p-5">
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="flex-1">
            <h3 className="font-display font-semibold text-n-900 mb-1">Relatorio para Ministerio do Turismo</h3>
            <p className="text-sm font-body text-n-500 leading-relaxed">
              Estes dados reflectem o impacto directo da plataforma SalDesk no ecossistema turistico da Ilha do Sal.
              O link publico pode ser partilhado com entidades governamentais e parceiros institucionais.
            </p>
          </div>
          <div className="bg-n-50 rounded-sm px-4 py-3 text-center shrink-0">
            <p className="font-mono text-xs text-n-400 mb-1">Link publico</p>
            <p className="font-mono text-sm text-ocean-700 font-semibold">{PUBLIC_URL}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
