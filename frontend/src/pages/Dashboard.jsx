import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getResumo } from '../services/financeiroService';
import useAuthStore from '../store/authStore';

const TYPE_LABEL = {
  hotel: 'Hotel / Alojamento',
  activity: 'Actividade Turística',
  rentacar: 'Rent-a-Car',
  restaurant: 'Restaurante / Bar'
};

function mesAtual() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const ultimo = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return { inicio: `${y}-${m}-01`, fim: `${y}-${m}-${String(ultimo).padStart(2, '0')}` };
}

export default function Dashboard() {
  const { token, operator } = useAuthStore();
  const navigate = useNavigate();
  const [metricas, setMetricas] = useState(null);
  const periodo = mesAtual();

  useEffect(() => {
    getResumo(token, periodo.inicio, periodo.fim)
      .then(({ data }) => setMetricas(data.atual))
      .catch(() => {});
  }, []);

  const cards = [
    {
      label: 'Receita este mês',
      value: metricas ? `${Number(metricas.receita).toFixed(2)} €` : '—',
      icon: '💰',
      to: '/financeiro'
    },
    {
      label: 'Reservas este mês',
      value: metricas ? String(metricas.num_reservas) : '—',
      icon: '📅',
      to: '/reservas'
    },
    {
      label: 'Taxa de ocupação',
      value: metricas ? `${metricas.taxa_ocupacao}%` : '—',
      icon: '📊',
      to: '/financeiro'
    }
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bem-vindo, {operator?.name} 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          {TYPE_LABEL[operator?.operator_type]} · {periodo.inicio.slice(0, 7)}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {cards.map(({ label, value, icon, to }) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className="card flex items-center gap-4 text-left hover:shadow-md hover:border-primary-200 border-2 border-transparent transition-all"
          >
            <div className="text-3xl">{icon}</div>
            <div>
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { icon: '📅', titulo: 'Reservas', desc: 'Gerir e acompanhar todas as reservas', to: '/reservas' },
          { icon: '🗓️', titulo: 'Calendário', desc: 'Vista mensal de ocupação por unidade', to: '/calendario' },
          { icon: '👥', titulo: 'Clientes', desc: 'CRM com histórico e estatísticas', to: '/clientes' },
          { icon: '💰', titulo: 'Financeiro', desc: 'Relatórios, exportação PDF', to: '/financeiro' }
        ].map(({ icon, titulo, desc, to }) => (
          <button
            key={titulo}
            onClick={() => navigate(to)}
            className="card flex items-center gap-4 text-left hover:shadow-md hover:border-primary-200 border-2 border-transparent transition-all"
          >
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center text-2xl shrink-0">
              {icon}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{titulo}</p>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
