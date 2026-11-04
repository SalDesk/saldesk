import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Euro, BookOpen, BarChart2, Clock, X as XIcon, MoveRight, MoveLeft, BedDouble, Sparkles,
} from 'lucide-react';
import { getResumo } from '../../services/financeiroService';
import { listUnits } from '../../services/unitsService';
import { listReservations } from '../../services/reservationsService';
import { estadiaEm, estadiaNoMes } from '../../services/reservationRanges';
import { useT } from '../../i18n';
import KpiCard from '../../components/financial/KpiCard';
import AttentionPanel from '../../components/dashboard/AttentionPanel';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { TODAY, mesAtual, HotelMap } from './shared';
import { buildAttentionItems } from './dashboardLogic';

/* ─── Hotel dashboard ───────────────────────────────────────── */

const STATUS_BADGE_MAP_H = {
  pending: 'pending', confirmed: 'confirmed',
  checked_in: 'info', checked_out: 'default', cancelled: 'cancelled',
};
const STATUS_KEY_H = {
  pending: 'pending', confirmed: 'confirmed',
  checked_in: 'active', checked_out: 'completed', cancelled: 'cancelled',
};

export default function HotelDashboard() {
  const t        = useT();
  const navigate = useNavigate();
  const periodo  = mesAtual();

  const [units,    setUnits]    = useState([]);
  const [todayRes, setTodayRes] = useState([]);
  const [monthRes, setMonthRes] = useState([]);
  const [resumo,   setResumo]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    /* Cada chamada falha para o seu valor vazio: uma falha nao apaga as outras */
    Promise.all([
      listUnits().catch(() => []),
      listReservations(estadiaEm(TODAY)).catch(() => []),
      listReservations(estadiaNoMes()).catch(() => []),
      getResumo(periodo.inicio, periodo.fim).catch(() => null),
    ])
      .then(([u, tRes, mRes, res]) => {
        setUnits(u || []);
        setTodayRes(tRes || []);
        setMonthRes(mRes || []);
        setResumo(res);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = useMemo(() => {
    const active   = units.filter(u => !['inactive', 'maintenance'].includes(u.status) && u.is_active !== false);
    const occupied = active.filter(u => todayRes.some(r => r.unit_id === u.id && r.status === 'checked_in')).length;
    const pct      = active.length ? Math.round((occupied / active.length) * 100) : 0;
    return {
      ocupacao:  pct,
      receita:   resumo?.atual?.receita ?? 0,
      /* Sem mes anterior na resposta nao ha variacao a mostrar */
      receitaDelta: resumo?.atual && resumo?.anterior
        ? Number(resumo.atual.receita || 0) - Number(resumo.anterior.receita || 0)
        : undefined,
      checkins:  todayRes.filter(r => r.check_in  === TODAY && ['pending', 'confirmed'].includes(r.status)).length,
      checkouts: todayRes.filter(r => r.check_out === TODAY && r.status === 'checked_in').length,
      pendentes: monthRes.filter(r => r.status === 'pending').length,
    };
  }, [units, todayRes, monthRes, resumo]);

  const checkinsHoje  = useMemo(() =>
    todayRes.filter(r => r.check_in === TODAY && ['pending', 'confirmed'].includes(r.status)),
    [todayRes]
  );
  const checkoutsHoje = useMemo(() =>
    todayRes.filter(r => r.check_out === TODAY && r.status === 'checked_in'),
    [todayRes]
  );

  const alertas = useMemo(() => ({
    manutencao:      units.filter(u => u.status === 'maintenance'),
    semConfirmacao:  todayRes.filter(r => r.check_in === TODAY && r.status === 'pending'),
    limpeza:         units.filter(u => u.status === 'cleaning').length,
  }), [units, todayRes]);

  const roomRes = useMemo(() => {
    if (!selected) return null;
    return todayRes.find(r =>
      r.unit_id === selected.id && ['checked_in', 'confirmed', 'pending'].includes(r.status)
    ) || null;
  }, [selected, todayRes]);

  /* Itens do painel "Requer atencao" (manutencao, por confirmar, limpezas) */
  const attentionItems = useMemo(() => buildAttentionItems({
    maintenance: alertas.manutencao,
    unconfirmed: alertas.semConfirmacao,
    cleaning:    alertas.limpeza,
  }, t), [alertas, t]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  return (
    <div className="space-y-4">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label={t('dashboard.hotel.occupancyToday')}      value={kpis.ocupacao}  format="percent" icon={BarChart2}  />
        <KpiCard label={t('dashboard.hotel.revenueMonth')}        value={kpis.receita}   delta={kpis.receitaDelta} deltaLabel={t('dashboard.summary.vsPrevMonth')} format="euro" icon={Euro} />
        <KpiCard label={t('dashboard.hotel.checkinsToday')}       value={kpis.checkins}  icon={MoveRight}                   />
        <KpiCard label={t('dashboard.hotel.checkoutsToday')}      value={kpis.checkouts} icon={MoveLeft}                    />
        <KpiCard label={t('dashboard.hotel.pendingReservations')} value={kpis.pendentes} icon={Clock}                       />
      </div>

      {/* Mapa de quartos + Requer atencao */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
        <section className="bg-white border border-n-200 rounded-sm">
          <header className="flex items-center gap-2 px-4 py-3 border-b border-n-200">
            <BedDouble size={14} strokeWidth={1.75} className="text-n-500" aria-hidden="true" />
            <h2 className="font-display font-semibold text-sm text-n-900">{t('dashboard.hotel.roomMap')}</h2>
            <button
              type="button"
              onClick={() => navigate('/housekeeping')}
              className="ml-auto text-xs font-body text-ocean-700 hover:underline flex items-center gap-1"
            >
              <Sparkles size={11} strokeWidth={1.75} aria-hidden="true" />
              {t('dashboard.hotel.housekeeping')}
            </button>
          </header>
          <div className="p-4">
            <HotelMap units={units} todayRes={todayRes} onSelect={setSelected} />
          </div>
        </section>

        <AttentionPanel items={attentionItems} />
      </div>

      {/* Check-ins + Check-outs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white border border-n-200 rounded-sm">
          <header className="flex items-center gap-2 px-4 py-3 border-b border-n-200">
            <MoveRight size={14} strokeWidth={1.75} className="text-[#1A7A4A]" aria-hidden="true" />
            <h2 className="font-display font-semibold text-sm text-n-900">{t('dashboard.hotel.checkinsToday')}</h2>
            <span className="ml-auto text-xs font-body text-n-500 tabular-nums">{checkinsHoje.length}</span>
          </header>
          {checkinsHoje.length === 0 ? (
            <EmptyState icon={MoveRight} title={t('dashboard.hotel.noCheckinToday')} />
          ) : (
            <div className="divide-y divide-n-100">
              {checkinsHoje.map(r => (
                <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-display font-semibold text-n-900 truncate">{r.customer_name || '—'}</p>
                    <p className="text-xs font-body text-n-500">
                      {units.find(u => u.id === r.unit_id)?.name || '—'} · {r.guests || 1} {t('dashboard.common.guestsSuffix')}
                    </p>
                  </div>
                  <Badge variant={r.status === 'confirmed' ? 'confirmed' : 'pending'}>
                    {r.status === 'confirmed' ? t('dashboard.status.confirmed') : t('dashboard.status.pending')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-n-200 rounded-sm">
          <header className="flex items-center gap-2 px-4 py-3 border-b border-n-200">
            <MoveLeft size={14} strokeWidth={1.75} className="text-n-500" aria-hidden="true" />
            <h2 className="font-display font-semibold text-sm text-n-900">{t('dashboard.hotel.checkoutsToday')}</h2>
            <span className="ml-auto text-xs font-body text-n-500 tabular-nums">{checkoutsHoje.length}</span>
          </header>
          {checkoutsHoje.length === 0 ? (
            <EmptyState icon={MoveLeft} title={t('dashboard.hotel.noCheckoutToday')} />
          ) : (
            <div className="divide-y divide-n-100">
              {checkoutsHoje.map(r => (
                <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-display font-semibold text-n-900 truncate">{r.customer_name || '—'}</p>
                    <p className="text-xs font-body text-n-500">
                      {units.find(u => u.id === r.unit_id)?.name || '—'} · {r.guests || 1} {t('dashboard.common.guestsSuffix')}
                    </p>
                  </div>
                  <Badge variant="info">{t('dashboard.map.checkout')}</Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Room detail overlay */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="bg-white rounded-xl border border-n-200 shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-display font-bold text-base text-n-900">{selected.name}</h3>
                <p className="text-xs font-body text-n-500 mt-0.5">
                  {selected.unit_type || '—'}
                  {(() => { try { const m = JSON.parse(selected.description || '{}'); return m.floor ? ` · ${t('dashboard.hotel.floor', { n: m.floor })}` : ''; } catch { return ''; } })()}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 text-n-400 hover:text-n-700 rounded">
                <XIcon size={16} strokeWidth={1.75} />
              </button>
            </div>

            {roomRes ? (
              <div className="bg-n-50 rounded-md p-3 mb-4 space-y-1">
                <p className="text-sm font-display font-semibold text-n-900">{roomRes.customer_name || '—'}</p>
                <p className="text-xs font-body text-n-500">
                  {t('dashboard.hotel.checkIn')}: {roomRes.check_in} · {t('dashboard.hotel.checkOut')}: {roomRes.check_out}
                </p>
                <p className="text-xs font-body text-n-500">{roomRes.guests || 1} {t('dashboard.common.guestsSuffix')}</p>
                <div className="pt-1">
                  <Badge variant={STATUS_BADGE_MAP_H[roomRes.status] || 'default'}>
                    {STATUS_KEY_H[roomRes.status] ? t(`dashboard.status.${STATUS_KEY_H[roomRes.status]}`) : roomRes.status}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm font-body text-n-400 mb-4">{t('dashboard.hotel.noActiveReservation')}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 h-9 rounded-md border border-n-200 text-sm font-body text-n-700 hover:bg-n-50 transition-colors"
              >
                {t('dashboard.common.close')}
              </button>
              <button
                onClick={() => { navigate('/reservas'); setSelected(null); }}
                className="flex-1 h-9 rounded-md bg-ocean-700 text-white text-sm font-body font-medium hover:bg-ocean-500 transition-colors flex items-center justify-center gap-1.5"
              >
                <BookOpen size={13} strokeWidth={1.75} />
                {t('dashboard.common.viewReservations')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
