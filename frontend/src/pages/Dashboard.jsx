import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Euro, BookOpen, BarChart2, CalendarDays, Users, Zap, Building2, ArrowRight } from 'lucide-react';
import { getResumo } from '../services/financeiroService';
import useAuthStore from '../store/authStore';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import KpiCard from '../components/financial/KpiCard';

const TYPE_LABEL = {
  hotel:      'Hotel / Alojamento',
  activity:   'Actividade Turistica',
  rentacar:   'Rent-a-Car',
  restaurant: 'Restaurante / Bar',
};

function mesAtual() {
  const n = new Date(), y = n.getFullYear(), m = String(n.getMonth() + 1).padStart(2, '0');
  return { inicio: `${y}-${m}-01`, fim: `${y}-${m}-${new Date(y, n.getMonth() + 1, 0).getDate()}` };
}

const QUICK_LINKS = [
  { icon: BookOpen,    label: 'Reservas',    desc: 'Gerir e acompanhar reservas',        to: '/reservas' },
  { icon: CalendarDays,label: 'Calendario',  desc: 'Vista mensal de ocupacao',           to: '/calendario' },
  { icon: Users,       label: 'Clientes',    desc: 'CRM com historico e estatisticas',   to: '/clientes' },
  { icon: Zap,         label: 'Automacoes',  desc: 'Emails e WhatsApp automaticos',      to: '/automacoes' },
  { icon: BarChart2,   label: 'Financeiro',  desc: 'Relatorios e exportacoes',           to: '/financeiro' },
  { icon: Building2,   label: 'Unidades',    desc: 'Gerir quartos, actividades, etc.',   to: '/unidades' },
];

export default function Dashboard() {
  const t = useT();
  const { operator } = useAuthStore();
  const navigate = useNavigate();
  const [resumo, setResumo] = useState(null);
  const periodo = mesAtual();

  useEffect(() => {
    getResumo(periodo.inicio, periodo.fim)
      .then(setResumo)
      .catch(() => {});
  }, []);

  const atual = resumo?.atual;
  const v     = resumo?.variacao;

  return (
    <div>
      <PageHeader
        title={`Bem-vindo, ${operator?.name || ''}`}
        subtitle={`${TYPE_LABEL[operator?.operator_type] || ''} · ${periodo.inicio.slice(0, 7)}`}
      />

      {/* KPIs do mes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KpiCard
          label={t('dashboard.revenue')}
          value={atual?.receita ?? '—'}
          delta={v?.receita}
          deltaLabel="vs mes ant."
          icon={Euro}
          format="euro"
        />
        <KpiCard
          label={t('dashboard.reservations')}
          value={atual?.num_reservas ?? '—'}
          delta={v?.num_reservas}
          deltaLabel="vs mes ant."
          icon={BookOpen}
        />
        <KpiCard
          label={t('dashboard.occupancy')}
          value={atual?.taxa_ocupacao ?? '—'}
          delta={v?.taxa_ocupacao}
          deltaLabel="p.p."
          icon={BarChart2}
          format="percent"
        />
      </div>

      {/* Accoes rapidas */}
      <h2 className="font-display font-semibold text-sm text-n-700 uppercase tracking-wide mb-3">
        {t('dashboard.quickActions')}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {QUICK_LINKS.map(({ icon: Icon, label, desc, to }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="bg-white rounded-md border border-n-200 shadow-sm px-4 py-3.5 flex items-center gap-3 text-left hover:border-ocean-300 hover:shadow-md transition-all group"
          >
            <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0 group-hover:bg-ocean-100 transition-colors">
              <Icon size={18} strokeWidth={1.75} className="text-ocean-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-sm text-n-900">{label}</p>
              <p className="text-xs font-body text-n-500 mt-0.5 truncate">{desc}</p>
            </div>
            <ArrowRight size={14} strokeWidth={1.75} className="text-n-300 shrink-0 group-hover:text-ocean-700 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}
