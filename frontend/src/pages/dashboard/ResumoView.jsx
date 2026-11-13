import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Euro, Percent, Receipt, TrendingUp, BarChart2 } from 'lucide-react';
import { getResumo, getReceita, getUnidades } from '../../services/financeiroService';
import { listReservations } from '../../services/reservationsService';
import { useT } from '../../i18n';
import KpiCard from '../../components/financial/KpiCard';
import RevenueChart from '../../components/financial/RevenueChart';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { mesAtual } from './shared';

/* ─── Vista Resumo (partilhada por todos os tipos de operador) ───── */

const STATUS_BADGE_MAP = {
  pending: 'pending', confirmed: 'confirmed',
  checked_in: 'info', checked_out: 'default', cancelled: 'cancelled',
};
const STATUS_KEY = {
  pending: 'pending', confirmed: 'confirmed',
  checked_in: 'active', checked_out: 'completed', cancelled: 'cancelled',
};

const RESUMO_VAZIO = {
  atual:    { receita: 0, num_reservas: 0, valor_medio: 0, taxa_ocupacao: 0 },
  anterior: { receita: 0, num_reservas: 0, valor_medio: 0, taxa_ocupacao: 0 },
  variacao: { receita: 0, num_reservas: 0, valor_medio: 0, taxa_ocupacao: 0 },
};

/* Data local (nao UTC) no formato AAAA-MM-DD */
function isoLocal(d) {
  return d.toLocaleDateString('en-CA');
}

/* Ultimos 30 dias, hoje incluido, em datas locais do dispositivo */
function ultimos30Dias() {
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 29);
  return { inicio: isoLocal(inicio), fim: isoLocal(fim) };
}

/* Garante a forma esperada mesmo que a API devolva null ou campos em falta */
function normalizaResumo(r) {
  return {
    atual:    { ...RESUMO_VAZIO.atual,    ...(r?.atual || {}) },
    anterior: { ...RESUMO_VAZIO.anterior, ...(r?.anterior || {}) },
    variacao: { ...RESUMO_VAZIO.variacao, ...(r?.variacao || {}) },
  };
}

/* Cartao com titulo, usado nos tres blocos da vista */
function Bloco({ icon: Icon, title, action, children }) {
  return (
    <section className="bg-white border border-n-200 rounded-sm">
      <div className="px-4 py-3 border-b border-n-200 flex items-center gap-2">
        <Icon size={14} strokeWidth={1.75} className="text-n-500" />
        <h2 className="font-display font-semibold text-sm text-n-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function ResumoView() {
  const t = useT();
  const navigate = useNavigate();
  const periodo = useMemo(() => mesAtual(), []);
  const janela = useMemo(() => ultimos30Dias(), []);

  const [resumo,   setResumo]   = useState(RESUMO_VAZIO);
  const [receita,  setReceita]  = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [loading,  setLoading]  = useState(true);

  /* Carga em paralelo; cada chamada falha para um valor vazio */
  useEffect(() => {
    let ativo = true;
    Promise.all([
      getResumo(periodo.inicio, periodo.fim).catch(() => null),
      getReceita(janela.inicio, janela.fim, 'day').catch(() => []),
      getUnidades(periodo.inicio, periodo.fim).catch(() => []),
      /* as 5 criadas mais recentemente, de qualquer mes (antes: so estadias do mes, e uma reserva
         feita hoje para um mes futuro nunca aparecia) */
      listReservations({ order_by: 'created_at', limit: 5 }).catch(() => []),
    ]).then(([res, rec, uni, rsv]) => {
      if (!ativo) return;
      setResumo(normalizaResumo(res));
      setReceita(Array.isArray(rec) ? rec : []);
      setUnidades(Array.isArray(uni) ? uni : []);
      setReservas(Array.isArray(rsv) ? rsv : []);
      setLoading(false);
    });
    return () => { ativo = false; };
  }, [periodo, janela]);

  /* Servicos mais vendidos: ate 5, por receita */
  const topServicos = useMemo(() =>
    [...unidades].sort((a, b) => Number(b.receita || 0) - Number(a.receita || 0)).slice(0, 5),
    [unidades]
  );

  /* Reservas recentes: as 5 criadas mais recentemente */
  const recentes = useMemo(() =>
    [...reservas].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
    [reservas]
  );

  const temReceita = receita.some((p) => Number(p?.receita || 0) > 0);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size={28} />
      </div>
    );
  }

  const { atual, anterior, variacao } = resumo;
  const face = t('dashboard.summary.vsPrevMonth');

  return (
    <div className="space-y-6">
      {/* KPIs do mes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label={t('dashboard.summary.kpiRevenue')}
          value={atual.receita}
          delta={Number(atual.receita || 0) - Number(anterior.receita || 0)}
          deltaLabel={face}
          icon={Euro}
          format="euro"
        />
        <KpiCard
          label={t('dashboard.summary.kpiBookings')}
          value={atual.num_reservas}
          delta={Number(variacao.num_reservas || 0)}
          deltaLabel={face}
          icon={BookOpen}
        />
        <KpiCard
          label={t('dashboard.summary.kpiAvgValue')}
          value={atual.valor_medio}
          delta={Number(atual.valor_medio || 0) - Number(anterior.valor_medio || 0)}
          deltaLabel={face}
          icon={Receipt}
          format="euro"
        />
        <KpiCard
          label={t('dashboard.summary.kpiOccupancy')}
          value={atual.taxa_ocupacao}
          delta={Number(variacao.taxa_ocupacao || 0)}
          deltaLabel={face}
          icon={Percent}
          format="percent"
        />
      </div>

      {/* Receita dos ultimos 30 dias */}
      <Bloco icon={BarChart2} title={t('dashboard.summary.chartTitle')}>
        {temReceita ? (
          <div className="px-3 py-4">
            <RevenueChart data={receita} granularidade="day" />
          </div>
        ) : (
          <EmptyState icon={BarChart2} title={t('dashboard.summary.chartEmpty')} />
        )}
      </Bloco>

      {/* Servicos mais vendidos + Reservas recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Bloco icon={TrendingUp} title={t('dashboard.summary.topServices')}>
          {topServicos.length === 0 ? (
            <EmptyState icon={TrendingUp} title={t('dashboard.summary.topServicesEmpty')} />
          ) : (
            <div className="divide-y divide-n-100">
              {topServicos.map((s, idx) => (
                <div key={`${s.name}-${idx}`} className="px-5 py-3 flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-display font-bold shrink-0 ${
                    idx === 0 ? 'bg-sand-300 text-sand-600' : idx === 1 ? 'bg-n-100 text-n-600' : 'bg-n-50 text-n-400'
                  }`}>{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-display font-semibold text-n-900 truncate">{s.name}</p>
                    <p className="text-[11px] font-body text-n-400">
                      {s.num_reservas || 0} {t('dashboard.activity.reservationsSuffix')}
                    </p>
                  </div>
                  <p className="text-sm font-display font-bold text-ocean-700 shrink-0">
                    {`€${Math.round(Number(s.receita || 0)).toLocaleString('pt-PT')}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Bloco>

        <Bloco
          icon={BookOpen}
          title={t('dashboard.activity.recentReservations')}
          action={(
            <button onClick={() => navigate('/reservas')} className="ml-auto text-xs font-body text-ocean-700 hover:underline">
              {t('dashboard.common.viewAll')}
            </button>
          )}
        >
          {recentes.length === 0 ? (
            <EmptyState icon={BookOpen} title={t('dashboard.activity.noRecentReservations')} />
          ) : (
            <div className="divide-y divide-n-100">
              {recentes.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-display font-semibold text-n-900 truncate">
                      {r.units?.name || r.unit?.name || '—'}
                    </p>
                    <p className="text-[11px] font-body text-n-400 truncate">
                      {r.customer_name || '—'} · {r.check_in}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={STATUS_BADGE_MAP[r.status] || 'default'}>
                      {STATUS_KEY[r.status] ? t(`dashboard.status.${STATUS_KEY[r.status]}`) : r.status}
                    </Badge>
                    <p className="text-xs font-body text-n-400 mt-0.5">{r.guests || 1} {t('dashboard.common.pax')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Bloco>
      </div>
    </div>
  );
}
